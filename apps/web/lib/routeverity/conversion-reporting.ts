import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AnalyticsInputError, parseAnalyticsFilters } from "./click-reporting";

export function parseConversionFilters(
  input: Record<string, string | string[] | undefined>,
) {
  if (
    Object.keys(input).some(
      (key) => !["from", "to", "campaign", "goal", "page"].includes(key),
    ) ||
    (input.goal !== undefined &&
      (typeof input.goal !== "string" || input.goal.length > 100))
  )
    throw new AnalyticsInputError(
      "Invalid conversion filters. Use single UTC dates, campaign and goal values.",
    );
  const { goal, ...common } = input;
  const dates = parseAnalyticsFilters(common);
  return { ...dates, goal: typeof goal === "string" ? goal : undefined };
}
export type ConversionFilters = ReturnType<typeof parseConversionFilters>;
export function conversionQuery(filters: ConversionFilters, page = 1) {
  return new URLSearchParams(
    Object.entries({
      from: filters.from,
      to: filters.to,
      campaign: filters.campaign,
      goal: filters.goal,
      page: String(page),
    }).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1] !== "",
    ),
  );
}

export function conversionWhere(
  projectId: string,
  filters: ConversionFilters,
): Prisma.RouteVerityConversionWhereInput {
  return {
    projectId,
    occurredAt: { gte: filters.fromDate, lt: filters.untilDate },
    ...(filters.campaign ? { campaignId: filters.campaign } : {}),
    ...(filters.goal ? { goalId: filters.goal } : {}),
  };
}
export function conversionDays(
  filters: ConversionFilters,
  daily: {
    day: string;
    currency: string;
    count: bigint;
    revenue: Prisma.Decimal;
  }[],
  currencies: string[],
) {
  const days = [];
  for (
    let time = filters.fromDate.getTime();
    time < filters.untilDate.getTime();
    time += 86400000
  ) {
    const day = new Date(time).toISOString().slice(0, 10);
    const rows = daily.filter((row) => row.day === day);
    days.push({
      day,
      count: rows.reduce((sum, row) => sum + Number(row.count), 0),
      revenue: currencies.map((currency) => ({
        currency,
        amount:
          rows.find((row) => row.currency === currency)?.revenue ??
          new Prisma.Decimal(0),
      })),
    });
  }
  return days;
}
export async function loadConversionReport(
  projectId: string,
  filters: ConversionFilters,
) {
  const where = conversionWhere(projectId, filters);
  const conditions = [
    Prisma.sql`projectId = ${projectId}`,
    Prisma.sql`occurredAt >= ${filters.fromDate} AND occurredAt < ${filters.untilDate}`,
  ];
  if (filters.campaign)
    conditions.push(Prisma.sql`campaignId = ${filters.campaign}`);
  if (filters.goal) conditions.push(Prisma.sql`goalId = ${filters.goal}`);
  return prisma.$transaction(
    async (tx) => {
      const [total, rows, revenue, goals, daily] = await Promise.all([
        tx.routeVerityConversion.count({ where }),
        tx.routeVerityConversion.findMany({
          where,
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          take: 50,
          skip: (filters.pageNumber - 1) * 50,
        }),
        tx.routeVerityConversion.groupBy({
          by: ["currency"],
          where,
          _sum: { revenue: true },
          _count: { _all: true },
          orderBy: { currency: "asc" },
        }),
        tx.routeVerityConversion.groupBy({
          by: ["goalId", "event", "currency"],
          where,
          _sum: { revenue: true },
          _count: { _all: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),
        tx.$queryRaw<
          {
            day: string;
            currency: string;
            count: bigint;
            revenue: Prisma.Decimal;
          }[]
        >(Prisma.sql`
        SELECT DATE_FORMAT(occurredAt, '%Y-%m-%d') AS day, currency, COUNT(*) AS count, SUM(revenue) AS revenue
        FROM RouteVerityConversion WHERE ${Prisma.join(conditions, " AND ")}
        GROUP BY day, currency ORDER BY day ASC, currency ASC`),
      ]);
      return {
        total,
        rows,
        revenue,
        goals,
        daily,
        days: conversionDays(
          filters,
          daily,
          revenue.map((row) => row.currency),
        ),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 10000,
    },
  );
}
