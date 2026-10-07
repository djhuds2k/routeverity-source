import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/routeverity/auth";
import { saveCampaign } from "@/lib/routeverity/campaign-actions";
import {
  campaignStatuses,
  currencies,
  parameterKeys,
  trafficSources,
} from "@/lib/routeverity/campaign-policy";
import { canWrite } from "@/lib/routeverity/validation";
import { CampaignForm } from "@/ui/routeverity/campaign-form";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function NewCampaign({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace, role } = await requireWorkspace(slug);
  if (!canWrite(role)) redirect(`/app/${slug}/campaigns`);
  const domains = await prisma.domain.findMany({
    where: { projectId: workspace.id, type: "TRANSPARENT_TRACKING" },
  });
  return (
    <main className="rv-page rv-stack max-w-4xl">
      <Link className="underline" href={`/app/${slug}/campaigns`}>
        Back to campaigns
      </Link>
      <h1>Create campaign</h1>
      {!domains.length && (
        <p className="rv-muted">
          No transparent tracking domains yet. You can save a draft now and add
          a domain under Domains later.
        </p>
      )}
      <section className="rv-card">
        <CampaignForm
          action={saveCampaign.bind(null, slug, null)}
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
    </main>
  );
}
