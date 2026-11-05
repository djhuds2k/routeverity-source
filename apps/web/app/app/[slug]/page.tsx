import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/routeverity/auth";
import { Prisma } from "@prisma/client";
import Link from "next/link";

export default async function Overview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace } = await requireWorkspace(slug);
  const [
    links,
    domains,
    campaigns,
    clicks,
    conversions,
    revenue,
    converted,
    linkedRevenue,
  ] = await prisma.$transaction(
    (tx) =>
      Promise.all([
        tx.link.count({ where: { projectId: workspace.id } }),
        tx.domain.count({ where: { projectId: workspace.id } }),
        tx.routeVerityCampaign.count({ where: { projectId: workspace.id } }),
        tx.routeVerityRedirectAudit.count({
          where: {
            projectId: workspace.id,
            validationResult: "ALLOWED",
            redirectStatus: 302,
          },
        }),
        tx.routeVerityConversion.count({
          where: { projectId: workspace.id },
        }),
        tx.routeVerityConversion.groupBy({
          by: ["currency"],
          where: { projectId: workspace.id },
          _sum: { revenue: true },
          orderBy: { currency: "asc" },
        }),
        tx.$queryRaw<{ count: bigint }[]>(
          Prisma.sql`
              SELECT COUNT(DISTINCT c.clickId) AS count
              FROM RouteVerityConversion c
              JOIN RouteVerityRedirectAudit a ON a.clickId = c.clickId AND a.projectId = c.projectId
              WHERE c.projectId = ${workspace.id}
                AND a.validationResult = 'ALLOWED' AND a.redirectStatus = 302
            `,
        ),
        tx.$queryRaw<{ currency: string; revenue: Prisma.Decimal }[]>(
          Prisma.sql`
              SELECT c.currency, SUM(c.revenue) AS revenue
              FROM RouteVerityConversion c
              JOIN RouteVerityRedirectAudit a ON a.clickId = c.clickId AND a.projectId = c.projectId
              WHERE c.projectId = ${workspace.id}
                AND a.validationResult = 'ALLOWED' AND a.redirectStatus = 302
              GROUP BY c.currency ORDER BY c.currency ASC
            `,
        ),
      ]),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 10000,
    },
  );
  return (
    <main className="rv-page rv-stack">
      <div>
        <h1>Overview</h1>
        <p className="rv-muted mt-2">
          Your advertising infrastructure, in one place. Event totals include
          retained records only; cleanup removes expired history.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Link href={`/app/${slug}/campaigns`} className="rv-card">
          <h2 className="rv-muted text-sm">Campaigns</h2>
          <p className="mt-3 text-3xl">{campaigns}</p>
        </Link>
        <Link href={`/app/${slug}/links`} className="rv-card">
          <h2 className="rv-muted text-sm">Links</h2>
          <p className="mt-3 text-3xl">{links}</p>
        </Link>
        <Link href={`/app/${slug}/domains`} className="rv-card">
          <h2 className="rv-muted text-sm">Domains</h2>
          <p className="mt-3 text-3xl">{domains}</p>
        </Link>
        <Link href={`/app/${slug}/analytics`} className="rv-card">
          <h2 className="rv-muted text-sm">Prepared redirects (retained)</h2>
          <p className="mt-3 text-3xl">{clicks}</p>
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Link href={`/app/${slug}/conversions`} className="rv-card">
          <h2>Conversions (retained)</h2>
          <p className="mt-3 text-3xl" data-testid="overview-conversions">
            {conversions}
          </p>
        </Link>
        <section className="rv-card">
          <h2>Clicks with a conversion</h2>
          <p className="mt-3">
            {clicks
              ? `${((Number(converted[0]?.count ?? 0) / clicks) * 100).toFixed(2)}%`
              : "No click evidence"}
          </p>
          <p className="rv-muted mt-2">
            Retained click IDs with retained conversions / retained prepared
            redirects, not unique people.
          </p>
        </section>
        <section className="rv-card">
          <h2>Revenue / revenue per prepared redirect</h2>
          {revenue.length ? (
            revenue.map((row) => (
              <p
                key={row.currency}
                className="mt-3"
                data-testid={`overview-revenue-${row.currency}`}
              >
                {row.currency} {row._sum.revenue?.toFixed(3)} /{" "}
                {clicks
                  ? (
                      linkedRevenue.find(
                        (linked) => linked.currency === row.currency,
                      )?.revenue ?? new Prisma.Decimal(0)
                    )
                      .div(clicks)
                      .toFixed(3)
                  : "No denominator"}
              </p>
            ))
          ) : (
            <p className="rv-muted mt-3">No revenue recorded</p>
          )}
          <p className="rv-muted mt-2">
            Totals use retained conversions; per-redirect revenue includes only
            conversions with retained click evidence. Currencies never combined.
            Cost/CPA/ROAS unavailable.
          </p>
        </section>
      </div>
      <section className="rv-card py-16 text-center">
        <h2>
          {clicks ? "Inspect your click evidence" : "No tracking data yet"}
        </h2>
        <p className="rv-muted mt-3">
          Click analytics report prepared redirects, enriched device metadata
          and referrer hostnames. Counts are not unique people or confirmed
          landing-page visits. Server-reported conversions and
          currency-separated revenue are available.
        </p>
        <Link className="rv-button mt-6" href={`/app/${slug}/analytics`}>
          Open analytics
        </Link>
      </section>
    </main>
  );
}
