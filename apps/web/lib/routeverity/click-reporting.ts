import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { normalizeDestinationHostname } from "./campaign-policy";

export class AnalyticsInputError extends Error {}
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Enter a real UTC date.");
const filtersSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    campaign: z.string().max(100).optional(),
    hostname: z.string().max(253).optional(),
    device: z.string().max(80).optional(),
    browser: z.string().max(80).optional(),
    os: z.string().max(80).optional(),
    page: z
      .string()
      .regex(/^[1-9]\d{0,3}$/)
      .default("1"),
  })
  .strict();

export function parseAnalyticsFilters(
  input: Record<string, string | string[] | undefined>,
  now = new Date(),
) {
  const today = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 6);
  const parsed = filtersSchema.safeParse({
    ...input,
    from: input.from || start.toISOString().slice(0, 10),
    to: input.to || today,
  });
  if (!parsed.success)
    throw new AnalyticsInputError(
      "Invalid analytics filters. Use single values and real UTC dates.",
    );
  const value = parsed.data;
  const from = new Date(`${value.from}T00:00:00Z`);
  const until = new Date(`${value.to}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + 1);
  if (until <= from || until.getTime() - from.getTime() > 93 * 86400000)
    throw new AnalyticsInputError(
      "Select an ordered UTC range of at most 93 days.",
    );
  const hostname = value.hostname
    ? normalizeDestinationHostname(value.hostname)
    : undefined;
  if (value.hostname && !hostname)
    throw new AnalyticsInputError(
      "Enter a public destination hostname, not a URL.",
    );
  return {
    ...value,
    hostname: hostname || undefined,
    fromDate: from,
    untilDate: until,
    pageNumber: Number(value.page),
  };
}
export type AnalyticsFilters = ReturnType<typeof parseAnalyticsFilters>;

export function analyticsWhere(
  projectId: string,
  filters: AnalyticsFilters,
): Prisma.RouteVerityRedirectAuditWhereInput {
  return {
    projectId,
    timestamp: { gte: filters.fromDate, lt: filters.untilDate },
    validationResult: "ALLOWED",
    redirectStatus: 302,
    ...(filters.campaign ? { campaignId: filters.campaign } : {}),
    ...(filters.hostname ? { destinationHostname: filters.hostname } : {}),
    ...(filters.device ? { device: filters.device } : {}),
    ...(filters.browser ? { browser: filters.browser } : {}),
    ...(filters.os ? { operatingSystem: filters.os } : {}),
  };
}

export function analyticsQuery(filters: AnalyticsFilters, page = 1) {
  return new URLSearchParams(
    Object.entries({
      from: filters.from,
      to: filters.to,
      campaign: filters.campaign,
      hostname: filters.hostname,
      device: filters.device,
      browser: filters.browser,
      os: filters.os,
      page: String(page),
    }).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1] !== "",
    ),
  );
}

export async function loadClickReport(
  projectId: string,
  filters: AnalyticsFilters,
) {
  const where = analyticsWhere(projectId, filters);
  const conditions = [
    Prisma.sql`projectId = ${projectId}`,
    Prisma.sql`timestamp >= ${filters.fromDate} AND timestamp < ${filters.untilDate}`,
    Prisma.sql`validationResult = 'ALLOWED' AND redirectStatus = 302`,
  ];
  if (filters.campaign)
    conditions.push(Prisma.sql`campaignId = ${filters.campaign}`);
  if (filters.hostname)
    conditions.push(Prisma.sql`destinationHostname = ${filters.hostname}`);
  if (filters.device) conditions.push(Prisma.sql`device = ${filters.device}`);
  if (filters.browser)
    conditions.push(Prisma.sql`browser = ${filters.browser}`);
  if (filters.os) conditions.push(Prisma.sql`operatingSystem = ${filters.os}`);
  return prisma.$transaction(
    async (tx) => {
      const [
        total,
        enriched,
        captured,
        metrics,
        clicks,
        daily,
        campaigns,
        devices,
        browsers,
        systems,
        referrers,
      ] = await Promise.all([
        tx.routeVerityRedirectAudit.count({ where }),
        tx.routeVerityRedirectAudit.count({
          where: { ...where, enrichedAt: { not: null } },
        }),
        tx.routeVerityRedirectAudit.count({
          where: { ...where, analyticsCaptured: true },
        }),
        tx.routeVerityRedirectAudit.aggregate({
          where,
          _avg: { processingTimeMs: true },
        }),
        tx.routeVerityRedirectAudit.findMany({
          where,
          orderBy: [{ timestamp: "desc" }, { clickId: "desc" }],
          take: 50,
          skip: (filters.pageNumber - 1) * 50,
          select: clickSummarySelect,
        }),
        tx.$queryRaw<{ day: string; count: bigint }[]>(Prisma.sql`
        SELECT DATE_FORMAT(timestamp, '%Y-%m-%d') AS day, COUNT(*) AS count
        FROM RouteVerityRedirectAudit WHERE ${Prisma.join(conditions, " AND ")}
        GROUP BY day ORDER BY day ASC`),
        tx.routeVerityRedirectAudit.groupBy({
          by: ["campaignId"],
          where,
          _count: { _all: true },
          orderBy: { _count: { campaignId: "desc" } },
          take: 10,
        }),
        tx.routeVerityRedirectAudit.groupBy({
          by: ["device"],
          where,
          _count: { _all: true },
          orderBy: { _count: { clickId: "desc" } },
          take: 10,
        }),
        tx.routeVerityRedirectAudit.groupBy({
          by: ["browser"],
          where,
          _count: { _all: true },
          orderBy: { _count: { clickId: "desc" } },
          take: 10,
        }),
        tx.routeVerityRedirectAudit.groupBy({
          by: ["operatingSystem"],
          where,
          _count: { _all: true },
          orderBy: { _count: { clickId: "desc" } },
          take: 10,
        }),
        tx.routeVerityRedirectAudit.groupBy({
          by: ["referrerHostname"],
          where,
          _count: { _all: true },
          orderBy: { _count: { clickId: "desc" } },
          take: 10,
        }),
      ]);
      const counts = new Map(daily.map((row) => [row.day, Number(row.count)]));
      const days: { day: string; count: number }[] = [];
      for (
        let date = new Date(filters.fromDate);
        date < filters.untilDate;
        date.setUTCDate(date.getUTCDate() + 1)
      ) {
        const day = date.toISOString().slice(0, 10);
        days.push({ day, count: counts.get(day) ?? 0 });
      }
      return {
        total,
        enriched,
        captured,
        averageDecisionMs: metrics._avg.processingTimeMs,
        clicks,
        days,
        campaigns,
        devices,
        browsers,
        systems,
        referrers,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 10000,
    },
  );
}

export const clickSummarySelect = {
  clickId: true,
  timestamp: true,
  campaignId: true,
  trackingDomain: true,
  destinationHostname: true,
  referrerHostname: true,
  device: true,
  browser: true,
  operatingSystem: true,
  enrichedAt: true,
  analyticsCaptured: true,
  processingTimeMs: true,
} satisfies Prisma.RouteVerityRedirectAuditSelect;

export function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
