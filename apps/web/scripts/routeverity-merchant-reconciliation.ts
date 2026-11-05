import { prisma } from "../lib/prisma";
import { reconcileMerchantBatch } from "../lib/routeverity/merchant-ingestion";
import { runWorkerPass } from "../lib/routeverity/worker-health";

const args = process.argv.slice(2);
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function main() {
  if (args.length > 1 || args.some((arg) => arg !== "--watch"))
    throw new Error("Use no flags for one bounded pass, or --watch.");
  do {
    await runWorkerPass("MERCHANT_RECONCILIATION", async (progress) => {
      const result = await reconcileMerchantBatch();
      await progress();
      console.info(
        JSON.stringify({
          event: "routeverity.merchant.reconciliation",
          ...result,
        }),
      );
    });
    if (!args.includes("--watch") || stopping) break;
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  } while (!stopping);
}

main()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "routeverity.merchant.reconciliation.failed",
        error_type: error instanceof Error ? error.name : "unknown",
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
