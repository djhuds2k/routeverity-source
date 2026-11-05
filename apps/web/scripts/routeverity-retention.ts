import { prisma } from "../lib/prisma";
import {
  pruneGlobalBatch,
  pruneWorkspaceBatch,
  retentionWorkspacePage,
} from "../lib/routeverity/retention";
import { runWorkerPass } from "../lib/routeverity/worker-health";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const watch = args.includes("--watch");
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function main() {
  if (
    args.some((value) => !["--apply", "--watch"].includes(value)) ||
    new Set(args).size !== args.length ||
    (watch && !apply)
  )
    throw new Error("Use no flags for dry run, --apply, or --apply --watch.");
  do {
    if (apply) await runWorkerPass("RETENTION", (progress) => pass(progress));
    else await pass();
    if (!watch || stopping) break;
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  } while (!stopping);
}

async function pass(progress?: () => Promise<void>) {
  const now = new Date();
  let cursor = "";
  while (!stopping) {
    const workspaces = await retentionWorkspacePage(now, cursor);
    for (const workspace of workspaces) {
      while (!stopping) {
        const result = await pruneWorkspaceBatch(workspace.id, now, apply);
        if (progress) await progress();
        console.info(
          JSON.stringify({
            event: "routeverity.retention.workspace",
            ...result,
          }),
        );
        if (
          !apply ||
          (result.scannedClicks < 100 &&
            result.scannedConversions < 100 &&
            result.scannedMerchantSubmissions < 100 &&
            !result.remainingReceipts &&
            !result.remainingMerchantReceipts)
        )
          break;
      }
      if (stopping) break;
      cursor = workspace.id;
    }
    if (workspaces.length < 100) break;
  }
  while (!stopping) {
    const result = await pruneGlobalBatch(now, apply);
    if (progress) await progress();
    console.info(
      JSON.stringify({ event: "routeverity.retention.global", ...result }),
    );
    if (
      !apply ||
      (result.scannedUserAgents < 100 && result.scannedOperatorEvents < 100)
    )
      break;
  }
  if (stopping && apply)
    throw new Error("Retention pass interrupted before completion.");
}

main()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "routeverity.retention.failed",
        error_type: error instanceof Error ? error.name : "unknown",
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
