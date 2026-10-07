import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/routeverity/auth";
import { hasRedirectIntegrity } from "@/lib/routeverity/transparent-policy";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function RedirectAudit({
  params,
}: {
  params: Promise<{ slug: string; campaignId: string }>;
}) {
  const { slug, campaignId } = await params;
  const { workspace } = await requireWorkspace(slug);
  const campaign = await prisma.routeVerityCampaign.findFirst({
    where: { id: campaignId, projectId: workspace.id },
    select: { name: true },
  });
  if (!campaign) notFound();
  const records = await prisma.routeVerityRedirectAudit.findMany({
    where: { projectId: workspace.id, campaignId },
    orderBy: [{ timestamp: "desc" }, { clickId: "desc" }],
    take: 50,
  });
  return (
    <main className="rv-page rv-stack">
      <Link className="underline" href={`/app/${slug}/campaigns/${campaignId}`}>
        Back to campaign
      </Link>
      <h1>Redirect integrity audit</h1>
      <p className="rv-muted">
        Latest 50 prepared redirects for {campaign.name}. Records demonstrate
        server target selection, not arrival at a landing page. Full URLs,
        credentials, IP addresses and user agents are not stored. SHA-256
        fingerprints may still be personal data; protect access and retention.
      </p>
      {!records.length ? (
        <section className="rv-card">
          <h2>No redirect audit records yet</h2>
        </section>
      ) : (
        <div className="rv-card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="p-3">Click / request</th>
                <th className="p-3">Time / host</th>
                <th className="p-3">Integrity</th>
                <th className="p-3">Target fingerprints</th>
                <th className="p-3">Policy / app version</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.clickId}
                  className="border-t border-[var(--rv-border)] align-top"
                >
                  <td className="p-3">
                    <code>{record.clickId}</code>
                    <br />
                    <code className="rv-muted">{record.requestId}</code>
                  </td>
                  <td className="p-3">
                    {record.timestamp.toISOString()}
                    <br />
                    {record.trackingDomain}
                    <br />
                    {record.destinationHostname}
                    <br />
                    Decision: {record.processingTimeMs.toFixed(2)} ms
                  </td>
                  <td className="p-3">
                    {hasRedirectIntegrity(record)
                      ? "Matched"
                      : "CRITICAL: mismatch"}
                    <br />
                    HTTP {record.redirectStatus}
                  </td>
                  <td className="p-3">
                    <div>
                      Provided: <code>{record.providedNextHopHash}</code>
                    </div>
                    <div>
                      Validated: <code>{record.validatedNextHopHash}</code>
                    </div>
                    <div>
                      Actual: <code>{record.actualRedirectTargetHash}</code>
                    </div>
                  </td>
                  <td className="p-3">
                    <code>{record.policyVersion}</code>
                    <br />
                    <code>{record.appVersion}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
