import { conversionIngestion } from "@/lib/routeverity/conversion-ingestion";
import { issueConversionKey } from "@/lib/routeverity/conversion-policy";
import { fingerprint } from "@/lib/routeverity/transparent-policy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  key: vi.fn(),
  allow: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
  currentKey: vi.fn(),
  receipt: vi.fn(),
  click: vi.fn(),
  goal: vi.fn(),
  existing: vi.fn(),
  create: vi.fn(),
  createReceipt: vi.fn(),
  merchantReservation: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    routeVerityConversionKey: { findUnique: mocks.key },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({ allowRequest: mocks.allow }));
const key = issueConversionKey();
const input = {
  click_id: "rvc_12345678-1234-1234-1234-123456789abc",
  event: "purchase",
  order_id: "ORDER-1",
  revenue: "10.25",
  currency: "GBP",
};
function request(
  body: unknown = input,
  token = key.token,
  idempotency = "first",
) {
  return new Request("http://localhost:8888/api/v1/conversions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "idempotency-key": idempotency,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.key.mockResolvedValue({
    id: key.id,
    projectId: "ws_owned",
    revokedAt: null,
  });
  mocks.allow.mockResolvedValue(true);
  mocks.lock.mockResolvedValue({ count: 1 });
  mocks.currentKey.mockResolvedValue({ id: key.id });
  mocks.receipt.mockResolvedValue(null);
  mocks.click.mockResolvedValue({
    clickId: input.click_id,
    campaignId: "cmp_owned",
    timestamp: new Date(Date.now() - 1000),
    providedNextHopHash: fingerprint("https://example.com"),
    validatedNextHopHash: fingerprint("https://example.com"),
    actualRedirectTargetHash: fingerprint("https://example.com"),
    redirectStatus: 302,
    validationResult: "ALLOWED",
  });
  mocks.goal.mockResolvedValue({
    id: "cvg_owned",
    currency: "GBP",
    enabled: true,
  });
  mocks.existing.mockResolvedValue(null);
  mocks.merchantReservation.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "cnv_created" });
  mocks.transaction.mockImplementation((operation) =>
    operation({
      project: { updateMany: mocks.lock },
      routeVerityConversionKey: { findFirst: mocks.currentKey },
      routeVerityConversionReceipt: {
        findUnique: mocks.receipt,
        create: mocks.createReceipt,
      },
      routeVerityRedirectAudit: { findFirst: mocks.click },
      routeVerityConversionGoal: { findUnique: mocks.goal },
      routeVerityConversion: {
        findUnique: mocks.existing,
        create: mocks.create,
      },
      routeVerityMerchantSubmission: { findUnique: mocks.merchantReservation },
    }),
  );
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("conversion ingestion", () => {
  it("creates a tenant-owned, exact-money immutable conversion and receipt in one transaction", async () => {
    const response = await conversionIngestion(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      conversion_id: "cnv_created",
      duplicate: false,
    });
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      projectId: "ws_owned",
      campaignId: "cmp_owned",
      clickId: input.click_id,
      goalId: "cvg_owned",
      attributionPolicy: "direct-click-30d-v1",
    });
    expect(mocks.create.mock.calls[0][0].data.revenue.toFixed(3)).toBe(
      "10.250",
    );
    expect(mocks.createReceipt).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("returns the same ID for exact retries and rejects changed idempotency payloads", async () => {
    await conversionIngestion(request());
    const saved = mocks.createReceipt.mock.calls[0][0].data;
    mocks.receipt.mockResolvedValue(saved);
    expect((await conversionIngestion(request())).status).toBe(200);
    expect(
      (await conversionIngestion(request({ ...input, revenue: "11" }))).status,
    ).toBe(409);
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("deduplicates across idempotency keys by goal/order and rejects changed references", async () => {
    await conversionIngestion(request());
    const saved = mocks.create.mock.calls[0][0].data;
    mocks.existing.mockResolvedValue({ ...saved, id: "cnv_created" });
    expect(
      (await conversionIngestion(request(input, key.token, "second"))).status,
    ).toBe(200);
    expect(
      (
        await conversionIngestion(
          request({ ...input, revenue: "12" }, key.token, "third"),
        )
      ).status,
    ).toBe(409);
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it.each([
    ["missing key", () => mocks.key.mockResolvedValue(null), 401],
    [
      "revoked key",
      () => mocks.key.mockResolvedValue({ revokedAt: new Date() }),
      401,
    ],
    [
      "workspace suspended",
      () => mocks.lock.mockResolvedValue({ count: 0 }),
      403,
    ],
    ["foreign click", () => mocks.click.mockResolvedValue(null), 404],
    ["missing goal", () => mocks.goal.mockResolvedValue(null), 404],
    [
      "disabled goal",
      () =>
        mocks.goal.mockResolvedValue({
          id: "goal",
          currency: "GBP",
          enabled: false,
        }),
      403,
    ],
    [
      "currency mismatch",
      () =>
        mocks.goal.mockResolvedValue({
          id: "goal",
          currency: "EUR",
          enabled: true,
        }),
      400,
    ],
    ["rate limit", () => mocks.allow.mockResolvedValue(false), 429],
  ] as const)("fails explicitly on %s", async (_name, configure, status) => {
    configure();
    expect((await conversionIngestion(request())).status).toBe(status);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("accepts authenticated GET scalars but rejects duplicate/query credentials and metadata", async () => {
    const query = new URLSearchParams({
      ...input,
      idempotency_key: "get-key",
    }).toString();
    const headers = { authorization: `Bearer ${key.token}` };
    expect(
      (
        await conversionIngestion(
          new Request(`http://localhost:8888/conversion?${query}`, { headers }),
        )
      ).status,
    ).toBe(201);
    for (const extra of [
      "&event=lead",
      "&%65vent=lead",
      "&api_key=secret",
      "&metadata=%7B%7D",
    ]) {
      expect(
        (
          await conversionIngestion(
            new Request(`http://localhost:8888/conversion?${query}${extra}`, {
              headers,
            }),
          )
        ).status,
      ).toBe(400);
    }
  });
  it("rejects a tracking credential and missing idempotency key", async () => {
    expect(
      (await conversionIngestion(request(input, "rvt_" + "a".repeat(43))))
        .status,
    ).toBe(401);
    expect(
      (await conversionIngestion(request(input, key.token, ""))).status,
    ).toBe(400);
  });
  it("enforces body byte bounds and JSON uniqueness", async () => {
    const headers = {
      authorization: `Bearer ${key.token}`,
      "idempotency-key": "body",
      "content-type": "application/json",
    };
    expect(
      (
        await conversionIngestion(
          new Request("http://localhost:8888/api/v1/conversions", {
            method: "POST",
            headers,
            body: "a".repeat(16385),
          }),
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await conversionIngestion(
          new Request("http://localhost:8888/api/v1/conversions", {
            method: "POST",
            headers,
            body: '{"event":"lead","event":"sale"}',
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("does not fake success or leak references on dependency failure", async () => {
    mocks.create.mockRejectedValue(
      new Error("private customer reference secret"),
    );
    const response = await conversionIngestion(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "private customer",
    );
    expect(mocks.createReceipt).not.toHaveBeenCalled();
  });
  it.each(["HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"])(
    "does not create events for %s",
    async (method) => {
      const response = await conversionIngestion(
        new Request("http://localhost:8888/api/v1/conversions", { method }),
      );
      expect(response.status).toBe(405);
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
});
