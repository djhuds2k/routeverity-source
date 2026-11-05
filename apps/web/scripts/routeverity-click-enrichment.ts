import { prisma } from "../lib/prisma";
import { enrichClickBatch } from "../lib/routeverity/click-enrichment";
import { runWorkerPass } from "../lib/routeverity/worker-health";

const watch = process.argv.includes("--watch");
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function main() {
  if (process.argv.slice(2).some((value) => value !== "--watch"))
    throw new Error("Only --watch is supported.");
  do {
    const result = await runWorkerPass("ENRICHMENT", () => enrichClickBatch());
    console.info(
      JSON.stringify({ event: "routeverity.click.enrichment", ...result }),
    );
    if (result.scanned === 100) continue;
    if (!watch) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } while (!stopping);
}

main()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "routeverity.click.enrichment.failed",
        error_type: error instanceof Error ? error.name : "unknown",
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
