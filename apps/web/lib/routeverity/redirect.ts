import { prisma } from "@/lib/prisma";
import { destinationSchema } from "./validation";

export async function resolveStandardLink(
  domain: string,
  key: string,
  development: boolean,
) {
  const link = await prisma.link.findUnique({
    where: { domain_key: { domain, key } },
    include: { shortDomain: true, project: { select: { disabledAt: true } } },
  });
  if (
    !link ||
    !link.project ||
    link.project.disabledAt ||
    link.archived ||
    link.disabledAt ||
    (link.expiresAt && link.expiresAt <= new Date()) ||
    !link.shortDomain.verified ||
    link.shortDomain.suspendedAt ||
    link.shortDomain.type !== (development ? "DEVELOPMENT" : "STANDARD_LINK")
  )
    return null;
  const destination = destinationSchema.safeParse(link.url);
  return destination.success ? destination.data : null;
}
