import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/routeverity/auth";
import { currencies } from "@/lib/routeverity/campaign-policy";
import { AnalyticsInputError } from "@/lib/routeverity/click-reporting";
import {
  createConversionApiKey,
  createConversionGoal,
  revokeConversionApiKey,
  setConversionGoalEnabled,
} from "@/lib/routeverity/conversion-actions";
import {
  conversionQuery,
  loadConversionReport,
  loadMerchantReport,
  parseConversionFilters,
} from "@/lib/routeverity/conversion-reporting";
import { canWrite } from "@/lib/routeverity/validation";
import { ActionForm } from "@/ui/routeverity/action-form";
import { ConversionKeyForm } from "@/ui/routeverity/conversion-key-form";
import Link from "next/link";

export default async function Conversions({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const { workspace, role } = await requireWorkspace(slug);
  let filters;
  try {
    filters = parseConversionFilters(await searchParams);
  } catch (error) {
    if (!(error instanceof AnalyticsInputError)) throw error;
    return (
      <main className="rv-page rv-stack">
        <h1>Conversions</h1>
        <p role="alert">{error.message}</p>
        <Link className="underline" href={`/app/${slug}/conversions`}>
          Reset filters
        </Link>
      </main>
    );
  }
  const [report, goals, campaigns, keys, merchantReport] = await Promise.all([
    loadConversionReport(workspace.id, filters),
    prisma.routeVerityConversionGoal.findMany({
      where: { projectId: workspace.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.routeVerityCampaign.findMany({
      where: { projectId: workspace.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    canWrite(role)
      ? prisma.routeVerityConversionKey.findMany({
          where: { projectId: workspace.id, revokedAt: null },
          select: { id: true, name: true, createdAt: true },
        })
      : [],
    loadMerchantReport(workspace.id, filters),
  ]);
  const names = new Map(
    campaigns.map((campaign) => [campaign.id, campaign.name]),
  );
  const goalNames = new Map(goals.map((goal) => [goal.id, goal.name]));
  const maxCount = Math.max(1, ...report.days.map((day) => day.count));
  return (
    <main className="rv-page rv-stack">
      <h1>Conversions</h1>
      <p className="rv-muted">
        Immutable server-reported events linked to recorded requests within 30
        days, using the event occurrence time. Direct click IDs and limited
        merchant GCLID recorded-request matches are distinguished by their
        attribution policy. Neither proves a human visit or payment. Monetary
        totals stay separated by currency. No inferred visitor matching or
        currency conversion. Records expire from receipt time under workspace
        retention; reports use occurrence dates and contain retained events
        only.
      </p>
      <form
        method="get"
        className="rv-card grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
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
          </select>
        </label>
        <label>
          Goal
          <select name="goal" defaultValue={filters.goal ?? ""}>
            <option value="">All goals</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name} ({goal.event})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rv-button self-end">
          Apply filters
        </button>
      </form>
      <div className="grid gap-5 sm:grid-cols-2">
        <section className="rv-card">
          <h2>Attributed conversions in range</h2>
          <p className="mt-3 text-3xl" data-testid="conversion-total">
            {report.total}
          </p>
        </section>
        <section className="rv-card">
          <h2>Attributed revenue by currency</h2>
          {report.revenue.length ? (
            report.revenue.map((row) => (
              <p
                key={row.currency}
                className="mt-3"
                data-testid={`revenue-${row.currency}`}
              >
                {row.currency} {row._sum.revenue?.toFixed(3) ?? "0.000"}
              </p>
            ))
          ) : (
            <p className="rv-muted mt-3">No revenue recorded</p>
          )}
        </section>
      </div>
      <section className="rv-card rv-stack">
        <h2>Pending and unattributed merchant submissions</h2>
        <p className="rv-muted">
          These merchant-reported amounts are excluded from attributed totals.
          No confirmed landing or unique Google interaction is inferred. Only
          missing recorded evidence with a valid identifier is retried, for up
          to 24 hours from first receipt. Missing or ambiguous identifiers are
          not guessed.
        </p>
        <p data-testid="merchant-unmatched-total">{merchantReport.total}</p>
        {merchantReport.groups.map((row) => (
          <p
            key={`${row.status}-${row.currency}`}
            data-testid={`merchant-${row.status}-${row.currency}`}
          >
            {row.status}: {row._count._all} / {row.currency}{" "}
            {row._sum.revenue?.toFixed(3) ?? "0.000"}
          </p>
        ))}
        {merchantReport.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Occurred (UTC)</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Reported amount</th>
                </tr>
              </thead>
              <tbody>
                {merchantReport.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.occurredAt.toISOString()}</td>
                    <td className="break-all">{row.orderId}</td>
                    <td>{row.status}</td>
                    <td>{row.reason}</td>
                    <td>
                      {row.currency} {row.revenue.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav
          aria-label="Unmatched merchant submissions pagination"
          className="flex gap-4"
        >
          {filters.pageNumber > 1 && (
            <Link
              className="underline"
              href={`?${conversionQuery(filters, filters.pageNumber - 1)}`}
            >
              Previous unmatched page
            </Link>
          )}
          {filters.pageNumber * 50 < merchantReport.total && (
            <Link
              className="underline"
              href={`?${conversionQuery(filters, filters.pageNumber + 1)}`}
            >
              Next unmatched page
            </Link>
          )}
        </nav>
      </section>
      {!report.total ? (
        <section className="rv-card">
          <h2>No conversions in this range</h2>
          <p className="rv-muted mt-3">
            Create a goal and server credential, then submit a real
            click-attributed event.
          </p>
        </section>
      ) : (
        <>
          <section className="rv-card rv-stack">
            <h2>Conversions over time</h2>
            <div
              role="img"
              aria-label="Daily conversion counts; exact values in the daily table below."
              className="flex h-40 items-end gap-1 overflow-x-auto"
            >
              {report.days.map((day) => (
                <div
                  key={day.day}
                  title={`${day.day}: ${day.count}`}
                  className="min-w-2 flex-1 bg-[var(--rv-action)]"
                  style={{ height: `${(day.count / maxCount) * 100}%` }}
                />
              ))}
            </div>
            {report.revenue.map((currency) => {
              const maximum = report.days.reduce((max, day) => {
                const value = day.revenue.find(
                  (row) => row.currency === currency.currency,
                )!.amount;
                return value.greaterThan(max) ? value : max;
              }, currency._sum.revenue!.mul(0).add(1));
              return (
                <div key={currency.currency}>
                  <h3>Revenue over time ({currency.currency})</h3>
                  <div
                    role="img"
                    aria-label={`Daily ${currency.currency} revenue; exact values in the daily table below.`}
                    className="mt-3 flex h-32 items-end gap-1 overflow-x-auto"
                  >
                    {report.days.map((day) => {
                      const value = day.revenue.find(
                        (row) => row.currency === currency.currency,
                      )!.amount;
                      return (
                        <div
                          key={day.day}
                          title={`${day.day}: ${currency.currency} ${value.toFixed(3)}`}
                          className="min-w-2 flex-1 bg-[var(--rv-action)]"
                          style={{
                            height: `${value.div(maximum).mul(100).toNumber()}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
          <section className="rv-card overflow-x-auto">
            <h2>Conversions and revenue by UTC day</h2>
            <table className="mt-4 w-full">
              <thead>
                <tr>
                  <th>UTC day</th>
                  <th>Currency</th>
                  <th>Conversions</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.days.flatMap((day) =>
                  day.revenue.map((row) => (
                    <tr key={`${day.day}-${row.currency}`}>
                      <td>{day.day}</td>
                      <td>{row.currency}</td>
                      <td>
                        {String(
                          report.daily.find(
                            (value) =>
                              value.day === day.day &&
                              value.currency === row.currency,
                          )?.count ?? 0,
                        )}
                      </td>
                      <td>{row.amount.toFixed(3)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </section>
          <section className="rv-card">
            <h2>Goals (top 10)</h2>
            <ul className="mt-4 space-y-2">
              {report.goals.map((row) => (
                <li key={row.goalId}>
                  {goalNames.get(row.goalId) ?? row.event}: {row._count._all}{" "}
                  conversions; {row.currency} {row._sum.revenue?.toFixed(3)}
                </li>
              ))}
            </ul>
          </section>
          <section className="rv-card overflow-x-auto">
            <h2>Attributed events</h2>
            <table className="mt-4 w-full">
              <thead>
                <tr>
                  <th>Event / UTC time</th>
                  <th>Campaign / click</th>
                  <th>Order/reference</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        className="underline"
                        href={`/app/${slug}/conversions/${row.id}`}
                      >
                        {row.event}
                      </Link>
                      <br />
                      {row.occurredAt.toISOString()}
                    </td>
                    <td>
                      {names.get(row.campaignId) ??
                        `Deleted campaign: ${row.campaignId}`}
                      <br />
                      <Link
                        className="underline"
                        href={`/app/${slug}/analytics/${row.clickId}`}
                      >
                        {row.clickId}
                      </Link>
                    </td>
                    <td>{row.orderId}</td>
                    <td>
                      {row.currency} {row.revenue.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <nav className="mt-4 flex gap-4" aria-label="Conversion pages">
              {filters.pageNumber > 1 && (
                <Link
                  href={`?${conversionQuery(filters, filters.pageNumber - 1)}`}
                  className="underline"
                >
                  Previous page
                </Link>
              )}
              <span>Page {filters.pageNumber}</span>
              {filters.pageNumber * 50 < report.total &&
                filters.pageNumber < 9999 && (
                  <Link
                    className="underline"
                    href={`?${conversionQuery(filters, filters.pageNumber + 1)}`}
                  >
                    Next page
                  </Link>
                )}
            </nav>
          </section>
        </>
      )}
      <section className="rv-card rv-stack">
        <h2>Conversion goals</h2>
        <p className="rv-muted">
          Goals bind a lowercase event key and immutable currency to a campaign.
          Disable a goal to reject new events; exact retries of accepted events
          remain idempotent.
        </p>
        {goals.map((goal) => (
          <div
            className="rounded-lg border border-[var(--rv-border)] p-4"
            key={goal.id}
          >
            <p className="mb-3">
              {goal.name} / {goal.event} / {goal.currency} /{" "}
              {names.get(goal.campaignId) ?? goal.campaignId} /{" "}
              {goal.enabled ? "Enabled" : "Disabled"}
            </p>
            {canWrite(role) && (
              <ActionForm
                action={setConversionGoalEnabled.bind(
                  null,
                  slug,
                  goal.id,
                  !goal.enabled,
                )}
                label={
                  goal.enabled
                    ? `Disable ${goal.event}`
                    : `Enable ${goal.event}`
                }
                secondary
              />
            )}
          </div>
        ))}
        {canWrite(role) && campaigns.length > 0 && (
          <ActionForm
            action={createConversionGoal.bind(null, slug)}
            label="Create conversion goal"
            preserveValues
          >
            <label>
              Goal name
              <input name="name" minLength={2} maxLength={120} required />
            </label>
            <label>
              Goal event
              <input
                name="event"
                pattern="[a-z][a-z0-9_-]{0,63}"
                maxLength={64}
                placeholder="purchase"
                required
              />
            </label>
            <label>
              Goal campaign
              <select name="campaignId" required>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Goal currency
              <select name="currency" defaultValue="GBP">
                {currencies.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
            </label>
          </ActionForm>
        )}
        {canWrite(role) && !campaigns.length && (
          <Link className="underline" href={`/app/${slug}/campaigns/new`}>
            Create a campaign before adding a goal
          </Link>
        )}
      </section>
      {canWrite(role) && (
        <section className="rv-card rv-stack">
          <h2>Conversion API keys</h2>
          {keys.map((key) => (
            <div key={key.id}>
              <p className="mb-3">
                {key.name} / issued {key.createdAt.toISOString()}
              </p>
              <ActionForm
                action={revokeConversionApiKey.bind(null, slug, key.id)}
                label={`Revoke ${key.name}`}
                secondary
              >
                <label className="flex items-center gap-2">
                  <input
                    className="!m-0 !w-4"
                    type="checkbox"
                    name="confirm"
                    required
                  />
                  Confirm permanent revocation of {key.name}
                </label>
              </ActionForm>
            </div>
          ))}
          <ConversionKeyForm action={createConversionApiKey.bind(null, slug)} />
        </section>
      )}
      <section className="rv-card rv-stack">
        <h2>Server-to-server integration</h2>
        <p>
          POST /api/v1/conversions uses a JSON body, an Authorization: Bearer
          conversion key and Idempotency-Key header. GET /conversion uses the
          same Authorization header with an idempotency_key query field.
          Required body fields: click_id, event, order_id, currency; revenue
          defaults to zero. Optional timestamp, customer_reference and bounded
          metadata (POST only).
        </p>
        <p className="rv-muted">
          Conversions are immutable. A changed retry or reused order reference
          with different data returns 409. The tracking response exposes its
          generated click ID in a header; this milestone adds no URL/cookie
          injection or browser SDK. Your integration must securely receive that
          ID. Reference fields must not contain email addresses or sensitive
          customer data.
        </p>
      </section>
    </main>
  );
}
