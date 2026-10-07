"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { goalSchema, issueConversionKey } from "./conversion-policy";
import {
  ActionError,
  perform,
  writableWorkspace,
  type FormState,
} from "./mutations";

export async function createConversionGoal(
  slug: string,
  _state: FormState,
  form: FormData,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    const parsed = goalSchema.safeParse(
      Object.fromEntries(
        ["campaignId", "name", "event", "currency"].map((key) => [
          key,
          form.get(key),
        ]),
      ),
    );
    if (!parsed.success)
      throw new ActionError(
        "Choose an owned campaign, a goal name, lowercase event key and supported ISO currency.",
      );
    await prisma.$transaction(async (tx) => {
      const locked = await tx.project.updateMany({
        where: { id: workspace.id, disabledAt: null },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) throw new ActionError("Workspace unavailable.");
      const campaign = await tx.routeVerityCampaign.findFirst({
        where: { id: parsed.data.campaignId, projectId: workspace.id },
      });
      if (!campaign)
        throw new ActionError("Campaign not found in this workspace.");
      await tx.routeVerityConversionGoal.create({
        data: {
          id: `cvg_${randomUUID()}`,
          projectId: workspace.id,
          ...parsed.data,
        },
      });
    });
    revalidatePath(`/app/${slug}/conversions`);
    return {
      message:
        "Conversion goal created. Its event key and currency are immutable.",
    };
  });
}

export async function setConversionGoalEnabled(
  slug: string,
  goalId: string,
  enabled: boolean,
  _state: FormState,
  _form: FormData,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    await prisma.$transaction(async (tx) => {
      const locked = await tx.project.updateMany({
        where: { id: workspace.id, disabledAt: null },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) throw new ActionError("Workspace unavailable.");
      const updated = await tx.routeVerityConversionGoal.updateMany({
        where: { id: goalId, projectId: workspace.id },
        data: { enabled },
      });
      if (!updated.count)
        throw new ActionError("Goal not found in this workspace.");
    });
    revalidatePath(`/app/${slug}/conversions`);
    return {
      message: enabled
        ? "Goal enabled."
        : "Goal disabled. Exact retries of existing conversions remain idempotent.",
    };
  });
}

export async function createConversionApiKey(
  slug: string,
  _state: FormState,
  form: FormData,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    const name = String(form.get("name") ?? "").trim();
    if (name.length < 2 || name.length > 60)
      throw new ActionError("Enter a key label of 2 to 60 characters.");
    if (form.get("confirm") !== "on")
      throw new ActionError(
        "Confirm this credential permits conversion creation.",
      );
    const key = issueConversionKey();
    await prisma.$transaction(async (tx) => {
      const locked = await tx.project.updateMany({
        where: { id: workspace.id, disabledAt: null },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) throw new ActionError("Workspace unavailable.");
      if (
        (await tx.routeVerityConversionKey.count({
          where: { projectId: workspace.id, revokedAt: null },
        })) >= 5
      )
        throw new ActionError(
          "At most five active conversion keys are allowed. Revoke an unused key first.",
        );
      await tx.routeVerityConversionKey.create({
        data: {
          id: key.id,
          projectId: workspace.id,
          name,
          tokenHash: key.hash,
        },
      });
    });
    revalidatePath(`/app/${slug}/conversions`);
    return {
      message:
        "Conversion API key issued. Copy it now; it cannot be recovered.",
      conversionKey: key.token,
    };
  });
}

export async function revokeConversionApiKey(
  slug: string,
  keyId: string,
  _state: FormState,
  form: FormData,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug);
    if (form.get("confirm") !== "on")
      throw new ActionError("Confirm permanent key revocation.");
    await prisma.$transaction(async (tx) => {
      const locked = await tx.project.updateMany({
        where: { id: workspace.id, disabledAt: null },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) throw new ActionError("Workspace unavailable.");
      const updated = await tx.routeVerityConversionKey.updateMany({
        where: { id: keyId, projectId: workspace.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!updated.count)
        throw new ActionError("Key unavailable or already revoked.");
    });
    revalidatePath(`/app/${slug}/conversions`);
    return { message: "Conversion API key revoked." };
  });
}
