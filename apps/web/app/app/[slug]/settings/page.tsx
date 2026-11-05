import { saveWorkspace } from "@/lib/routeverity/actions";
import { requireWorkspace } from "@/lib/routeverity/auth";
import { saveRetention } from "@/lib/routeverity/retention-actions";
import { retentionDayOptions } from "@/lib/routeverity/retention-policy";
import { ActionForm } from "@/ui/routeverity/action-form";
import Link from "next/link";

export default async function Settings({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace, user, role } = await requireWorkspace(slug);
  return (
    <main className="rv-page rv-stack max-w-3xl">
      <h1>Settings</h1>
      <section className="rv-card rv-stack">
        <h2>Workspace</h2>
        {role === "owner" ? (
          <ActionForm
            action={saveWorkspace.bind(null, slug)}
            label="Save workspace"
          >
            <label>
              Workspace name
              <input
                name="name"
                defaultValue={workspace.name}
                minLength={2}
                maxLength={60}
                required
              />
            </label>
          </ActionForm>
        ) : (
          <p>{workspace.name} (only the owner can change settings)</p>
        )}
        <p className="rv-muted">Address: {workspace.slug}</p>
      </section>
      <section className="rv-card rv-stack">
        <h2>Data retention</h2>
        <p>
          Detailed clicks and redirect evidence expire from their creation time.
          Conversions and their retry receipts expire from conversion receipt
          time. The default and maximum is 90 days.
        </p>
        {role === "owner" ? (
          <ActionForm
            action={saveRetention.bind(null, slug)}
            label="Save retention"
            preserveValues
          >
            <input
              type="hidden"
              name="previousDays"
              value={workspace.routeverityRetentionDays}
            />
            <label>
              Detailed record retention
              <select
                name="retentionDays"
                defaultValue={String(workspace.routeverityRetentionDays)}
                required
              >
                {retentionDayOptions.map((days) => (
                  <option key={days} value={days}>
                    {days} days
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input type="checkbox" name="confirmShorterRetention" />I
              understand that shorter retention permanently deletes older
              records at the next cleanup.
            </label>
          </ActionForm>
        ) : (
          <p>
            {workspace.routeverityRetentionDays} days (only the owner can change
            retention)
          </p>
        )}
        <p className="rv-muted">
          Expiry requires the separate cleanup worker; its hosted schedule is
          not configured in this preproduction baseline. Expired records
          disappear from reports and exports after cleanup, including
          archived/deleted campaigns. Increasing retention does not recover
          deleted records. Attribution still requires retained click evidence
          and a conversion occurrence within 30 days of the click. Raw
          user-agent strings are erased after enrichment or become eligible for
          erasure at 24 hours; late enrichment reports unknown dimensions.
          Operator suspension audits have a separate 365-day policy.
        </p>
      </section>
      <section className="rv-card rv-stack">
        <h2>Account</h2>
        <p>{user.email}</p>
        <p className="rv-muted">
          Access is verified by one-time email links. Workspace role: {role}.
        </p>
        <Link href="/account" className="underline">
          Account and workspace deletion
        </Link>
      </section>
      <section className="rv-card rv-stack">
        <h2>Data export</h2>
        <p>
          Owner-only JSON contains retained workspace configuration, memberships
          by user ID, clicks and conversions, including customer-supplied order
          references and metadata. It excludes credential fields, raw user-agent
          input, other members&apos; email addresses and operator incident
          history. It is not a database backup or a complete legal
          subject-access response. Existing filtered click CSV access is
          unchanged.
        </p>
        {role === "owner" ? (
          <a href={`/app/${slug}/settings/export`} className="underline">
            Download workspace JSON
          </a>
        ) : (
          <p>Only a current owner can download full workspace JSON.</p>
        )}
        <p className="rv-muted">
          Maximum 10,000 rows per collection and 20 MiB total. Exceeding either
          limit produces an explicit error, never a partial file. UTC dates and
          exact decimal revenue strings are exported. Store downloads privately.
        </p>
      </section>
      <section className="rv-card rv-stack">
        <h2>Plan</h2>
        <p>Free development plan</p>
        <p className="rv-muted">
          Billing is deferred. No subscription or payment is required, and no
          billing action is available.
        </p>
      </section>
    </main>
  );
}
