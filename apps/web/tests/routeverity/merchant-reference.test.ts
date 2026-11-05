import { captureMerchantGclid as captureInternal } from "@/lib/routeverity/merchant-attribution";
import { parseMerchantPayload } from "@/lib/routeverity/merchant-policy";
import { describe, expect, it, vi } from "vitest";
import {
  captureMerchantGclid,
  prepareMerchantConversion,
} from "../../../../examples/merchant-reference/client.mjs";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

describe("standalone merchant reference parity with current API policy", () => {
  it.each([
    "",
    "?gclid=",
    "?gbraid=braid",
    "?gclid=Case_Sensitive-123",
    "?gclid=a&gclid=a",
    "?gclid=a&%67clid=b",
    "?gclid=a+b",
    "?gclid=%ZZ",
    `?gclid=${"a".repeat(513)}`,
  ])("uses the same capture outcome for %s", (query) => {
    for (const consent of ["granted", "denied", "unknown"]) {
      let expected;
      try {
        expected = captureInternal(query, consent);
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        expect(() => captureMerchantGclid(query, consent)).toThrow(
          error.message,
        );
        continue;
      }
      expect(captureMerchantGclid(query, consent)).toEqual(expected);
    }
  });

  it.each(["?gclid=reference_fixture", ""])(
    "produces a payload accepted by actual merchant policy for %s",
    (query) => {
      const envelope = prepareMerchantConversion(
        {
          campaign_id: "cmp_reference_123",
          event: "purchase",
          order_id: "REFERENCE-1",
          revenue: "99.99",
          currency: "GBP",
          timestamp: "2026-10-17T12:00:00Z",
        },
        captureMerchantGclid(query, "granted"),
        "granted",
      );
      expect(envelope.status).toBe("READY");
      if (!("body" in envelope)) throw new Error("EXPECTED_READY_ENVELOPE");
      const payload: unknown = JSON.parse(envelope.body);
      const parsed = parseMerchantPayload(
        payload,
        new Date("2026-10-18T12:00:00Z"),
      );
      expect(parsed.revenue).toBe("99.990");
      expect(parsed.timestamp).toBe("2026-10-17T12:00:00.000Z");
      expect(parsed.measurement_consent).toBe("granted");
      expect(parsed.gclid_hash === null).toBe(query === "");
    },
  );
});
