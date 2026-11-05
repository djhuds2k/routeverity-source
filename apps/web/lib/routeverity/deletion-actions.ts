"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, perform, type FormState } from "./mutations";

export async function deleteWorkspace(
  projectId: string,
  _state: FormState,
  form: FormData,
) {
  return perform(async (userId) => {
    const revision = z.string().datetime().safeParse(form.get("revision"));
    if (!revision.success || form.get("confirmDeletion") !== "on")
      throw new ActionError(
        "Provide the current workspace revision and confirm permanent deletion.",
      );
    const confirmation = form.get("workspaceAddress");
    if (typeof confirmation !== "string")
      throw new ActionError(
        "Type the exact workspace address to confirm deletion.",
      );
    const deleted = await prisma.$transaction(
      async (tx) => {
        const locked = await tx.project.updateMany({
          where: { id: projectId, updatedAt: new Date(revision.data) },
          data: { updatedAt: new Date() },
        });
        if (!locked.count)
          throw new ActionError(
            "This workspace changed or is unavailable. Refresh and retry.",
          );
        const membership = await tx.projectUsers.findFirst({
          where: { projectId, userId },
          select: { role: true },
        });
        if (membership?.role !== "owner")
          throw new ActionError(
            "Only a current owner can delete this workspace.",
          );
        const workspace = await tx.project.findUnique({
          where: { id: projectId },
          select: { slug: true },
        });
        if (!workspace || confirmation !== workspace.slug)
          throw new ActionError(
            "Type the exact workspace address to confirm deletion.",
          );

        await tx.routeVerityMerchantReceipt.deleteMany({
          where: { projectId },
        });
        await tx.routeVerityMerchantSubmission.deleteMany({
          where: { projectId },
        });
        await tx.routeVerityConversionReceipt.deleteMany({
          where: { projectId },
        });
        await tx.routeVerityConversion.deleteMany({ where: { projectId } });
        await tx.routeVerityConversionKey.deleteMany({ where: { projectId } });
        await tx.routeVerityConversionGoal.deleteMany({ where: { projectId } });
        await tx.routeVerityRedirectAudit.deleteMany({ where: { projectId } });
        await tx.routeVerityCampaign.deleteMany({ where: { projectId } });
        await tx.link.deleteMany({ where: { projectId } });
        await tx.domain.deleteMany({ where: { projectId } });
        await tx.user.updateMany({
          where: { defaultWorkspace: workspace.slug },
          data: { defaultWorkspace: null },
        });
        await tx.project.delete({ where: { id: projectId } });
        return workspace;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );
    revalidatePath("/app", "layout");
    revalidatePath("/account");
    revalidatePath("/operations");
    revalidatePath(`/app/${deleted.slug}`, "layout");
    return { href: "/account", message: "Workspace permanently deleted." };
  });
}

export async function deleteAccount(_state: FormState, form: FormData) {
  return perform(async (userId) => {
    if (form.get("confirmDeletion") !== "on")
      throw new ActionError("Confirm permanent account deletion.");
    await prisma.$transaction(
      async (tx) => {
        // Order deletion with workspace creation and link authorship changes.
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`,
        );
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { email: true, emailVerified: true },
        });
        if (!user?.email || !user.emailVerified)
          throw new ActionError(
            "Your verified account is no longer available.",
          );
        if (form.get("email") !== user.email)
          throw new ActionError(
            "Type your exact current email address to confirm deletion.",
          );
        if (await tx.projectUsers.count({ where: { userId, role: "owner" } }))
          throw new ActionError(
            "Delete every workspace you own before deleting your account. Shared workspaces are not deleted automatically.",
          );
        // Shared links remain available without retaining the deleted author's ID.
        await tx.link.updateMany({ where: { userId }, data: { userId: null } });
        await tx.projectUsers.deleteMany({ where: { userId } });
        await tx.verificationToken.deleteMany({
          where: { identifier: user.email },
        });
        await tx.emailVerificationToken.deleteMany({
          where: { identifier: user.email },
        });
        await tx.passwordResetToken.deleteMany({
          where: { identifier: user.email },
        });
        await tx.session.deleteMany({ where: { userId } });
        await tx.account.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId } });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );
    revalidatePath("/app", "layout");
    revalidatePath("/account");
    return { href: "/login" };
  });
}
