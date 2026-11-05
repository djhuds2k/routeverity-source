"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  ActionError,
  perform,
  writableWorkspace,
  type FormState,
} from "./mutations";
import { retentionDaysSchema } from "./retention-policy";

export async function saveRetention(
  slug: string,
  _state: FormState,
  form: FormData,
) {
  return perform(async (userId) => {
    const workspace = await writableWorkspace(userId, slug, true);
    const days = retentionDaysSchema.safeParse(form.get("retentionDays"));
    const previous = retentionDaysSchema.safeParse(form.get("previousDays"));
    if (!days.success || !previous.success)
      throw new ActionError("Choose 30, 60 or 90 days of retention.");
    if (
      days.data < previous.data &&
      form.get("confirmShorterRetention") !== "on"
    )
      throw new ActionError(
        "Confirm that shorter retention permanently deletes older records.",
      );
    await prisma.$transaction(async (tx) => {
      const locked = await tx.project.updateMany({
        where: {
          id: workspace.id,
          disabledAt: null,
          routeverityRetentionDays: previous.data,
        },
        data: {
          routeverityRetentionDays: days.data,
          updatedAt: new Date(),
        },
      });
      if (!locked.count)
        throw new ActionError(
          "Retention changed or this workspace is unavailable. Refresh and retry.",
        );
      const member = await tx.projectUsers.findFirst({
        where: { projectId: workspace.id, userId },
        select: { role: true },
      });
      if (member?.role !== "owner")
        throw new ActionError(
          "You no longer have permission to change retention.",
        );
    });
    revalidatePath(`/app/${slug}`, "layout");
    return {
      message:
        "Retention saved. The cleanup worker permanently removes expired records; increasing retention cannot recover deleted data.",
    };
  });
}
