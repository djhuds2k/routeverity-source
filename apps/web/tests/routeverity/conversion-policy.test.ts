import {
  idempotencyHash,
  issueConversionKey,
  normalizeRevenue,
  parseConversionPayload,
  parseUniqueJson,
  validateConversionTime,
} from "@/lib/routeverity/conversion-policy";
import { describe, expect, it } from "vitest";

const input = {
  click_id: "rvc_12345678-1234-1234-1234-123456789abc",
  event: "purchase",
  order_id: "ORDER-1",
  currency: "GBP",
  revenue: "99.99",
};
describe("independent conversion boundaries", () => {
  it("normalizes exact amounts without float multiplication or currency mixing", () => {
    expect(normalizeRevenue("99.99", "GBP")).toBe("99.990");
    expect(normalizeRevenue(0.1, "GBP")).toBe("0.100");
    expect(normalizeRevenue("1.000", "JPY")).toBe("1.000");
    expect(normalizeRevenue("1.123", "KWD")).toBe("1.123");
    expect(normalizeRevenue("999999999999.99", "GBP")).toBe("999999999999.990");
  });
  it.each([
    ["-1", "GBP"],
    ["1e3", "GBP"],
    ["01", "GBP"],
    ["NaN", "GBP"],
    ["1.001", "GBP"],
    ["1.1", "JPY"],
    ["1.1234", "KWD"],
    ["1000000000000", "GBP"],
    [Infinity, "GBP"],
    ["1.00 ", "GBP"],
  ])("rejects invalid amount %s in %s", (amount, currency) => {
    expect(() => normalizeRevenue(amount, String(currency))).toThrow();
  });
  it("canonicalizes metadata key order, amount representation and equivalent timestamps for retries", () => {
    const first = parseConversionPayload({
      ...input,
      metadata: { b: 2, a: "one" },
      timestamp: "2026-10-07T12:00:00+01:00",
    });
    const second = parseConversionPayload({
      ...input,
      revenue: 99.99,
      metadata: { a: "one", b: 2 },
      timestamp: "2026-10-07T11:00:00Z",
    });
    expect(first.payloadHash).toBe(second.payloadHash);
    expect(parseConversionPayload(input).timestamp).toBeNull();
    expect(
      parseConversionPayload({ ...input, revenue: undefined }).revenue,
    ).toBe("0.000");
  });
  it.each([
    { currency: "gbp" },
    { currency: "ZZZ" },
    { event: "../purchase" },
    { click_id: "cmp_wrong" },
    { order_id: "" },
    { order_id: "a\nb" },
    { metadata: { nested: { object: true } } },
    {
      metadata: Object.fromEntries(
        Array.from({ length: 11 }, (_, index) => [`field${index}`, "x"]),
      ),
    },
    { metadata: { long: "x".repeat(201) } },
    {
      metadata: Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [
          `field${index}`,
          "é".repeat(200),
        ]),
      ),
    },
    { timestamp: "2026-02-30T00:00:00Z" },
    { unknown_field: "ignored?" },
  ])("rejects invalid bounded conversion input %j", (override) => {
    expect(() => parseConversionPayload({ ...input, ...override })).toThrow();
  });
  it("allows exactly 30 days, but rejects future, pre-click and over-window timestamps", () => {
    const click = new Date("2026-09-01T00:00:00Z");
    const now = new Date("2026-10-07T12:00:00Z");
    expect(() =>
      validateConversionTime(click, new Date("2026-10-01T00:00:00Z"), now),
    ).not.toThrow();
    for (const time of [
      "2026-10-01T00:00:00.001Z",
      "2026-08-31T23:59:59Z",
      "2026-10-08T00:00:00Z",
    ])
      expect(() =>
        validateConversionTime(click, new Date(time), now),
      ).toThrow();
  });
  it("rejects JSON duplicate fields, including escaped keys and nested metadata duplicates", () => {
    for (const text of [
      '{"event":"purchase","event":"lead"}',
      '{"event":"purchase","\\u0065vent":"lead"}',
      '{"metadata":{"a":1,"a":2}}',
    ])
      expect(() => parseUniqueJson(text)).toThrow("DUPLICATE_JSON_FIELD");
    expect(
      parseUniqueJson(
        '{"event":"purchase","metadata":{"text":"commas, brackets{}[] and escaped \\"quotes\\"","a":1}}',
      ),
    ).toMatchObject({ event: "purchase" });
  });
  it("issues scope-specific hash-only secrets and bounded idempotency hashes", () => {
    const key = issueConversionKey();
    expect(key.token).toMatch(/^rvcv_[A-Za-z0-9_-]{43}$/);
    expect(key.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(idempotencyHash("event:ORDER-1")).toHaveLength(64);
    for (const value of [null, "", "a,b", "x".repeat(121)])
      expect(() => idempotencyHash(value)).toThrow();
  });
});
