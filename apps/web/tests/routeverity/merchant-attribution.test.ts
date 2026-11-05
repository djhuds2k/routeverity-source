import {
  captureMerchantGclid,
  resolveMerchantCandidate,
} from "@/lib/routeverity/merchant-attribution";
import { fingerprint } from "@/lib/routeverity/transparent-policy";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  candidates: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));
const now = new Date("2026-10-17T12:00:00Z");
const input = {
  projectId: "ws_owned",
  campaignId: "cmp_owned_123",
  gclidHash: fingerprint("merchant_fixture_id"),
  occurredAt: now,
};
const record = {
  clickId: "rvc_12345678-1234-1234-1234-123456789abc",
  providedNextHopHash: fingerprint("https://merchant.example.com"),
  validatedNextHopHash: fingerprint("https://merchant.example.com"),
  actualRedirectTargetHash: fingerprint("https://merchant.example.com"),
  validationResult: "ALLOWED",
  redirectStatus: 302,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.workspace.mockResolvedValue({ id: input.projectId });
  mocks.candidates.mockResolvedValue([record]);
  mocks.transaction.mockImplementation((operation) =>
    operation({
      project: { findFirst: mocks.workspace },
      routeVerityRedirectAudit: { findMany: mocks.candidates },
    }),
  );
});

describe("first-party merchant capture", () => {
  it("hashes only the exact GCLID observed in the merchant landing query", () => {
    const result = captureMerchantGclid(
      "?product=1&gclid=Case_Sensitive-123",
      "granted",
    );
    expect(result).toEqual({
      status: "READY",
      gclidHash: fingerprint("Case_Sensitive-123"),
    });
    expect(JSON.stringify(result)).not.toContain("Case_Sensitive-123");
  });
  it.each(["denied", "unknown"])(
    "does not parse identifiers when consent is %s",
    (consent) => {
      expect(captureMerchantGclid("?gclid=%ZZ".repeat(2000), consent)).toEqual({
        status: "CONSENT_NOT_GRANTED",
      });
    },
  );
  it("rejects invalid consent rather than treating it as permission", () => {
    expect(() => captureMerchantGclid("?gclid=fixture", true)).toThrow(
      "INVALID_MEASUREMENT_CONSENT",
    );
  });
  it.each(["", "?product=1", "?gclid=", "?gbraid=braid", "?wbraid=braid"])(
    "does not invent missing GCLID from %s",
    (query) =>
      expect(captureMerchantGclid(query, "granted")).toEqual({
        status: "MISSING_IDENTIFIER",
      }),
  );
  it.each(["?gclid=a&gclid=a", "?gclid=a&%67clid=b", "?gclid=&gclid=a"])(
    "rejects repeated identifiers, even equal or encoded names: %s",
    (query) =>
      expect(captureMerchantGclid(query, "granted")).toEqual({
        status: "AMBIGUOUS_IDENTIFIER",
      }),
  );
  it.each([
    "?gclid=%ZZ",
    "?gclid=a+b",
    "?gclid=%0A",
    `?gclid=${"a".repeat(513)}`,
  ])("rejects malformed/unsupported identifier %s", (query) =>
    expect(() => captureMerchantGclid(query, "granted")).toThrow(
      "INVALID_MERCHANT_IDENTIFIER",
    ),
  );
  it("does not link independent browser contexts without a shared landing identifier", () => {
    expect(captureMerchantGclid("?gclid=browser_a", "granted").status).toBe(
      "READY",
    );
    expect(captureMerchantGclid("", "granted").status).toBe(
      "MISSING_IDENTIFIER",
    );
  });
});

describe("recorded-request candidate resolution", () => {
  it("uses tenant/campaign, exact hash and inclusive occurrence window with a two-row bound", async () => {
    expect(await resolveMerchantCandidate(input, now)).toEqual({
      status: "MATCHED_RECORDED_REQUEST",
      clickId: record.clickId,
    });
    expect(mocks.candidates).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: input.projectId,
          campaignId: input.campaignId,
          validationResult: "ALLOWED",
          redirectStatus: 302,
          googleAds: { path: "$.gclidHash", equals: input.gclidHash },
          timestamp: { gte: new Date("2026-09-17T12:00:00Z"), lte: now },
        },
        take: 2,
      }),
    );
  });
  it("reports unavailable evidence and resolves only after a delayed click becomes visible", async () => {
    mocks.candidates.mockResolvedValueOnce([]).mockResolvedValueOnce([record]);
    expect(await resolveMerchantCandidate(input, now)).toEqual({
      status: "NO_RECORDED_MATCH",
    });
    expect((await resolveMerchantCandidate(input, now)).status).toBe(
      "MATCHED_RECORDED_REQUEST",
    );
  });
  it("does not guess between repeated GCLIDs, including concurrent readers", async () => {
    mocks.candidates.mockResolvedValue([
      record,
      { ...record, clickId: "another" },
    ]);
    const results = await Promise.all([
      resolveMerchantCandidate(input, now),
      resolveMerchantCandidate(input, now),
    ]);
    expect(results).toEqual([
      { status: "AMBIGUOUS_IDENTIFIER" },
      { status: "AMBIGUOUS_IDENTIFIER" },
    ]);
  });
  it("fails explicitly when the workspace is absent or suspended", async () => {
    mocks.workspace.mockResolvedValue(null);
    await expect(resolveMerchantCandidate(input, now)).rejects.toMatchObject({
      status: 403,
      code: "WORKSPACE_UNAVAILABLE",
    });
    expect(mocks.candidates).not.toHaveBeenCalled();
  });
  it("rejects corrupt persisted integrity", async () => {
    mocks.candidates.mockResolvedValue([
      { ...record, actualRedirectTargetHash: "b".repeat(64) },
    ]);
    await expect(resolveMerchantCandidate(input, now)).rejects.toMatchObject({
      status: 422,
      code: "CLICK_INTEGRITY_INVALID",
    });
  });
  it("does not turn a failed database read into no match", async () => {
    const failure = new Error("database unavailable");
    mocks.candidates.mockRejectedValue(failure);
    await expect(resolveMerchantCandidate(input, now)).rejects.toBe(failure);
  });
  it.each([
    { ...input, gclidHash: "raw_identifier" },
    { ...input, occurredAt: new Date("invalid") },
    { ...input, occurredAt: new Date(now.getTime() + 1) },
  ])("rejects invalid context without querying", async (context) => {
    await expect(resolveMerchantCandidate(context, now)).rejects.toThrow(
      "INVALID_MERCHANT_CONTEXT",
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
