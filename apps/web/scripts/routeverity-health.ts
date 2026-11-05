import { prisma } from "../lib/prisma";
import {
  alertKind,
  alertRecipient,
  sendHealthAlert,
  type AlertState,
} from "../lib/routeverity/health-alerts";
import { getHealthReport } from "../lib/routeverity/health-monitor";

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const notify = args.includes("--notify");
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function main() {
  if (
    args.some((arg) => !["--watch", "--notify"].includes(arg)) ||
    new Set(args).size !== args.length
  )
    throw new Error("Only --watch and --notify are supported.");
  if (notify) alertRecipient();
  let state: AlertState = { incident: false, sentAt: null };
  do {
    const report = await getHealthReport();
    const summary = {
      event: "routeverity.health",
      checked_at: report.checkedAt,
      healthy: report.healthy,
      database: report.database,
      redis: report.redis,
      issues: report.issues,
    };
    if (report.healthy) console.info(JSON.stringify(summary));
    else console.error(JSON.stringify(summary));
    let notificationFailed = false;
    if (notify) {
      const kind = alertKind(report, state, Date.now());
      if (kind) {
        try {
          await sendHealthAlert(report, kind);
          state = { incident: kind === "incident", sentAt: Date.now() };
          console.info(
            JSON.stringify({
              event: "routeverity.health.alert.accepted",
              kind,
            }),
          );
        } catch (error) {
          notificationFailed = true;
          console.error(
            JSON.stringify({
              event: "routeverity.health.alert.failed",
              error_type: error instanceof Error ? error.name : "unknown",
            }),
          );
        }
      }
    }
    process.exitCode = report.healthy && !notificationFailed ? 0 : 1;
    if (!watch || stopping) break;
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  } while (!stopping);
}

main()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "routeverity.health.monitor.failed",
        error_type: error instanceof Error ? error.name : "unknown",
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
