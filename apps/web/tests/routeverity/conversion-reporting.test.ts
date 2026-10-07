import {
  conversionDays,
  conversionQuery,
  conversionWhere,
  parseConversionFilters,
} from "@/lib/routeverity/conversion-reporting";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
describe("conversion reporting boundaries", () => {
  it("queries owned events by occurrence time with exclusive next-day end", () => {
    const filters = parseConversionFilters({
      from: "2026-10-01",
      to: "2026-10-02",
      campaign: "cmp_owned",
      goal: "cvg_owned",
      page: "2",
    });
    expect(conversionWhere("ws_owned", filters)).toEqual({
      projectId: "ws_owned",
      campaignId: "cmp_owned",
      goalId: "cvg_owned",
      occurredAt: {
        gte: new Date("2026-10-01T00:00:00Z"),
        lt: new Date("2026-10-03T00:00:00Z"),
      },
    });
    expect(conversionQuery(filters, 3).get("page")).toBe("3");
  });
  it("zero-fills days and preserves decimal currency separation", () => {
    const filters = parseConversionFilters({
      from: "2026-10-01",
      to: "2026-10-02",
    });
    const days = conversionDays(
      filters,
      [
        {
          day: "2026-10-01",
          currency: "GBP",
          count: BigInt(2),
          revenue: new Prisma.Decimal("0.3"),
        },
        {
          day: "2026-10-01",
          currency: "EUR",
          count: BigInt(1),
          revenue: new Prisma.Decimal("1.2"),
        },
      ],
      ["EUR", "GBP"],
    );
    expect(days.map((day) => day.count)).toEqual([3, 0]);
    expect(
      days[0].revenue.map((row) => `${row.currency}:${row.amount.toFixed(3)}`),
    ).toEqual(["EUR:1.200", "GBP:0.300"]);
    expect(days[1].revenue.map((row) => row.amount.toFixed(3))).toEqual([
      "0.000",
      "0.000",
    ]);
  });
  it.each([
    { goal: ["a", "b"] },
    { goal: "x".repeat(101) },
    { revenue: "1" },
    { from: "2026-02-30" },
    { page: "0" },
  ])("rejects invalid report filters %j", (input) => {
    expect(() => parseConversionFilters(input)).toThrow();
  });
});
