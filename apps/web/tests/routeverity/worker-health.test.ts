import {
  alertKind,
  alertRecipient,
  alertRepeatMs,
  sendHealthAlert,
} from "@/lib/routeverity/health-alerts";
import {
  backlogStaleMs,
  getHealthReport,
  healthIssues,
  integrityStaleMs,
  workerStaleMs,
  type HealthReport,
  type HealthSnapshot,
} from "@/lib/routeverity/health-monitor";
import {
  IntegrityMismatch,
  runWorkerPass,
  WorkerSuperseded,
} from "@/lib/routeverity/worker-health";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  workers: vi.fn(),
  pending: vi.fn(),
  operator: vi.fn(),
  policy: vi.fn(),
  expiry: vi.fn(),
  ping: vi.fn(),
  mail: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    routeVerityWorkerHealth: { upsert: mocks.start, updateMany: mocks.update },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@upstash/redis", () => ({
  Redis: class {
    ping = mocks.ping;
  },
}));
vi.mock("@dub/email/smtp-notification", () => ({
  sendSmtpNotification: mocks.mail,
}));

const now = new Date("2026-10-08T10:00:00.000Z");
function healthySnapshot(): HealthSnapshot {
  return {
    workers: (["ENRICHMENT", "RETENTION", "INTEGRITY"] as const).map(
      (name) => ({
        name,
        runId: "private-run",
        state: "SUCCEEDED",
        startedAt: now,
        progressAt: now,
        succeededAt: now,
        failedAt: null,
        failureCode: null,
      }),
    ),
    oldestPendingAt: null,
    rawInputOverdue: false,
    operatorAuditOverdue: false,
    clicksOverdue: false,
    conversionsOverdue: false,
    invalidRetentionPolicy: false,
    merchantPending: false,
    merchantBacklogOverdue: false,
    merchantExpiryOverdue: false,
  };
}
function report(healthy = false): HealthReport {
  return {
    checkedAt: now.toISOString(),
    healthy,
    database: "available",
    redis: "available",
    issues: healthy ? [] : [{ code: "RETENTION_STALE", severity: "warning" }],
    snapshot: healthySnapshot(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "http://127.0.0.1:18079");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "private-fake-test-token");
  vi.stubEnv("ROUTEVERITY_ALERT_EMAIL", "monitor-unit@routeverity.test");
  vi.stubEnv("EMAIL_SERVER", "smtp://127.0.0.1:11025");
  vi.stubEnv("EMAIL_FROM", "RouteVerity Local <noreply@routeverity.test>");
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.workers.mockResolvedValue(healthySnapshot().workers);
  mocks.pending.mockResolvedValue(null);
  mocks.operator.mockResolvedValue(null);
  mocks.policy.mockResolvedValue(null);
  mocks.expiry.mockResolvedValue([
    {
      clicksOverdue: 0n,
      conversionsOverdue: 0n,
      merchantPending: 0n,
      merchantBacklogOverdue: 0n,
      merchantExpiryOverdue: 0n,
    },
  ]);
  mocks.ping.mockResolvedValue("PONG");
  mocks.mail.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation((operation) =>
    operation({
      routeVerityWorkerHealth: { findMany: mocks.workers },
      routeVerityRedirectAudit: { findFirst: mocks.pending },
      routeVerityOperatorEvent: { findFirst: mocks.operator },
      project: { findFirst: mocks.policy },
      $queryRaw: mocks.expiry,
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("durable worker progress", () => {
  it("records start, real progress and success without erasing prior success at start", async () => {
    expect(
      await runWorkerPass("ENRICHMENT", async (progress) => {
        await progress();
        return { processed: 10 };
      }),
    ).toEqual({ processed: 10 });
    const start = mocks.start.mock.calls[0][0];
    expect(start.create).toMatchObject({
      name: "ENRICHMENT",
      state: "RUNNING",
    });
    expect(start.update.succeededAt).toBeUndefined();
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      where: { name: "ENRICHMENT", runId: start.create.runId },
      data: { progressAt: expect.any(Date) },
    });
    expect(mocks.update.mock.calls[1][0].data).toMatchObject({
      state: "SUCCEEDED",
      succeededAt: expect.any(Date),
      failureCode: null,
    });
  });
  it("records failure, rethrows and never stores private error messages", async () => {
    await expect(
      runWorkerPass("RETENTION", async () => {
        throw new Error("private connection string");
      }),
    ).rejects.toThrow("private connection string");
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({
      state: "FAILED",
      failureCode: "WORKER_FAILED",
      failedAt: expect.any(Date),
    });
    expect(JSON.stringify(mocks.update.mock.calls)).not.toContain(
      "private connection",
    );
  });
  it("marks an integrity mismatch as failed rather than a successful check", async () => {
    await expect(
      runWorkerPass("INTEGRITY", async () => {
        throw new IntegrityMismatch();
      }),
    ).rejects.toBeInstanceOf(IntegrityMismatch);
    expect(mocks.update.mock.calls[0][0].data.failureCode).toBe(
      "INTEGRITY_MISMATCH",
    );
  });
  it("does not overwrite a newer run with a stale heartbeat or false success", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    await expect(
      runWorkerPass("RETENTION", async (progress) => {
        await progress();
      }),
    ).rejects.toBeInstanceOf(WorkerSuperseded);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.update.mock.calls[0][0].where.runId).toBe(
      mocks.start.mock.calls[0][0].create.runId,
    );
  });
  it("surfaces heartbeat storage failure without running unmonitored work", async () => {
    mocks.start.mockRejectedValueOnce(new Error("DB unavailable"));
    const work = vi.fn();
    await expect(runWorkerPass("ENRICHMENT", work)).rejects.toThrow(
      "DB unavailable",
    );
    expect(work).not.toHaveBeenCalled();
  });
  it("reports failure to persist failure status instead of silently losing it", async () => {
    mocks.update.mockRejectedValueOnce(new Error("heartbeat offline"));
    await expect(
      runWorkerPass("RETENTION", async () => {
        throw new Error("original");
      }),
    ).rejects.toThrow("original");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain(
      "HEARTBEAT_WRITE_FAILED",
    );
  });
});

describe("exact approved health thresholds", () => {
  it("is healthy only with all current workers and no backlog flags", () => {
    expect(healthIssues(healthySnapshot(), now)).toEqual([]);
    const data = healthySnapshot();
    data.workers = [];
    expect(healthIssues(data, now).map((issue) => issue.code)).toEqual([
      "ENRICHMENT_NEVER_RUN",
      "RETENTION_NEVER_RUN",
      "INTEGRITY_NEVER_RUN",
    ]);
  });
  it("alerts at exactly five minutes without enrichment/retention progress", () => {
    const data = healthySnapshot();
    data.workers[0].progressAt = new Date(now.getTime() - workerStaleMs + 1);
    expect(healthIssues(data, now)).toEqual([]);
    data.workers[0].progressAt = new Date(now.getTime() - workerStaleMs);
    expect(healthIssues(data, now)).toEqual([
      { code: "ENRICHMENT_STALE", severity: "warning" },
    ]);
  });
  it("requires successful integrity completion, not merely a new running heartbeat", () => {
    const data = healthySnapshot();
    data.workers[2].state = "RUNNING";
    data.workers[2].succeededAt = new Date(now.getTime() - integrityStaleMs);
    expect(healthIssues(data, now)).toEqual([
      { code: "INTEGRITY_STALE", severity: "warning" },
    ]);
    data.workers[2].succeededAt = null;
    expect(healthIssues(data, now)[0].code).toBe("INTEGRITY_NO_SUCCESS");
  });
  it("reports explicit failure even when prior success/progress is recent", () => {
    const data = healthySnapshot();
    data.workers[1].state = "FAILED";
    expect(healthIssues(data, now)[0]).toEqual({
      code: "RETENTION_FAILED",
      severity: "critical",
    });
    data.workers[2].state = "FAILED";
    data.workers[2].failureCode = "INTEGRITY_MISMATCH";
    expect(
      healthIssues(data, now).some(
        (issue) => issue.code === "INTEGRITY_MISMATCH",
      ),
    ).toBe(true);
  });
  it("warns at the exact ten-minute pending-age boundary", () => {
    const data = healthySnapshot();
    data.oldestPendingAt = new Date(now.getTime() - backlogStaleMs + 1);
    expect(healthIssues(data, now)).toEqual([]);
    data.oldestPendingAt = new Date(now.getTime() - backlogStaleMs);
    expect(healthIssues(data, now)[0].code).toBe("ENRICHMENT_BACKLOG");
  });
  it("reports expiry and corrupted retention policies as critical, not fabricated zero backlog", () => {
    const data = healthySnapshot();
    Object.assign(data, {
      rawInputOverdue: true,
      operatorAuditOverdue: true,
      clicksOverdue: true,
      conversionsOverdue: true,
      invalidRetentionPolicy: true,
    });
    expect(healthIssues(data, now).map((issue) => issue.code)).toEqual([
      "RAW_INPUT_EXPIRY_OVERDUE",
      "OPERATOR_AUDIT_EXPIRY_OVERDUE",
      "CLICK_EXPIRY_OVERDUE",
      "CONVERSION_EXPIRY_OVERDUE",
      "INVALID_RETENTION_POLICY",
    ]);
  });
  it("rejects far-future or invalid timestamps as clock faults", () => {
    const data = healthySnapshot();
    data.workers[0].progressAt = new Date(now.getTime() + 60_001);
    data.oldestPendingAt = new Date(NaN);
    expect(healthIssues(data, now).map((issue) => issue.code)).toEqual([
      "ENRICHMENT_CLOCK_INVALID",
      "ENRICHMENT_BACKLOG_CLOCK_INVALID",
    ]);
  });
  it("requires merchant supervision only when active work is pending and reports overdue data", () => {
    const data = healthySnapshot();
    expect(healthIssues(data, now)).toEqual([]);
    data.merchantPending = true;
    data.merchantBacklogOverdue = true;
    data.merchantExpiryOverdue = true;
    expect(healthIssues(data, now).map((issue) => issue.code)).toEqual([
      "MERCHANT_RECONCILIATION_NEVER_RUN",
      "MERCHANT_RECONCILIATION_OVERDUE",
      "MERCHANT_EXPIRY_OVERDUE",
    ]);
  });
});

describe("bounded dependency observations", () => {
  it("checks actual SQL/Redis and builds a healthy snapshot with no private identifiers", async () => {
    const result = await getHealthReport(now);
    expect(result.healthy).toBe(true);
    expect(result.database).toBe("available");
    expect(result.redis).toBe("available");
    expect(mocks.ping).toHaveBeenCalledOnce();
    expect(mocks.pending.mock.calls[1][0].where.timestamp.lte).toEqual(
      new Date(now.getTime() - backlogStaleMs - 24 * 3_600_000),
    );
    const sql = mocks.expiry.mock.calls[0][0];
    expect(sql.sql).toContain("LEFT JOIN Project");
    expect(sql.sql).toContain("c.receivedAt");
    expect(sql.values).toEqual([
      new Date(now.getTime() - backlogStaleMs),
      new Date(now.getTime() - backlogStaleMs),
      new Date(now.getTime() - backlogStaleMs),
      new Date(now.getTime() - backlogStaleMs),
    ]);
  });
  it("does not call a failed or unobserved database healthy", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("private DB URI"));
    const result = await getHealthReport(now);
    expect(result).toMatchObject({
      healthy: false,
      database: "unavailable",
      snapshot: null,
    });
    expect(result.issues).toContainEqual({
      code: "DATABASE_UNAVAILABLE",
      severity: "critical",
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "private DB",
    );
  });
  it("rejects unexpected Redis and SQL output rather than guessing availability", async () => {
    mocks.ping.mockResolvedValueOnce("unexpected");
    mocks.expiry.mockResolvedValueOnce([
      { clicksOverdue: "private-invalid", conversionsOverdue: 0 },
    ]);
    const result = await getHealthReport(now);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "DATABASE_UNAVAILABLE",
      "REDIS_UNAVAILABLE",
    ]);
  });
  it("reports a hung dependency at the deadline without claiming cancellation", async () => {
    vi.useFakeTimers();
    mocks.ping.mockImplementationOnce(() => new Promise(() => {}));
    const pending = getHealthReport(now);
    await vi.advanceTimersByTimeAsync(3000);
    expect((await pending).issues).toContainEqual({
      code: "REDIS_UNAVAILABLE",
      severity: "critical",
    });
  });
});

describe("opt-in incident/recovery SMTP alerts", () => {
  it("normalizes one recipient and rejects missing/malformed configuration explicitly", () => {
    vi.stubEnv("ROUTEVERITY_ALERT_EMAIL", " MONITOR@routeverity.test ");
    expect(alertRecipient()).toBe("monitor@routeverity.test");
    for (const value of [
      undefined,
      "",
      "a@routeverity.test,b@routeverity.test",
      "invalid",
    ]) {
      vi.stubEnv("ROUTEVERITY_ALERT_EMAIL", value);
      expect(() => alertRecipient()).toThrow("ROUTEVERITY_ALERT_EMAIL");
    }
  });
  it("sends first incident, suppresses repeat before one hour, and sends exactly at the boundary", () => {
    expect(alertKind(report(), { incident: false, sentAt: null }, 0)).toBe(
      "incident",
    );
    expect(
      alertKind(report(), { incident: true, sentAt: 0 }, alertRepeatMs - 1),
    ).toBeNull();
    expect(
      alertKind(report(), { incident: true, sentAt: 0 }, alertRepeatMs),
    ).toBe("incident");
  });
  it("sends recovery only after an accepted incident, and treats restarts as fresh state", () => {
    expect(
      alertKind(report(true), { incident: false, sentAt: null }, 0),
    ).toBeNull();
    expect(alertKind(report(true), { incident: true, sentAt: 0 }, 1)).toBe(
      "recovery",
    );
    expect(alertKind(report(), { incident: false, sentAt: null }, 1)).toBe(
      "incident",
    );
  });
  it("emails only checked timings and fixed issue codes, never the full snapshot or user data", async () => {
    await sendHealthAlert(report(), "incident");
    const message = mocks.mail.mock.calls[0][0];
    expect(message.to).toBe("monitor-unit@routeverity.test");
    expect(message.text).toContain("RETENTION_STALE");
    expect(message.text).not.toContain("private-run");
    expect(message.text).not.toContain("private-fake-test-token");
    expect(message.subject).toBe("RouteVerity operational incident");
  });
  it("does not swallow rejected email delivery", async () => {
    mocks.mail.mockRejectedValueOnce(new Error("SMTP rejected"));
    await expect(sendHealthAlert(report(), "incident")).rejects.toThrow(
      "SMTP rejected",
    );
  });
});
