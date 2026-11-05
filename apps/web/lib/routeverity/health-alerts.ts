import { sendSmtpNotification } from "@dub/email/smtp-notification";
import { z } from "zod";
import { brand } from "./brand";
import { requiredEnv } from "./environment";
import type { HealthReport } from "./health-monitor";

export const alertRepeatMs = 60 * 60_000;
export type AlertState = { incident: boolean; sentAt: number | null };

export function alertRecipient() {
  const parsed = z
    .string()
    .trim()
    .email()
    .max(254)
    .safeParse(process.env.ROUTEVERITY_ALERT_EMAIL);
  if (!parsed.success)
    throw new Error(
      "ROUTEVERITY_ALERT_EMAIL must configure one valid recipient.",
    );
  return parsed.data.toLowerCase();
}

export function alertKind(
  report: HealthReport,
  state: AlertState,
  now: number,
) {
  if (
    !report.healthy &&
    (!state.incident ||
      state.sentAt === null ||
      now - state.sentAt >= alertRepeatMs)
  )
    return "incident" as const;
  if (report.healthy && state.incident) return "recovery" as const;
  return null;
}

export async function sendHealthAlert(
  report: HealthReport,
  kind: "incident" | "recovery",
) {
  const text = [
    `${brand.name} operational ${kind}`,
    `Checked at: ${report.checkedAt}`,
    `Database: ${report.database}; Redis: ${report.redis}`,
    ...report.issues.map(
      (issue) => `${issue.severity.toUpperCase()}: ${issue.code}`,
    ),
    kind === "recovery"
      ? "The current health checks recovered; this is not proof of deployment or end-to-end tracking availability."
      : "Inspect the operator health summary and private worker logs. No customer data or credentials are included.",
  ].join("\n");
  await sendSmtpNotification({
    server: requiredEnv("EMAIL_SERVER"),
    from: requiredEnv("EMAIL_FROM"),
    to: alertRecipient(),
    subject: `${brand.name} operational ${kind}`,
    text,
  });
}
