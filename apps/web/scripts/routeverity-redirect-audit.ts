import { prisma } from "../lib/prisma";

async function main() {
  const fields = prisma.routeVerityRedirectAudit.fields;
  const mismatches = await prisma.routeVerityRedirectAudit.count({
    where: {
      OR: [
        {
          NOT: {
            validatedNextHopHash: { equals: fields.actualRedirectTargetHash },
          },
        },
        { validationResult: { not: "ALLOWED" } },
        { redirectStatus: { not: 302 } },
      ],
    },
  });
  if (mismatches) {
    console.error(
      JSON.stringify({
        event: "routeverity.redirect.critical",
        code: "AUDIT_INTEGRITY_MISMATCH",
        count: mismatches,
      }),
    );
    process.exitCode = 1;
  } else {
    console.log("PASS: persisted redirect audit fingerprints/statuses match.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "routeverity.redirect.monitor.failed",
        error_type: error instanceof Error ? error.name : "unknown",
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
