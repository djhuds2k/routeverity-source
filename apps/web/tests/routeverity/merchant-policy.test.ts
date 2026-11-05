import {
  merchantReconciliationMs,
  merchantRetryMs,
  parseMerchantPayload,
} from "@/lib/routeverity/merchant-policy";
import { fingerprint } from "@/lib/routeverity/transparent-policy";
import { describe, expect, it } from "vitest";

const now = new Date("2026-10-17T15:00:00Z");
const input = {
  campaign_id: "cmp_merchant_fixture",
  event: "purchase",
  order_id: "ORDER-fixture",
  revenue: "12.50",
  currency: "GBP",
  timestamp: "2026-10-17T14:00:00Z",
  measurement_consent: "granted",
  gclid_hash: fingerprint("raw_private_identifier_fixture"),
};
describe("minimal merchant submission policy", () => {
  it("canonicalizes money and timestamp without retaining raw identifiers or freeform data", () => {
    const payload = parseMerchantPayload(input, now);
    expect(payload.revenue).toBe("12.500");
    expect(payload.timestamp).toBe("2026-10-17T14:00:00.000Z");
    expect(payload.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(payload)).not.toContain(
      "raw_private_identifier_fixture",
    );
    expect(payload).not.toHaveProperty("metadata");
    expect(payload).not.toHaveProperty("customer_reference");
    expect(
      parseMerchantPayload(
        {
          ...input,
          revenue: "12.500",
          timestamp: "2026-10-17T15:00:00+01:00",
        },
        now,
      ).payloadHash,
    ).toBe(payload.payloadHash);
  });
  it("accepts explicitly missing identifier for terminal unmatched reporting", () => {
    const { gclid_hash, ...missing } = input;
    expect(gclid_hash).toBeDefined();
    expect(parseMerchantPayload(missing, now).gclid_hash).toBeNull();
  });
  it.each(["denied", "unknown"])(
    "does not accept measurement when consent is %s",
    (measurement_consent) => {
      expect(() =>
        parseMerchantPayload({ ...input, measurement_consent }, now),
      ).toThrow("MEASUREMENT_CONSENT_REQUIRED");
    },
  );
  it.each([
    { gclid: "raw_private_id" },
    { gbraid: "unsupported_braid" },
    { gclid_hash: "raw_id" },
    { gclid_hash: "A".repeat(64) },
    { customer_reference: "not minimal" },
    { metadata: { arbitrary: "not minimal" } },
    { click_id: "rvc_other" },
    { measurement_consent: true },
    { campaign_id: "cmp_short" },
    { revenue: "-1" },
    { revenue: "0.001" },
    { currency: "gbp" },
    { timestamp: "2026-02-30T00:00:00Z" },
    { timestamp: "2026-10-17T15:00:00.001Z" },
    { timestamp: undefined },
  ])("rejects invalid or excessive capture %j", (change) => {
    expect(() => parseMerchantPayload({ ...input, ...change }, now)).toThrow();
  });
  it("bounds reconciliation from first receipt, independently of the click window", () => {
    expect(merchantReconciliationMs).toBe(24 * 60 * 60_000);
    expect(merchantRetryMs).toBe(5 * 60_000);
  });
});
