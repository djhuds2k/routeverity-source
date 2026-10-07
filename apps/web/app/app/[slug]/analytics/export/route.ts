import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/routeverity/auth";
import {
  AnalyticsInputError,
  analyticsWhere,
  clickSummarySelect,
  csvCell,
  parseAnalyticsFilters,
} from "@/lib/routeverity/click-reporting";
import { allowRequest } from "@/lib/routeverity/rate-limit";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const { workspace, user } = await requireWorkspace(slug);
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const query: Record<string, string | string[]> = {};
    for (const [key, value] of new URL(request.url).searchParams) {
      const existing = query[key];
      query[key] =
        existing === undefined
          ? value
          : Array.isArray(existing)
            ? [...existing, value]
            : [existing, value];
    }
    const filters = parseAnalyticsFilters(query);
    if (!(await allowRequest("analytics-export", user.id, 10, 60)))
      return new Response("Too many exports. Please wait a minute.", {
        status: 429,
        headers,
      });
    const rows = await prisma.routeVerityRedirectAudit.findMany({
      where: analyticsWhere(workspace.id, filters),
      select: clickSummarySelect,
      orderBy: [{ timestamp: "desc" }, { clickId: "desc" }],
      take: 10001,
    });
    if (rows.length > 10000)
      return new Response(
        "Export exceeds 10,000 rows. Narrow the filters; no partial export was produced.",
        { status: 413, headers },
      );
    const columns = [
      "click_id",
      "timestamp_utc",
      "campaign_id",
      "tracking_domain",
      "destination_hostname",
      "referrer_hostname",
      "device",
      "browser",
      "os",
      "enrichment",
      "decision_ms",
    ];
    const csv = [
      columns.map(csvCell).join(","),
      ...rows.map((row) =>
        [
          row.clickId,
          row.timestamp.toISOString(),
          row.campaignId,
          row.trackingDomain,
          row.destinationHostname,
          row.referrerHostname,
          row.device,
          row.browser,
          row.operatingSystem,
          row.enrichedAt
            ? "Enriched"
            : row.analyticsCaptured
              ? "Pending"
              : "Legacy audit only",
          row.processingTimeMs,
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="routeverity-clicks.csv"',
      },
    });
  } catch (error) {
    if (error instanceof AnalyticsInputError)
      return new Response(error.message, { status: 400, headers });
    console.error(
      JSON.stringify({
        event: "routeverity.analytics.export.failed",
        error_type: error instanceof Error ? error.name : "unknown",
      }),
    );
    return new Response("Export failed. Retry or check the application logs.", {
      status: 503,
      headers,
    });
  }
}
