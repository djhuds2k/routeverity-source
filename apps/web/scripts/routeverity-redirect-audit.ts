import { prisma } from "../lib/prisma";
import {
  IntegrityMismatch,
  redirectIntegrityMismatches,
  runWorkerPass,
} from "../lib/routeverity/worker-health";

async function main() {
  await runWorkerPass("INTEGRITY", async () => {
    const mismatches = await redirectIntegrityMismatches();
    if (mismatches) {
      console.error(
        JSON.stringify({
          event: "routeverity.redirect.critical",
          code: "AUDIT_INTEGRITY_MISMATCH",
          count: mismatches,
        }),
      );
      throw new IntegrityMismatch("Persisted redirect integrity check failed.");
    } else {
      console.log(
        "PASS: persisted redirect audit fingerprints/statuses match.",
      );
    }
  });
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
