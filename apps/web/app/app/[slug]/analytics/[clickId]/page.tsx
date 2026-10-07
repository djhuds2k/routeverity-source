import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/routeverity/auth";
import { hasRedirectIntegrity } from "@/lib/routeverity/transparent-policy";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ClickDetail({
  params,
}: {
  params: Promise<{ slug: string; clickId: string }>;
}) {
  const { slug, clickId } = await params;
  const { workspace } = await requireWorkspace(slug);
  const click = await prisma.routeVerityRedirectAudit.findFirst({
    where: {
      clickId,
      projectId: workspace.id,
      validationResult: "ALLOWED",
      redirectStatus: 302,
    },
  });
  if (!click) notFound();
  const campaign = await prisma.routeVerityCampaign.findFirst({
    where: { id: click.campaignId, projectId: workspace.id },
    select: { name: true },
  });
  const conversions = await prisma.routeVerityConversion.findMany({
    where: { projectId: workspace.id, clickId },
    orderBy: { occurredAt: "desc" },
    take: 50,
    select: {
      id: true,
      event: true,
      revenue: true,
      currency: true,
      occurredAt: true,
    },
  });
  const fields = [
    ["Click ID", click.clickId],
    ["Request ID", click.requestId],
    ["Timestamp (UTC)", click.timestamp.toISOString()],
    ["Campaign", campaign?.name ?? `Deleted campaign: ${click.campaignId}`],
    ["Tracking domain", click.trackingDomain],
    ["Destination hostname", click.destinationHostname],
    [
      "Referrer hostname",
      click.referrerHostname ?? "Not supplied / unavailable",
    ],
    ["Device", click.device ?? "Pending / unavailable"],
    ["Browser", click.browser ?? "Pending / unavailable"],
    ["Operating system", click.operatingSystem ?? "Pending / unavailable"],
    [
      "Enrichment",
      click.enrichedAt?.toISOString() ??
        (click.analyticsCaptured ? "Pending" : "Legacy audit only"),
    ],
    ["Decision time (before audit)", `${click.processingTimeMs.toFixed(2)} ms`],
    [
      "Target integrity",
      hasRedirectIntegrity(click) ? "Matched" : "CRITICAL: mismatch",
    ],
    ["Provided target fingerprint", click.providedNextHopHash],
    ["Validated target fingerprint", click.validatedNextHopHash],
    ["Actual target fingerprint", click.actualRedirectTargetHash],
    ["Policy version", click.policyVersion],
    ["App version", click.appVersion],
  ];
  return (
    <main className="rv-page rv-stack">
      <Link className="underline" href={`/app/${slug}/analytics`}>
        Back to analytics
      </Link>
      <h1>Click detail</h1>
      <p className="rv-muted">
        Prepared redirect evidence, not proof of a completed visit. Country,
        unique visitor identity and raw advertising identifiers are not
        collected.
      </p>
      <dl className="rv-card grid gap-5 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="font-semibold">{label}</dt>
            <dd className="rv-muted mt-2 break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="rv-card rv-stack">
        <h2>Google Ads supplied metadata</h2>
        <p className="rv-muted">
          Unverified source values. Advertising identifier fingerprints cannot
          be used for Google conversion uploads and are not guaranteed
          anonymous.
        </p>
        <pre className="whitespace-pre-wrap break-all">
          {click.googleAds &&
          typeof click.googleAds === "object" &&
          Object.keys(click.googleAds).length
            ? JSON.stringify(click.googleAds, null, 2)
            : "Not supplied / legacy evidence"}
        </pre>
      </section>
      <section className="rv-card rv-stack">
        <h2>Attributed conversions (latest 50)</h2>
        {conversions.length ? (
          conversions.map((conversion) => (
            <Link
              key={conversion.id}
              className="break-all underline"
              href={`/app/${slug}/conversions/${conversion.id}`}
            >
              {conversion.event} / {conversion.currency}{" "}
              {conversion.revenue.toFixed(3)} /{" "}
              {conversion.occurredAt.toISOString()}
            </Link>
          ))
        ) : (
          <p>No attributed conversions yet.</p>
        )}
      </section>
    </main>
  );
}
