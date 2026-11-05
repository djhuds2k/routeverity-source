"use server";

import { createId } from "@/lib/api/create-id";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, perform, type FormState } from "./mutations";
import { isOperator, isOperatorIdentity } from "./operators";

const availabilitySchema = z.object({
  operation: z.enum(["suspend", "resume"]),
  revision: z.string().datetime(),
  reason: z.string().trim().min(1).max(500),
});

export async function changeWorkspaceAvailability(
  projectId: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  return perform(async (userId) => {
    if (!(await isOperator(userId)))
      throw new ActionError("Operator access is required.");
    const parsed = availabilitySchema.safeParse({
      operation: form.get("operation"),
      revision: form.get("revision"),
      reason: form.get("reason"),
    });
    if (!parsed.success)
      throw new ActionError(
        "Choose an operation, provide the current revision and a reason of 1-500 characters.",
      );
    const { operation, revision, reason } = parsed.data;
    const nextRevision = new Date(
      Math.max(Date.now(), new Date(revision).getTime() + 1),
    );
    const workspace = await prisma.$transaction(async (tx) => {
      const locked = await tx.project.updateMany({
        where: { id: projectId, updatedAt: new Date(revision) },
        data: { updatedAt: nextRevision },
      });
      if (!locked.count)
        throw new ActionError(
          "This workspace changed or is unavailable. Refresh the page and retry.",
        );
      const actor = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerified: true },
      });
      if (!isOperatorIdentity(actor))
        throw new ActionError("Operator access is no longer available.");
      const current = await tx.project.findUnique({
        where: { id: projectId },
        select: { slug: true, disabledAt: true },
      });
      if (!current) throw new ActionError("Workspace unavailable.");
      const wasDisabled = current.disabledAt !== null;
      const isDisabled = operation === "suspend";
      if (wasDisabled === isDisabled)
        throw new ActionError(
          `The workspace is already ${isDisabled ? "suspended" : "available"}.`,
        );
      await tx.project.update({
        where: { id: projectId },
        data: {
          disabledAt: isDisabled ? new Date() : null,
          updatedAt: nextRevision,
        },
      });
      await tx.routeVerityOperatorEvent.create({
        data: {
          id: createId({ prefix: "audit_" }),
          projectId,
          actorId: userId,
          operation: isDisabled ? "WORKSPACE_SUSPENDED" : "WORKSPACE_RESUMED",
          reason,
          wasDisabled,
          isDisabled,
        },
      });
      return current;
    });
    revalidatePath("/operations");
    revalidatePath("/app");
    revalidatePath(`/app/${workspace.slug}`, "layout");
    return {
      message: `Workspace ${operation === "suspend" ? "suspended" : "resumed"}; audit recorded.`,
    };
  });
}
