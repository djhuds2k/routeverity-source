import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/routeverity/auth";
import {
  campaignReadiness,
  trafficSources,
} from "@/lib/routeverity/campaign-policy";
import { canWrite } from "@/lib/routeverity/validation";
import Link from "next/link";

export default async function Campaigns({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace, role } = await requireWorkspace(slug);
  const campaigns = await prisma.routeVerityCampaign.findMany({
    where: { projectId: workspace.id },
    orderBy: { createdAt: "desc" },
    include: { destinationDomains: true, trackingDomain: true },
  });
  return (
    <main className="rv-page rv-stack">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>Campaigns</h1>
          <p className="rv-muted mt-2">
            Advertisers, destination policies and tracking configuration.
          </p>
        </div>
        {canWrite(role) && (
          <Link className="rv-button" href={`/app/${slug}/campaigns/new`}>
            Create campaign
          </Link>
        )}
      </div>
      <p className="rv-muted">
        Transparent redirects require an active campaign, credential and
        configured tracking domain. Click reporting and direct click-attributed
        conversion reporting are available.
      </p>
      <section className="rv-card overflow-x-auto">
        {!campaigns.length ? (
          <div className="py-12 text-center">
            <h2>No campaigns yet</h2>
            <p className="rv-muted mt-3">
              Create a draft to configure your advertiser and approved
              destination domains.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th>Campaign / Advertiser</th>
                <th>Traffic source</th>
                <th>Status</th>
                <th>Configuration</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <Link
                      className="font-medium underline"
                      href={`/app/${slug}/campaigns/${campaign.id}`}
                    >
                      {campaign.name}
                    </Link>
                    <p className="rv-muted mt-1">{campaign.advertiser}</p>
                  </td>
                  <td>
                    {
                      trafficSources.find(
                        (source) => source.value === campaign.trafficSource,
                      )?.label
                    }
                  </td>
                  <td>{campaign.status}</td>
                  <td className="rv-muted">
                    {campaignReadiness(campaign) ??
                      "Ready for future tracking (not live)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
