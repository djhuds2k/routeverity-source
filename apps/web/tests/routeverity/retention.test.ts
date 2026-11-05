import {
  pruneGlobalBatch,
  pruneWorkspaceBatch,
  retentionWorkspacePage,
} from "@/lib/routeverity/retention";
import { saveRetention } from "@/lib/routeverity/retention-actions";
import {
  retentionCutoffs,
  retentionDaysSchema,
} from "@/lib/routeverity/retention-policy";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  member: vi.fn(),
  lock: vi.fn(),
  raw: vi.fn(),
  transaction: vi.fn(),
  conversions: vi.fn(),
  deleteConversions: vi.fn(),
  receipts: vi.fn(),
  remainingReceipt: vi.fn(),
  deleteReceipts: vi.fn(),
  clicks: vi.fn(),
  deleteClicks: vi.fn(),
  clearAgents: vi.fn(),
  operators: vi.fn(),
  deleteOperators: vi.fn(),
  merchantSubmissions: vi.fn(),
  merchantReceipts: vi.fn(),
  remainingMerchantReceipt: vi.fn(),
  deleteMerchantReceipts: vi.fn(),
  deleteMerchantSubmissions: vi.fn(),
}));
vi.mock("@/lib/routeverity/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user_owner" }),
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({
  allowRequest: vi.fn().mockResolvedValue(true),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const client = {
    $queryRaw: mocks.raw,
    project: { findUnique: mocks.workspace, updateMany: mocks.lock },
    projectUsers: { findFirst: mocks.member },
    routeVerityConversion: {
      findMany: mocks.conversions,
      deleteMany: mocks.deleteConversions,
    },
    routeVerityConversionReceipt: {
      findMany: mocks.receipts,
      findFirst: mocks.remainingReceipt,
      deleteMany: mocks.deleteReceipts,
    },
    routeVerityRedirectAudit: {
      findMany: mocks.clicks,
      deleteMany: mocks.deleteClicks,
      updateMany: mocks.clearAgents,
    },
    routeVerityOperatorEvent: {
      findMany: mocks.operators,
      deleteMany: mocks.deleteOperators,
    },
    routeVerityMerchantSubmission: {
      findMany: mocks.merchantSubmissions,
      deleteMany: mocks.deleteMerchantSubmissions,
    },
    routeVerityMerchantReceipt: {
      findMany: mocks.merchantReceipts,
      findFirst: mocks.remainingMerchantReceipt,
      deleteMany: mocks.deleteMerchantReceipts,
    },
  };
  mocks.transaction.mockImplementation((operation) => operation(client));
  return { prisma: { ...client, $transaction: mocks.transaction } };
});
const now = new Date("2026-10-08T01:00:00.000Z");
const cutoff90 = new Date("2026-07-10T01:00:00.000Z");
function form(days = "90", previous = "90", confirm = false) {
  const value = new FormData();
  value.set("retentionDays", days);
  value.set("previousDays", previous);
  if (confirm) value.set("confirmShorterRetention", "on");
  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue({ routeverityRetentionDays: 90 });
  mocks.member.mockResolvedValue({
    role: "owner",
    project: { id: "ws_test" },
  });
  mocks.lock.mockResolvedValue({ count: 1 });
  mocks.conversions.mockResolvedValue([{ id: "cnv_expired" }]);
  mocks.merchantSubmissions.mockResolvedValue([]);
  mocks.merchantReceipts.mockResolvedValue([]);
  mocks.remainingMerchantReceipt.mockResolvedValue(null);
  mocks.deleteMerchantReceipts.mockResolvedValue({ count: 0 });
  mocks.deleteMerchantSubmissions.mockResolvedValue({ count: 0 });
  mocks.receipts.mockResolvedValue([{ id: "receipt_expired" }]);
  mocks.remainingReceipt.mockResolvedValue(null);
  mocks.clicks.mockResolvedValue([{ clickId: "rvc_expired" }]);
  mocks.operators.mockResolvedValue([{ id: "audit_expired" }]);
  for (const remove of [
    mocks.deleteConversions,
    mocks.deleteReceipts,
    mocks.deleteClicks,
    mocks.clearAgents,
    mocks.deleteOperators,
  ])
    remove.mockResolvedValue({ count: 1 });
});

describe("approved retention policy", () => {
  it("uses exact elapsed UTC days, separate 365-day audit and 24-hour raw-UA limits", () => {
    expect(retentionCutoffs(now, 90)).toEqual({
      records: cutoff90,
      operator: new Date("2025-10-08T01:00:00.000Z"),
      rawUserAgent: new Date("2026-10-07T01:00:00.000Z"),
    });
  });
  it.each(["0", "29", "31", "91", "365", "", "90.0", " 90", null])(
    "rejects unsupported or malformed form retention %j",
    (days) => expect(retentionDaysSchema.safeParse(days).success).toBe(false),
  );
  it.each([30, 60, 90])("accepts only the supported retention %s", (days) => {
    expect(retentionDaysSchema.parse(String(days))).toBe(days);
    expect(retentionCutoffs(now, days).records.getTime()).toBe(
      now.getTime() - days * 86_400_000,
    );
  });
  it("rejects invalid dates and corrupted policy values without pruning", async () => {
    expect(() => retentionCutoffs(new Date(NaN), 90)).toThrow();
    mocks.workspace.mockResolvedValue({ routeverityRetentionDays: 91 });
    await expect(pruneWorkspaceBatch("ws_test", now, true)).rejects.toThrow();
    expect(mocks.conversions).not.toHaveBeenCalled();
    expect(mocks.deleteClicks).not.toHaveBeenCalled();
  });
});

describe("bounded independent cleanup", () => {
  it.each([0, -1, 501, 1.5])("rejects invalid batch size %s", async (limit) => {
    await expect(
      pruneWorkspaceBatch("ws_test", now, true, limit),
    ).rejects.toThrow();
    await expect(pruneGlobalBatch(now, true, limit)).rejects.toThrow();
    await expect(retentionWorkspacePage(now, "", limit)).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.raw).not.toHaveBeenCalled();
  });
  it("defaults to a bounded read-only preview without workspace locks or deletes", async () => {
    expect(await pruneWorkspaceBatch("ws_test", now)).toMatchObject({
      applied: false,
      clicks: 1,
      conversions: 1,
      receipts: 1,
    });
    expect(mocks.raw).not.toHaveBeenCalled();
    expect(mocks.deleteReceipts).not.toHaveBeenCalled();
    expect(mocks.deleteConversions).not.toHaveBeenCalled();
    expect(mocks.deleteClicks).not.toHaveBeenCalled();
    await pruneGlobalBatch(now);
    expect(mocks.clearAgents).not.toHaveBeenCalled();
    expect(mocks.deleteOperators).not.toHaveBeenCalled();
  });
  it("locks current policy and scopes every selected/deleted record to the workspace and age", async () => {
    expect(await pruneWorkspaceBatch("ws_test", now, true, 2)).toMatchObject({
      applied: true,
      clicks: 1,
      conversions: 1,
      receipts: 1,
      remainingReceipts: false,
    });
    expect(mocks.raw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.workspace.mock.invocationCallOrder[0],
    );
    expect(mocks.conversions).toHaveBeenCalledWith({
      where: { projectId: "ws_test", receivedAt: { lt: cutoff90 } },
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      take: 2,
      select: { id: true },
    });
    expect(mocks.deleteReceipts).toHaveBeenCalledWith({
      where: {
        projectId: "ws_test",
        conversionId: { in: ["cnv_expired"] },
        id: { in: ["receipt_expired"] },
      },
    });
    expect(mocks.deleteConversions).toHaveBeenCalledWith({
      where: {
        projectId: "ws_test",
        id: { in: ["cnv_expired"] },
        receivedAt: { lt: cutoff90 },
      },
    });
    expect(mocks.deleteClicks).toHaveBeenCalledWith({
      where: {
        projectId: "ws_test",
        clickId: { in: ["rvc_expired"] },
        timestamp: { lt: cutoff90 },
      },
    });
    expect(mocks.deleteReceipts.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteConversions.mock.invocationCallOrder[0],
    );
    expect(mocks.lock).not.toHaveBeenCalled();
  });
  it("keeps the conversion until all its bounded receipt batches have been drained", async () => {
    mocks.remainingReceipt.mockResolvedValue({ id: "receipt_still_pending" });
    expect(await pruneWorkspaceBatch("ws_test", now, true, 1)).toMatchObject({
      receipts: 1,
      conversions: 0,
      remainingReceipts: true,
    });
    expect(mocks.receipts).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
    expect(mocks.deleteConversions).not.toHaveBeenCalled();
  });
  it("drains bounded merchant retry receipts before removing their parent", async () => {
    mocks.merchantSubmissions.mockResolvedValue([{ id: "mcv_old" }]);
    mocks.merchantReceipts.mockResolvedValue([{ id: "mcr_old" }]);
    mocks.deleteMerchantReceipts.mockResolvedValue({ count: 1 });
    mocks.remainingMerchantReceipt.mockResolvedValue({ id: "mcr_remaining" });
    const result = await pruneWorkspaceBatch("ws_test", now, true, 1);
    expect(result).toMatchObject({
      merchantReceipts: 1,
      merchantSubmissions: 0,
      remainingMerchantReceipts: true,
    });
    expect(mocks.deleteMerchantSubmissions).not.toHaveBeenCalled();
    expect(mocks.deleteMerchantReceipts).toHaveBeenCalledWith({
      where: {
        projectId: "ws_test",
        submissionId: { in: ["mcv_old"] },
        id: { in: ["mcr_old"] },
      },
    });
  });
  it("uses current shorter policy even for suspended workspaces", async () => {
    mocks.workspace.mockResolvedValue({ routeverityRetentionDays: 30 });
    await pruneWorkspaceBatch("ws_test", now, true);
    expect(mocks.workspace).toHaveBeenCalledWith({
      where: { id: "ws_test" },
      select: { routeverityRetentionDays: true },
    });
    expect(mocks.clicks).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: "ws_test",
          timestamp: { lt: new Date("2026-09-08T01:00:00.000Z") },
        },
      }),
    );
  });
  it("explicitly applies the 90-day maximum to orphaned historical evidence", async () => {
    mocks.workspace.mockResolvedValue(null);
    expect(await pruneWorkspaceBatch("ws_deleted", now, true)).toMatchObject({
      orphanedWorkspace: true,
      retentionDays: 90,
    });
  });
  it("paginates all workspaces and expired orphan evidence without exposing IDs in telemetry", async () => {
    mocks.raw.mockResolvedValue([{ id: "ws_test" }]);
    expect(await retentionWorkspacePage(now, "ws_previous", 2)).toEqual([
      { id: "ws_test" },
    ]);
    const query = mocks.raw.mock.calls[0][0];
    expect(query.sql).toContain("UNION");
    expect(query.sql).toContain("receivedAt <");
    expect(query.sql).toContain("ORDER BY id ASC LIMIT");
    expect(query.values).toEqual([
      cutoff90,
      cutoff90,
      cutoff90,
      "ws_previous",
      2,
    ]);
  });
  it("does not swallow failure after receipt deletion; the transaction rejects", async () => {
    mocks.deleteConversions.mockRejectedValueOnce(new Error("database failed"));
    await expect(pruneWorkspaceBatch("ws_test", now, true)).rejects.toThrow(
      "database failed",
    );
    expect(mocks.deleteClicks).not.toHaveBeenCalled();
  });
  it("clears 24-hour raw input without changing integrity or dimensions; expires only older operator audits", async () => {
    await pruneGlobalBatch(now, true, 2);
    expect(mocks.clearAgents).toHaveBeenCalledWith({
      where: {
        timestamp: { lte: new Date("2026-10-07T01:00:00.000Z") },
        rawUserAgent: { not: null },
        clickId: { in: ["rvc_expired"] },
      },
      data: { rawUserAgent: null },
    });
    expect(mocks.deleteOperators).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: new Date("2025-10-08T01:00:00.000Z") },
        id: { in: ["audit_expired"] },
      },
    });
  });
});

describe("owner retention settings", () => {
  it("requires confirmation when shortening retention", async () => {
    expect((await saveRetention("tenant", {}, form("30"))).error).toContain(
      "Confirm",
    );
    expect(mocks.lock).not.toHaveBeenCalled();
  });
  it("serializes settings against cleanup, scopes to enabled workspace and rechecks ownership", async () => {
    expect(
      (await saveRetention("tenant", {}, form("30", "90", true))).message,
    ).toContain("Retention saved");
    expect(mocks.lock).toHaveBeenCalledWith({
      where: { id: "ws_test", disabledAt: null, routeverityRetentionDays: 90 },
      data: { routeverityRetentionDays: 30, updatedAt: expect.any(Date) },
    });
    expect(mocks.member).toHaveBeenLastCalledWith({
      where: { projectId: "ws_test", userId: "user_owner" },
      select: { role: true },
    });
  });
  it.each(["member", "viewer", "billing"])(
    "denies the %s role before writing",
    async (role) => {
      mocks.member.mockResolvedValue({ role, project: { id: "ws_test" } });
      expect((await saveRetention("tenant", {}, form())).error).toContain(
        "permission",
      );
      expect(mocks.lock).not.toHaveBeenCalled();
    },
  );
  it("denies foreign/missing membership before writing", async () => {
    mocks.member.mockResolvedValue(null);
    expect((await saveRetention("tenant", {}, form())).error).toContain(
      "permission",
    );
    expect(mocks.lock).not.toHaveBeenCalled();
  });
  it("rejects a changed policy or suspended workspace", async () => {
    mocks.lock.mockResolvedValue({ count: 0 });
    expect((await saveRetention("tenant", {}, form())).error).toContain(
      "Refresh",
    );
  });
  it("rejects ownership revocation inside the same transaction", async () => {
    mocks.member
      .mockResolvedValueOnce({ role: "owner", project: { id: "ws_test" } })
      .mockResolvedValueOnce({ role: "member" });
    expect((await saveRetention("tenant", {}, form())).error).toContain(
      "no longer",
    );
  });
});
