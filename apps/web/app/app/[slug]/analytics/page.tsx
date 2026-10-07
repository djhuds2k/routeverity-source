import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/routeverity/auth";
import {
  AnalyticsInputError,
  analyticsQuery,
  loadClickReport,
  parseAnalyticsFilters,
} from "@/lib/routeverity/click-reporting";
import Link from "next/link";

export default async function Analytics({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const { workspace } = await requireWorkspace(slug);
  let filters;
  try {
    filters = parseAnalyticsFilters(await searchParams);
  } catch (error) {
    if (!(error instanceof AnalyticsInputError)) throw error;
    return (
      <main className="rv-page rv-stack">
        <h1>Analytics</h1>
        <p role="alert">{error.message}</p>
        <Link href={`/app/${slug}/analytics`} className="underline">
          Reset filters
        </Link>
      </main>
    );
  }
  const [report, campaigns] = await Promise.all([
    loadClickReport(workspace.id, filters),
    prisma.routeVerityCampaign.findMany({
      where: { projectId: workspace.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const names = new Map(
    campaigns.map((campaign) => [campaign.id, campaign.name]),
  );
  const max = Math.max(1, ...report.days.map((day) => day.count));
  const breakdowns = [
    {
      title: "Campaigns (top 10)",
      rows: report.campaigns.map((row) => ({
        label:
          names.get(row.campaignId) ?? `Deleted campaign: ${row.campaignId}`,
        count: row._count._all,
      })),
    },
    {
      title: "Devices (top 10)",
      rows: report.devices.map((row) => ({
        label: row.device ?? "Pending / legacy",
        count: row._count._all,
      })),
    },
    {
      title: "Browsers (top 10)",
      rows: report.browsers.map((row) => ({
        label: row.browser ?? "Pending / legacy",
        count: row._count._all,
      })),
    },
    {
      title: "Operating systems (top 10)",
      rows: report.systems.map((row) => ({
        label: row.operatingSystem ?? "Pending / legacy",
        count: row._count._all,
      })),
    },
    {
      title: "Referrer hostnames (top 10)",
      rows: report.referrers.map((row) => ({
        label: row.referrerHostname ?? "Not supplied / unavailable",
        count: row._count._all,
      })),
    },
  ];
  return (
    <main className="rv-page rv-stack">
      <h1>Click analytics</h1>
      <p className="rv-muted">
        Counts describe prepared transparent redirects, not confirmed
        landing-page visits or unique people. Country, unique visitors, raw
        advertising identifiers are unavailable. Bounded Google identifiers are
        fingerprinted only and visible in click detail. Conversion and revenue
        reports are separate and use event occurrence dates. All dates use UTC.
      </p>
      <Link className="w-fit underline" href={`/app/${slug}/conversions`}>
        Open conversion and revenue reports
      </Link>
      <form
        className="rv-card grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        method="get"
      >
        <label>
          From (UTC)
          <input name="from" type="date" defaultValue={filters.from} required />
        </label>
        <label>
          Through (UTC)
          <input name="to" type="date" defaultValue={filters.to} required />
        </label>
        <label>
          Campaign
          <select name="campaign" defaultValue={filters.campaign ?? ""}>
            <option value="">All campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
            {filters.campaign && !names.has(filters.campaign) && (
              <option value={filters.campaign}>
                Deleted / unavailable campaign
              </option>
            )}
          </select>
        </label>
        <label>
          Destination hostname
          <input
            name="hostname"
            maxLength={253}
            defaultValue={filters.hostname ?? ""}
          />
        </label>
        <label>
          Device
          <input
            name="device"
            maxLength={80}
            defaultValue={filters.device ?? ""}
          />
        </label>
        <label>
          Browser
          <input
            name="browser"
            maxLength={80}
            defaultValue={filters.browser ?? ""}
          />
        </label>
        <label>
          Operating system
          <input name="os" maxLength={80} defaultValue={filters.os ?? ""} />
        </label>
        <button type="submit" className="rv-button self-end">
          Apply filters
        </button>
      </form>
      <div className="grid gap-5 sm:grid-cols-3">
        <section className="rv-card">
          <h2>Prepared redirects</h2>
          <p className="mt-3 text-3xl" data-testid="click-total">
            {report.total}
          </p>
        </section>
        <section className="rv-card">
          <h2>Enrichment</h2>
          <p className="mt-3">
            {report.enriched} enriched; {report.captured - report.enriched}{" "}
            pending; {report.total - report.captured} legacy audit only
          </p>
        </section>
        <section className="rv-card">
          <h2>Average decision time</h2>
          <p className="mt-3">
            {report.averageDecisionMs === null
              ? "No data"
              : `${report.averageDecisionMs.toFixed(2)} ms`}
          </p>
          <p className="rv-muted">
            Before audit submission; not network latency.
          </p>
        </section>
      </div>
      <Link
        className="rv-button rv-secondary w-fit"
        href={`/app/${slug}/analytics/export?${analyticsQuery(filters)}`}
      >
        Export filtered CSV
      </Link>
      {!report.total ? (
        <section className="rv-card text-center">
          <h2>No clicks in this range</h2>
          <p className="rv-muted mt-3">
            No matching redirect evidence. Try another range or perform a
            transparent test click.
          </p>
        </section>
      ) : (
        <>
          <section className="rv-card rv-stack">
            <h2>Prepared redirects by UTC day</h2>
            <div
              role="img"
              aria-label={`Daily prepared redirect counts, ${filters.from} through ${filters.to}`}
              className="flex h-40 items-end gap-1 overflow-x-auto"
            >
              {report.days.map((day) => (
                <div
                  key={day.day}
                  title={`${day.day}: ${day.count}`}
                  className="min-w-2 flex-1 bg-[var(--rv-action)]"
                  style={{ height: `${(day.count / max) * 100}%` }}
                />
              ))}
            </div>
            <details>
              <summary className="cursor-pointer underline">
                Daily counts (accessible table)
              </summary>
              <table className="w-full">
                <thead>
                  <tr>
                    <th>UTC date</th>
                    <th>Prepared redirects</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((day) => (
                    <tr key={day.day}>
                      <td>{day.day}</td>
                      <td>{day.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
          <div className="grid gap-5 md:grid-cols-2">
            {breakdowns.map((group) => (
              <section key={group.title} className="rv-card">
                <h2>{group.title}</h2>
                <ul className="mt-4 space-y-2">
                  {group.rows.map((row) => (
                    <li key={row.label} className="flex justify-between gap-3">
                      <span className="min-w-0 break-all">{row.label}</span>
                      <span>{row.count}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <section className="rv-card overflow-x-auto">
            <h2>Click records</h2>
            <table className="mt-4 w-full">
              <thead>
                <tr>
                  <th>Click / UTC time</th>
                  <th>Campaign</th>
                  <th>Destination host</th>
                  <th>Device / browser / OS</th>
                </tr>
              </thead>
              <tbody>
                {report.clicks.map((click) => (
                  <tr key={click.clickId}>
                    <td>
                      <Link
                        className="underline"
                        href={`/app/${slug}/analytics/${click.clickId}`}
                      >
                        {click.clickId}
                      </Link>
                      <br />
                      {click.timestamp.toISOString()}
                    </td>
                    <td>{names.get(click.campaignId) ?? click.campaignId}</td>
                    <td>{click.destinationHostname}</td>
                    <td>
                      {click.enrichedAt
                        ? `${click.device} / ${click.browser} / ${click.operatingSystem}`
                        : click.analyticsCaptured
                          ? "Pending enrichment"
                          : "Legacy audit only"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <nav aria-label="Click record pages" className="mt-4 flex gap-4">
              {filters.pageNumber > 1 && (
                <Link
                  className="underline"
                  href={`?${analyticsQuery(filters, filters.pageNumber - 1)}`}
                >
                  Previous page
                </Link>
              )}
              <span>Page {filters.pageNumber}</span>
              {filters.pageNumber * 50 < report.total &&
                filters.pageNumber < 9999 && (
                  <Link
                    className="underline"
                    href={`?${analyticsQuery(filters, filters.pageNumber + 1)}`}
                  >
                    Next page
                  </Link>
                )}
            </nav>
          </section>
        </>
      )}
    </main>
  );
}
