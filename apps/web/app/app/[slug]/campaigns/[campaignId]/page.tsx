import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/routeverity/auth";
import {
  checkCampaignDestination,
  deleteCampaign,
  saveCampaign,
} from "@/lib/routeverity/campaign-actions";
import {
  campaignReadiness,
  campaignStatuses,
  currencies,
  parameterKeys,
  trackingParametersSchema,
  trafficSources,
} from "@/lib/routeverity/campaign-policy";
import { generateGoogleAdsSetup } from "@/lib/routeverity/google-ads-actions";
import { manageTrackingCredential } from "@/lib/routeverity/tracking-credentials";
import { canWrite } from "@/lib/routeverity/validation";
import { ActionForm } from "@/ui/routeverity/action-form";
import { CampaignForm } from "@/ui/routeverity/campaign-form";
import { TrackingCredentialForm } from "@/ui/routeverity/tracking-credential-form";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CampaignDetail({
  params,
}: {
  params: Promise<{ slug: string; campaignId: string }>;
}) {
  const { slug, campaignId } = await params;
  const { workspace, role } = await requireWorkspace(slug);
  const campaign = await prisma.routeVerityCampaign.findFirst({
    where: { id: campaignId, projectId: workspace.id },
    include: { destinationDomains: true, trackingDomain: true },
  });
  if (!campaign) notFound();
  const domains = await prisma.domain.findMany({
    where: { projectId: workspace.id, type: "TRANSPARENT_TRACKING" },
  });
  const trackingParameters = trackingParametersSchema.parse(
    campaign.trackingParameters,
  );
  const readiness = campaignReadiness(campaign);
  return (
    <main className="rv-page rv-stack max-w-4xl">
      <Link className="underline" href={`/app/${slug}/campaigns`}>
        Back to campaigns
      </Link>
      <div>
        <h1>{campaign.name}</h1>
        <p className="rv-muted mt-2">
          {campaign.advertiser} &middot; {campaign.status}
        </p>
      </div>
      <section className="rv-card rv-stack">
        <h2>Tracking readiness</h2>
        <p>
          {readiness ??
            "Campaign configuration is ready for transparent redirects."}
        </p>
        <p className="rv-muted">
          /click requires a current tracking credential, DNS routing and TLS.
          Analytics enrichment runs separately. Conversion goals and reports are
          configured on the Conversions page. Campaign ID:{" "}
          <code className="break-all">{campaign.id}</code>
        </p>
      </section>
      {canWrite(role) ? (
        <section className="rv-card">
          <CampaignForm
            action={saveCampaign.bind(null, slug, campaignId)}
            initial={{
              name: campaign.name,
              advertiser: campaign.advertiser,
              trafficSource: campaign.trafficSource,
              externalCampaignId: campaign.externalCampaignId ?? "",
              currency: campaign.currency,
              status: campaign.status,
              trackingDomainId: campaign.trackingDomainId ?? "",
              notes: campaign.notes ?? "",
              revision: campaign.updatedAt.toISOString(),
              destinationDomains: campaign.destinationDomains.map(
                ({ hostname, includeSubdomains }) => ({
                  hostname,
                  includeSubdomains,
                }),
              ),
              trackingParameters,
            }}
            domains={domains.map((domain) => ({
              id: domain.id,
              slug: domain.slug,
              available:
                domain.verified && !domain.suspendedAt && !domain.archived,
            }))}
            currencies={currencies}
            sources={[...trafficSources]}
            statuses={campaignStatuses}
            parameterKeys={parameterKeys}
          />
        </section>
      ) : (
        <section className="rv-card rv-stack">
          <h2>Saved configuration (read-only)</h2>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt>Traffic source</dt>
              <dd className="rv-muted">
                {
                  trafficSources.find(
                    (source) => source.value === campaign.trafficSource,
                  )?.label
                }
              </dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd className="rv-muted">{campaign.currency}</dd>
            </div>
            <div>
              <dt>External campaign ID</dt>
              <dd className="rv-muted">
                {campaign.externalCampaignId ?? "Not set"}
              </dd>
            </div>
            <div>
              <dt>Tracking domain</dt>
              <dd className="rv-muted">
                {campaign.trackingDomain?.slug ?? "Unassigned"}
              </dd>
            </div>
          </dl>
          <h3>Allowed landing-page domains</h3>
          {campaign.destinationDomains.length ? (
            <ul>
              {campaign.destinationDomains.map((rule) => (
                <li key={rule.id}>
                  {rule.hostname}
                  {rule.includeSubdomains
                    ? " (including subdomains)"
                    : " (exact hostname)"}
                </li>
              ))}
            </ul>
          ) : (
            <p>No approved hostnames.</p>
          )}
          <h3>Tracking parameters</h3>
          {Object.entries(trackingParameters).length ? (
            <dl>
              {Object.entries(trackingParameters).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd className="rv-muted break-all">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>None configured.</p>
          )}
          <h3>Notes</h3>
          <p className="whitespace-pre-wrap">{campaign.notes ?? "No notes."}</p>
        </section>
      )}
      <section className="rv-card rv-stack">
        <h2>Transparent tracking credential</h2>
        <p>
          {campaign.trackingTokenHash
            ? "A credential is configured."
            : "No tracking credential is configured."}
        </p>
        {canWrite(role) && (
          <TrackingCredentialForm
            issue={manageTrackingCredential.bind(
              null,
              slug,
              campaignId,
              "ISSUE",
            )}
            revoke={manageTrackingCredential.bind(
              null,
              slug,
              campaignId,
              "REVOKE",
            )}
            campaignId={campaignId}
            domain={campaign.trackingDomain?.slug ?? null}
            googleSetup={generateGoogleAdsSetup.bind(null, slug, campaignId)}
          />
        )}
        <Link
          className="underline"
          href={`/app/${slug}/campaigns/${campaignId}/audit`}
        >
          Inspect redirect integrity audit
        </Link>
        <Link
          className="underline"
          href={`/app/${slug}/analytics?campaign=${campaignId}`}
        >
          View campaign analytics
        </Link>
        <Link
          className="underline"
          href={`/app/${slug}/conversions?campaign=${campaignId}`}
        >
          View campaign conversions and goals
        </Link>
      </section>
      <section className="rv-card rv-stack">
        <h2>Check saved destination policy</h2>
        <p className="rv-muted">
          Checks hostname approval only, using the saved policy, not unsaved
          form edits. Does not fetch, redirect to or track the destination.
        </p>
        <ActionForm
          action={checkCampaignDestination.bind(null, slug, campaignId)}
          label="Check destination"
        >
          <label>
            Landing-page URL
            <input
              name="destination"
              type="url"
              required
              maxLength={8000}
              placeholder="https://shop.example.com/offer"
            />
          </label>
        </ActionForm>
      </section>
      {canWrite(role) && campaign.status === "ARCHIVED" && (
        <section className="rv-card rv-stack">
          <h2>Delete archived campaign</h2>
          <p>
            Permanent deletion removes its destination policy and saved
            parameters. Minimal redirect audit evidence is retained. There is no
            undo.
          </p>
          <ActionForm
            action={deleteCampaign.bind(null, slug, campaignId)}
            label="Delete campaign"
            secondary
          >
            <input
              type="hidden"
              name="revision"
              value={campaign.updatedAt.toISOString()}
            />
            <label className="flex items-center gap-2">
              <input
                className="!m-0 !w-4"
                type="checkbox"
                name="confirm"
                required
              />
              I confirm permanent deletion
            </label>
          </ActionForm>
        </section>
      )}
    </main>
  );
}
