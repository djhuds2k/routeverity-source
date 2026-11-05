import { prisma } from "@/lib/prisma";
import { z } from "zod";

type OperatorIdentity = {
  email: string | null;
  emailVerified: Date | null;
};

function configuredOperatorEmail() {
  const value = process.env.ROUTEVERITY_OPERATOR_EMAIL;
  if (value === undefined) return null;
  const parsed = z.string().trim().email().max(254).safeParse(value);
  if (!parsed.success)
    throw new Error(
      "ROUTEVERITY_OPERATOR_EMAIL must be a valid email address.",
    );
  return parsed.data.toLowerCase();
}

export function isOperatorIdentity(user: OperatorIdentity | null) {
  const email = configuredOperatorEmail();
  return (
    email !== null &&
    user?.emailVerified != null &&
    user.email?.trim().toLowerCase() === email
  );
}

export async function isOperator(userId: string) {
  if (configuredOperatorEmail() === null) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  return isOperatorIdentity(user);
}
