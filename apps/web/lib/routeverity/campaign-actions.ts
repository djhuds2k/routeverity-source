"use server";

import { createId } from "@/lib/api/create-id";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "./auth";
import {
  campaignReadiness,
  campaignSchema,
  isCampaignDestinationAllowed,
  parameterKeys,
} from "./campaign-policy";
import {
  ActionError,
  perform,
  writableWorkspace,
  type FormState,
} from "./mutations";
import { destinationSchema } from "./validation";

function parseCampaign(form: FormData) {
  let destinationDomains: unknown;
  try {
    destinationDomains = JSON.parse(String(form.get("destinationDomains")));
  } catch {
    throw new ActionError(
      "Destination policies could not be read. Refresh the page and retry.",
    );
  }
  const trackingParameters = Object.fromEntries(
    parameterKeys.flatMap((key) => {
      const value = form.get(key);
      return typeof value === "string" && value.trim() ? [[key, value]] : [];
    }),
  );
  const input = campaignSchema.safeParse({
    ...Object.fromEntries(form),
    destinationDomains,
    trackingParameters,
  });
  if (!input.success) throw new ActionError(input.error.issues[0].message);
  return input.data;
}

export async function saveCampaign(
  slug: string,
  campaignId: string | null,
  _state: FormState,
  form: FormData,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    const input = parseCampaign(form);
    const id = campaignId ?? createId({ prefix: "cmp_" });
    const savedRevision = await prisma.$transaction(async (tx) => {
      // Serialize campaign configuration and domain removal within the workspace.
      await tx.project.update({
        where: { id: workspace.id },
        data: { updatedAt: new Date() },
      });
      const domain = input.trackingDomainId
        ? await tx.domain.findFirst({
            where: {
              id: input.trackingDomainId,
              projectId: workspace.id,
              type: "TRANSPARENT_TRACKING",
            },
          })
        : null;
      if (input.trackingDomainId && !domain)
        throw new ActionError(
          "Select a transparent tracking domain belonging to this workspace.",
        );
      if (input.status === "ACTIVE") {
        const reason = campaignReadiness({ ...input, trackingDomain: domain });
        if (reason) throw new ActionError(reason);
      }
      const {
        destinationDomains,
        trackingDomainId,
        externalCampaignId,
        notes,
        ...fields
      } = input;
      const data = {
        ...fields,
        trackingDomainId: trackingDomainId || null,
        externalCampaignId: externalCampaignId || null,
        notes: notes || null,
      };
      if (campaignId) {
        const revision = new Date(String(form.get("revision")));
        if (Number.isNaN(revision.getTime()))
          throw new ActionError(
            "Campaign version is missing. Refresh the page before saving.",
          );
        const updatedAt = new Date(
          Math.max(Date.now(), revision.getTime() + 1),
        );
        const updated = await tx.routeVerityCampaign.updateMany({
          where: { id, projectId: workspace.id, updatedAt: revision },
          data: { ...data, updatedAt },
        });
        if (!updated.count)
          throw new ActionError(
            "This campaign changed or is unavailable. Refresh the page before saving.",
          );
        await tx.routeVerityDestinationDomain.deleteMany({
          where: { campaignId: id },
        });
        if (destinationDomains.length)
          await tx.routeVerityDestinationDomain.createMany({
            data: destinationDomains.map((rule) => ({
              ...rule,
              campaignId: id,
            })),
          });
        return updatedAt.toISOString();
      } else {
        const created = await tx.routeVerityCampaign.create({
          data: {
            id,
            projectId: workspace.id,
            ...data,
            destinationDomains: { create: destinationDomains },
          },
        });
        return created.updatedAt.toISOString();
      }
    });
    revalidatePath(`/app/${slug}`);
    revalidatePath(`/app/${slug}/campaigns`);
    revalidatePath(`/app/${slug}/campaigns/${id}`);
    return campaignId
      ? {
          message: "Campaign saved. Tracking is not enabled yet.",
          revision: savedRevision,
        }
      : { href: `/app/${slug}/campaigns/${id}` };
  });
}

export async function deleteCampaign(
  slug: string,
  campaignId: string,
  _state: FormState,
  form: FormData,
) {
  const result = await perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    if (form.get("confirm") !== "on")
      throw new ActionError("Confirm permanent campaign deletion.");
    const revision = new Date(String(form.get("revision")));
    if (Number.isNaN(revision.getTime()))
      throw new ActionError("Refresh the page before deleting.");
    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: workspace.id },
        data: { updatedAt: new Date() },
      });
      const campaign = await tx.routeVerityCampaign.findFirst({
        where: { id: campaignId, projectId: workspace.id },
      });
      if (!campaign)
        throw new ActionError("Campaign not found in this workspace.");
      if (campaign.status !== "ARCHIVED")
        throw new ActionError("Archive the campaign before deleting it.");
      if (campaign.updatedAt.getTime() !== revision.getTime())
        throw new ActionError(
          "This campaign changed. Refresh the page before deleting.",
        );
      await tx.routeVerityDestinationDomain.deleteMany({
        where: { campaignId },
      });
      await tx.routeVerityCampaign.delete({ where: { id: campaignId } });
    });
    revalidatePath(`/app/${slug}`);
    revalidatePath(`/app/${slug}/campaigns`);
    return { href: `/app/${slug}/campaigns` };
  });
  if (result.href) redirect(result.href);
  return result;
}

export async function checkCampaignDestination(
  slug: string,
  campaignId: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const { workspace } = await requireWorkspace(slug);
  const destination = destinationSchema.safeParse(form.get("destination"));
  if (!destination.success)
    return { error: destination.error.issues[0].message };
  const campaign = await prisma.routeVerityCampaign.findFirst({
    where: { id: campaignId, projectId: workspace.id },
    include: { destinationDomains: true },
  });
  if (!campaign) return { error: "Campaign not found in this workspace." };
  return isCampaignDestinationAllowed(
    destination.data,
    campaign.destinationDomains,
  )
    ? {
        message:
          "Hostname matches the saved destination policy. This is not a live tracking or redirect test.",
      }
    : {
        error:
          "Destination hostname is not approved by the saved campaign policy.",
      };
}
