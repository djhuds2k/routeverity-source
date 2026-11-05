import { issueConversionKey } from "@/lib/routeverity/conversion-policy";
import {
  merchantConversionIngestion,
  reconcileMerchantBatch,
} from "@/lib/routeverity/merchant-ingestion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  key: vi.fn(),
  allow: vi.fn(),
  transaction: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    routeVerityConversionKey: { findUnique: mocks.key },
    $transaction: mocks.transaction,
    $queryRaw: mocks.query,
  },
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({ allowRequest: mocks.allow }));
const key = issueConversionKey();
const body = {
  campaign_id: "cmp_merchant_fixture",
  event: "purchase",
  order_id: "unit-order",
  revenue: "1.00",
  currency: "GBP",
  timestamp: "2026-10-17T10:00:00Z",
  measurement_consent: "granted",
};
function request(data: unknown = body, token = key.token) {
  return new Request("https://app.example.com/api/v1/merchant-conversions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": "unit-request",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.key.mockResolvedValue({
    id: key.id,
    projectId: "ws_unit",
    revokedAt: null,
  });
  mocks.allow.mockResolvedValue(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("merchant transport rejects explicitly before writes", () => {
  it.each(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"])(
    "rejects %s without authenticating",
    async (method) => {
      const response = await merchantConversionIngestion(
        new Request("https://app.example.com/api/v1/merchant-conversions", {
          method,
        }),
      );
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
      expect(mocks.key).not.toHaveBeenCalled();
    },
  );
  it("rejects tracking credentials", async () => {
    expect(
      (
        await merchantConversionIngestion(
          request(body, "rvt_not_a_conversion_key"),
        )
      ).status,
    ).toBe(401);
    expect(mocks.key).not.toHaveBeenCalled();
  });
  it("rejects revoked credentials before reading measurement data", async () => {
    mocks.key.mockResolvedValue({ revokedAt: new Date() });
    expect((await merchantConversionIngestion(request())).status).toBe(401);
    expect(mocks.allow).not.toHaveBeenCalled();
  });
  it("shares the existing workspace conversion rate limit", async () => {
    mocks.allow.mockResolvedValue(false);
    const response = await merchantConversionIngestion(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(mocks.allow).toHaveBeenCalledWith(
      "conversion-ingestion",
      "ws_unit",
      600,
      60,
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each(["denied", "unknown"])(
    "does not persist measurement with %s consent",
    async (measurement_consent) => {
      expect(
        (
          await merchantConversionIngestion(
            request({ ...body, measurement_consent }),
          )
        ).status,
      ).toBe(403);
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
  it("bounds input bytes and does not return a success-shaped dependency fallback", async () => {
    const large = await merchantConversionIngestion(
      request({ ...body, excess: "x".repeat(17000) }),
    );
    expect(large.status).toBe(413);
    expect(mocks.transaction).not.toHaveBeenCalled();
    mocks.transaction.mockRejectedValue(
      new Error("mysql://private-host/private-secret"),
    );
    const failed = await merchantConversionIngestion(request());
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({
      error: "MERCHANT_DEPENDENCY_UNAVAILABLE",
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "private-secret",
    );
  });
  it.each([0, 501, -1, 1.1])(
    "rejects invalid reconciliation batch %s",
    async (limit) => {
      await expect(reconcileMerchantBatch(new Date(), limit)).rejects.toThrow();
      expect(mocks.query).not.toHaveBeenCalled();
    },
  );
  it("propagates reconciliation SQL failure rather than reporting an empty queue", async () => {
    const failure = new Error("unavailable");
    mocks.query.mockRejectedValue(failure);
    await expect(reconcileMerchantBatch()).rejects.toBe(failure);
  });
});
