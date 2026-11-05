import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireUser } from "./auth";
import { allowRequest } from "./rate-limit";
import { reportOperationalError } from "./safe-error-log";
import { canWrite } from "./validation";

export type FormState = {
  error?: string;
  message?: string;
  href?: string;
  revision?: string;
  trackingToken?: string;
  conversionKey?: string;
  googleTemplate?: string;
  googlePreview?: string;
  googleValidatedTarget?: string;
};
export class ActionError extends Error {}

export async function perform(
  operation: (userId: string) => Promise<FormState>,
): Promise<FormState> {
  const user = await requireUser();
  try {
    if (!(await allowRequest("mutations", user.id, 60, 60)))
      throw new ActionError("Too many requests. Please wait a minute.");
    return await operation(user.id);
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        return {
          error:
            "That identifier is already registered. Choose a different one.",
        };
      if (error.code === "P2025")
        return { error: "This item is no longer available. Refresh the page." };
    }
    reportOperationalError("routeverity.mutation.failed", error);
    return {
      error: "The request failed. Please retry, or check the application logs.",
    };
  }
}

export async function writableWorkspace(
  userId: string,
  slug: string,
  ownerOnly = false,
) {
  const member = await prisma.projectUsers.findFirst({
    where: { userId, project: { slug, disabledAt: null } },
    include: { project: true },
  });
  if (
    !member ||
    !canWrite(member.role) ||
    (ownerOnly && member.role !== "owner")
  )
    throw new ActionError(
      "You do not have permission to change this workspace.",
    );
  return member.project;
}
