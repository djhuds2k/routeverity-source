"use server";

import { createId } from "@/lib/api/create-id";
import { prisma } from "@/lib/prisma";
import { Prisma, type Domain } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { appOrigin } from "./environment";
import {
  ActionError,
  perform,
  writableWorkspace,
  type FormState,
} from "./mutations";
import {
  canWrite,
  domainSchema,
  isLocalOrigin,
  linkSchema,
  workspaceSchema,
} from "./validation";

export type { FormState } from "./mutations";

async function lockDomainWorkspace(
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
) {
  const locked = await tx.project.updateMany({
    where: { id: projectId, disabledAt: null },
    data: { updatedAt: new Date() },
  });
  if (!locked.count) throw new ActionError("Workspace unavailable.");
  const member = await tx.projectUsers.findFirst({
    where: { projectId, userId },
    select: { role: true },
  });
  if (!member || !canWrite(member.role))
    throw new ActionError(
      "You no longer have permission to change this workspace.",
    );
}

async function updateDomainSnapshot(
  tx: Prisma.TransactionClient,
  projectId: string,
  domain: Domain,
  data: Prisma.DomainUpdateManyMutationInput,
) {
  const updated = await tx.domain.updateMany({
    where: {
      id: domain.id,
      projectId,
      slug: domain.slug,
      type: domain.type,
      verificationToken: domain.verificationToken,
      updatedAt: domain.updatedAt,
    },
    data: {
      ...data,
      updatedAt: new Date(Math.max(Date.now(), domain.updatedAt.getTime() + 1)),
    },
  });
  if (!updated.count)
    throw new ActionError(
      "This domain changed or is unavailable. Refresh the page and retry.",
    );
}

export async function createWorkspace(_state: FormState, form: FormData) {
  return perform(async (userId) => {
    const input = workspaceSchema.safeParse(Object.fromEntries(form));
    if (!input.success) throw new ActionError(input.error.issues[0].message);
    const id = createId({ prefix: "ws_" });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { defaultWorkspace: input.data.slug },
      });
      if (
        (await tx.projectUsers.count({ where: { userId, role: "owner" } })) >=
        10
      )
        throw new ActionError(
          "This baseline supports up to ten workspaces per account.",
        );
      await tx.project.create({
        data: {
          id,
          ...input.data,
          plan: "free",
          billingCycleStart: new Date().getUTCDate(),
          users: { create: { userId, role: "owner" } },
          ...(isLocalOrigin(appOrigin())
            ? {
                domains: {
                  create: {
                    slug: `${id.toLowerCase()}.localhost`,
                    type: "DEVELOPMENT",
                    verified: true,
                  },
                },
              }
            : {}),
        },
      });
    });
    revalidatePath("/app");
    return { href: `/app/${input.data.slug}` };
  });
}

export async function saveWorkspace(
  slug: string,
  _state: FormState,
  form: FormData,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug, true);
    const name = workspaceSchema.shape.name.safeParse(form.get("name"));
    if (!name.success) throw new ActionError(name.error.issues[0].message);
    await prisma.project.update({
      where: { id: workspace.id },
      data: { name: name.data },
    });
    revalidatePath(`/app/${slug}`, "layout");
    return { message: "Workspace name saved." };
  });
}

export async function addDomain(
  slug: string,
  _state: FormState,
  form: FormData,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    const input = domainSchema.safeParse(Object.fromEntries(form));
    if (!input.success) throw new ActionError(input.error.issues[0].message);
    if (input.data.slug === new URL(appOrigin()).hostname)
      throw new ActionError(
        "The application hostname cannot be used as a link domain.",
      );
    await prisma.$transaction(async (tx) => {
      await lockDomainWorkspace(tx, workspace.id, userId);
      if (
        (await tx.domain.count({
          where: { projectId: workspace.id, type: { not: "DEVELOPMENT" } },
        })) >= workspace.domainsLimit
      )
        throw new ActionError(
          `The free plan supports ${workspace.domainsLimit} custom domains.`,
        );
      await tx.domain.create({
        data: {
          id: createId({ prefix: "dom_" }),
          ...input.data,
          projectId: workspace.id,
          verificationToken: randomBytes(24).toString("hex"),
        },
      });
    });
    revalidatePath(`/app/${slug}/domains`);
    return {
      message:
        "Domain added. Publish the TXT record below to verify ownership.",
    };
  });
}

async function setDomainVerification(
  domain: Domain,
  projectId: string,
  userId: string,
  slug: string,
  verified: boolean,
) {
  await prisma.$transaction(async (tx) => {
    await lockDomainWorkspace(tx, projectId, userId);
    await updateDomainSnapshot(tx, projectId, domain, {
      verified,
      lastChecked: new Date(),
    });
  });
  revalidatePath(`/app/${slug}/domains`);
  revalidatePath(`/app/${slug}/links`);
}

export async function changeDomain(
  slug: string,
  domainId: string,
  operation: "remove" | "suspend" | "resume" | "verify",
  _state: FormState,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    const domain = await prisma.domain.findFirst({
      where: { id: domainId, projectId: workspace.id },
    });
    if (!domain) throw new ActionError("Domain not found in this workspace.");
    if (operation === "remove") {
      await prisma.$transaction(async (tx) => {
        await lockDomainWorkspace(tx, workspace.id, userId);
        await updateDomainSnapshot(tx, workspace.id, domain, {
          suspendedAt: new Date(),
        });
        if (
          await tx.routeVerityCampaign.count({
            where: { trackingDomainId: domain.id },
          })
        )
          throw new ActionError(
            "Unassign this domain from its campaigns before removing it.",
          );
        if (await tx.link.count({ where: { domain: domain.slug } }))
          throw new ActionError(
            "Remove the domain's links before removing this domain.",
          );
        await tx.domain.delete({ where: { id: domain.id } });
      });
    } else if (operation === "verify") {
      if (domain.type === "DEVELOPMENT")
        throw new ActionError(
          "Development domains do not use public DNS verification.",
        );
      let records: string[][];
      try {
        const resolver = new Resolver({ timeout: 2000, tries: 1 });
        records = await resolver.resolveTxt(`_routeverity.${domain.slug}`);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          ["ENODATA", "ENOTFOUND"].includes(String(error.code))
        ) {
          await setDomainVerification(
            domain,
            workspace.id,
            userId,
            slug,
            false,
          );
          throw new ActionError(
            "TXT record not found. Publish the record and allow time for DNS propagation.",
          );
        }
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ETIMEOUT"
        )
          throw new ActionError(
            "DNS verification timed out. No ownership status was changed; retry the check.",
          );
        if (
          error instanceof Error &&
          "code" in error &&
          ["ECONNREFUSED", "ESERVFAIL", "EREFUSED", "EAI_AGAIN"].includes(
            String(error.code),
          )
        )
          throw new ActionError(
            "DNS verification is temporarily unavailable. No ownership status was changed; retry the check.",
          );
        throw error;
      }
      const verified = Boolean(
        domain.verificationToken &&
          records.some(
            (parts) =>
              parts.join("") ===
              `routeverity-verification=${domain.verificationToken}`,
          ),
      );
      await setDomainVerification(domain, workspace.id, userId, slug, verified);
      if (!verified)
        throw new ActionError(
          "The TXT record did not match. Copy the exact verification value.",
        );
    } else {
      await prisma.$transaction(async (tx) => {
        await lockDomainWorkspace(tx, workspace.id, userId);
        await updateDomainSnapshot(tx, workspace.id, domain, {
          suspendedAt: operation === "suspend" ? new Date() : null,
        });
      });
    }
    revalidatePath(`/app/${slug}/domains`);
    revalidatePath(`/app/${slug}/links`);
    return {
      message: `Domain ${operation === "remove" ? "removed" : operation === "verify" ? "verified" : operation === "suspend" ? "suspended" : "resumed"}.`,
    };
  });
}

export async function createLink(
  slug: string,
  _state: FormState,
  form: FormData,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    const input = linkSchema.safeParse(Object.fromEntries(form));
    if (!input.success) throw new ActionError(input.error.issues[0].message);
    await prisma.$transaction(async (tx) => {
      const authors = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`,
      );
      if (!authors.length)
        throw new ActionError("Your account is unavailable.");
      const current = await tx.project.update({
        where: { id: workspace.id },
        data: { totalLinks: { increment: 1 } },
      });
      if (current.totalLinks > current.linksLimit)
        throw new ActionError("The free plan link limit has been reached.");
      const member = await tx.projectUsers.findFirst({
        where: { userId, projectId: workspace.id },
        select: { role: true },
      });
      if (current.disabledAt || !member || !canWrite(member.role))
        throw new ActionError("You no longer have permission to create links.");
      // Lock before reading so a concurrent suspension cannot leave stale state.
      await tx.domain.updateMany({
        where: { id: input.data.domainId, projectId: workspace.id },
        data: { updatedAt: new Date() },
      });
      const domain = await tx.domain.findFirst({
        where: { id: input.data.domainId, projectId: workspace.id },
      });
      if (
        !domain ||
        !domain.verified ||
        domain.suspendedAt ||
        domain.type === "TRANSPARENT_TRACKING"
      )
        throw new ActionError(
          "Choose a verified, active standard or development domain.",
        );
      const shortLink =
        domain.type === "DEVELOPMENT"
          ? `${appOrigin()}/r/${slug}/${input.data.key}`
          : `https://${domain.slug}/${input.data.key}`;
      if (shortLink === input.data.url)
        throw new ActionError("A link cannot redirect to itself.");
      await tx.link.create({
        data: {
          id: createId({ prefix: "link_" }),
          domain: domain.slug,
          key: input.data.key,
          url: input.data.url,
          shortLink,
          projectId: workspace.id,
          userId,
          trackConversion: false,
        },
      });
    });
    revalidatePath(`/app/${slug}/links`);
    revalidatePath(`/app/${slug}`);
    return {
      message:
        "Standard link created. Click analytics and transparent tracking are not enabled in this baseline.",
    };
  });
}

export async function deleteLink(
  slug: string,
  linkId: string,
  _state: FormState,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: workspace.id },
        data: { updatedAt: new Date() },
      });
      const result = await tx.link.deleteMany({
        where: { id: linkId, projectId: workspace.id },
      });
      if (!result.count)
        throw new ActionError("Link not found in this workspace.");
      await tx.project.update({
        where: { id: workspace.id },
        data: { totalLinks: { decrement: 1 } },
      });
    });
    revalidatePath(`/app/${slug}/links`);
    revalidatePath(`/app/${slug}`);
    return { message: "Link removed." };
  });
}
