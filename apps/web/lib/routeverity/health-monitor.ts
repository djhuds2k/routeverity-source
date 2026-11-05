import { prisma } from "@/lib/prisma";
import { Prisma, type RouteVerityWorkerHealth } from "@prisma/client";
import { Redis } from "@upstash/redis";
import { requiredEnv } from "./environment";
import { maximumRetentionDays, retentionCutoffs } from "./retention-policy";

export const workerStaleMs = 5 * 60_000;
export const integrityStaleMs = 10 * 60_000;
export const backlogStaleMs = 10 * 60_000;
export const healthDeadlineMs = 3000;
const workerNames = ["ENRICHMENT", "RETENTION", "INTEGRITY"] as const;

export type HealthIssue = { code: string; severity: "critical" | "warning" };
export type HealthSnapshot = {
  workers: RouteVerityWorkerHealth[];
  oldestPendingAt: Date | null;
  rawInputOverdue: boolean;
  operatorAuditOverdue: boolean;
  clicksOverdue: boolean;
  conversionsOverdue: boolean;
  invalidRetentionPolicy: boolean;
  merchantPending: boolean;
  merchantBacklogOverdue: boolean;
  merchantExpiryOverdue: boolean;
};
export type HealthReport = {
  checkedAt: string;
  healthy: boolean;
  database: "available" | "unavailable";
  redis: "available" | "unavailable";
  issues: HealthIssue[];
  snapshot: HealthSnapshot | null;
};

function sqlFlag(value: unknown) {
  if (value === true || value === 1 || value === 1n) return true;
  if (value === false || value === 0 || value === 0n) return false;
  throw new Error("Invalid health-query result.");
}

async function snapshot(now: Date): Promise<HealthSnapshot> {
  const overdueTime = new Date(now.getTime() - backlogStaleMs);
  const cutoffs = retentionCutoffs(overdueTime, maximumRetentionDays);
  return prisma.$transaction(
    async (tx) => {
      const [workers, pending, raw, operator, invalid, expiry] =
        await Promise.all([
          tx.routeVerityWorkerHealth.findMany({ orderBy: { name: "asc" } }),
          tx.routeVerityRedirectAudit.findFirst({
            where: { analyticsCaptured: true, enrichedAt: null },
            orderBy: [{ timestamp: "asc" }, { clickId: "asc" }],
            select: { timestamp: true },
          }),
          tx.routeVerityRedirectAudit.findFirst({
            where: {
              rawUserAgent: { not: null },
              timestamp: { lte: cutoffs.rawUserAgent },
            },
            orderBy: [{ timestamp: "asc" }, { clickId: "asc" }],
            select: { timestamp: true },
          }),
          tx.routeVerityOperatorEvent.findFirst({
            where: { createdAt: { lt: cutoffs.operator } },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { createdAt: true },
          }),
          tx.project.findFirst({
            where: { routeverityRetentionDays: { notIn: [30, 60, 90] } },
            select: { routeverityRetentionDays: true },
          }),
          tx.$queryRaw<
            {
              clicksOverdue: unknown;
              conversionsOverdue: unknown;
              merchantPending: unknown;
              merchantBacklogOverdue: unknown;
              merchantExpiryOverdue: unknown;
            }[]
          >(Prisma.sql`
        SELECT
          EXISTS(
            SELECT 1 FROM RouteVerityRedirectAudit a
            LEFT JOIN Project p ON p.id = a.projectId
            WHERE (p.id IS NULL OR p.routeverityRetentionDays IN (30, 60, 90))
              AND a.timestamp < DATE_SUB(${overdueTime}, INTERVAL COALESCE(p.routeverityRetentionDays, 90) DAY)
          ) AS clicksOverdue,
          EXISTS(
            SELECT 1 FROM RouteVerityConversion c
            LEFT JOIN Project p ON p.id = c.projectId
            WHERE (p.id IS NULL OR p.routeverityRetentionDays IN (30, 60, 90))
              AND c.receivedAt < DATE_SUB(${overdueTime}, INTERVAL COALESCE(p.routeverityRetentionDays, 90) DAY)
          ) AS conversionsOverdue,
          EXISTS(
            SELECT 1 FROM RouteVerityMerchantSubmission m
            INNER JOIN Project p ON p.id = m.projectId AND p.disabledAt IS NULL
            WHERE m.status = 'PENDING'
          ) AS merchantPending,
          EXISTS(
            SELECT 1 FROM RouteVerityMerchantSubmission m
            INNER JOIN Project p ON p.id = m.projectId AND p.disabledAt IS NULL
            WHERE m.status = 'PENDING' AND m.nextAttemptAt <= ${overdueTime}
          ) AS merchantBacklogOverdue,
          EXISTS(
            SELECT 1 FROM RouteVerityMerchantSubmission m
            LEFT JOIN Project p ON p.id = m.projectId
            WHERE (p.id IS NULL OR p.routeverityRetentionDays IN (30, 60, 90))
              AND m.receivedAt < DATE_SUB(${overdueTime}, INTERVAL COALESCE(p.routeverityRetentionDays, 90) DAY)
          ) AS merchantExpiryOverdue
      `),
        ]);
      if (expiry.length !== 1) throw new Error("Missing health-query result.");
      return {
        workers,
        oldestPendingAt: pending?.timestamp ?? null,
        rawInputOverdue: raw !== null,
        operatorAuditOverdue: operator !== null,
        invalidRetentionPolicy: invalid !== null,
        clicksOverdue: sqlFlag(expiry[0].clicksOverdue),
        conversionsOverdue: sqlFlag(expiry[0].conversionsOverdue),
        merchantPending: sqlFlag(expiry[0].merchantPending),
        merchantBacklogOverdue: sqlFlag(expiry[0].merchantBacklogOverdue),
        merchantExpiryOverdue: sqlFlag(expiry[0].merchantExpiryOverdue),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 1000,
      timeout: 2500,
    },
  );
}

export function healthIssues(data: HealthSnapshot, now: Date): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const requiredWorkers = data.merchantPending
    ? [...workerNames, "MERCHANT_RECONCILIATION" as const]
    : workerNames;
  for (const name of requiredWorkers) {
    const worker = data.workers.find((record) => record.name === name);
    if (!worker) {
      issues.push({ code: `${name}_NEVER_RUN`, severity: "warning" });
      continue;
    }
    const reference =
      name === "INTEGRITY" ? worker.succeededAt : worker.progressAt;
    if (worker.state === "FAILED")
      issues.push({
        code:
          worker.failureCode === "INTEGRITY_MISMATCH"
            ? "INTEGRITY_MISMATCH"
            : `${name}_FAILED`,
        severity: "critical",
      });
    if (!reference) {
      issues.push({ code: `${name}_NO_SUCCESS`, severity: "warning" });
    } else if (
      !Number.isFinite(reference.getTime()) ||
      reference.getTime() > now.getTime() + 60_000
    ) {
      issues.push({ code: `${name}_CLOCK_INVALID`, severity: "critical" });
    } else if (
      now.getTime() - reference.getTime() >=
      (name === "INTEGRITY" ? integrityStaleMs : workerStaleMs)
    ) {
      issues.push({ code: `${name}_STALE`, severity: "warning" });
    }
  }
  if (data.oldestPendingAt) {
    const age = now.getTime() - data.oldestPendingAt.getTime();
    if (!Number.isFinite(age) || age < -60_000)
      issues.push({
        code: "ENRICHMENT_BACKLOG_CLOCK_INVALID",
        severity: "critical",
      });
    else if (age >= backlogStaleMs)
      issues.push({ code: "ENRICHMENT_BACKLOG", severity: "warning" });
  }
  for (const [overdue, code] of [
    [data.rawInputOverdue, "RAW_INPUT_EXPIRY_OVERDUE"],
    [data.operatorAuditOverdue, "OPERATOR_AUDIT_EXPIRY_OVERDUE"],
    [data.clicksOverdue, "CLICK_EXPIRY_OVERDUE"],
    [data.conversionsOverdue, "CONVERSION_EXPIRY_OVERDUE"],
    [data.invalidRetentionPolicy, "INVALID_RETENTION_POLICY"],
    [data.merchantBacklogOverdue, "MERCHANT_RECONCILIATION_OVERDUE"],
    [data.merchantExpiryOverdue, "MERCHANT_EXPIRY_OVERDUE"],
  ] as const)
    if (overdue) issues.push({ code, severity: "critical" });
  return issues;
}

async function observe<T>(operation: () => Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Health dependency deadline exceeded.")),
          healthDeadlineMs,
        );
      }),
    ]);
    return { ok: true as const, value };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "routeverity.health.dependency.failed",
        error_type: error instanceof Error ? error.name : "unknown",
      }),
    );
    return { ok: false as const };
  } finally {
    clearTimeout(timer);
  }
}

export async function getHealthReport(now = new Date()): Promise<HealthReport> {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Health requires a valid reference time.");
  const [database, redis] = await Promise.all([
    observe(() => snapshot(now)),
    observe(async () => {
      const client = new Redis({
        url: requiredEnv("UPSTASH_REDIS_REST_URL"),
        token: requiredEnv("UPSTASH_REDIS_REST_TOKEN"),
      });
      if ((await client.ping()) !== "PONG")
        throw new Error("Unexpected Redis health response.");
    }),
  ]);
  const issues = database.ok
    ? healthIssues(database.value, now)
    : [{ code: "DATABASE_UNAVAILABLE", severity: "critical" as const }];
  if (!redis.ok)
    issues.push({ code: "REDIS_UNAVAILABLE", severity: "critical" });
  return {
    checkedAt: now.toISOString(),
    healthy: issues.length === 0,
    database: database.ok ? "available" : "unavailable",
    redis: redis.ok ? "available" : "unavailable",
    issues,
    snapshot: database.ok ? database.value : null,
  };
}
