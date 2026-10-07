import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/routeverity/auth";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ConversionDetail({
  params,
}: {
  params: Promise<{ slug: string; conversionId: string }>;
}) {
  const { slug, conversionId } = await params;
  const { workspace } = await requireWorkspace(slug);
  const conversion = await prisma.routeVerityConversion.findFirst({
    where: { id: conversionId, projectId: workspace.id },
  });
  if (!conversion) notFound();
  const fields = [
    ["Conversion ID", conversion.id],
    ["Event", conversion.event],
    ["Order/reference", conversion.orderId],
    ["Customer reference", conversion.customerReference ?? "Not supplied"],
    ["Campaign ID", conversion.campaignId],
    ["Goal ID", conversion.goalId],
    ["Revenue", `${conversion.currency} ${conversion.revenue.toFixed(3)}`],
    ["Occurred (UTC)", conversion.occurredAt.toISOString()],
    ["Received (UTC)", conversion.receivedAt.toISOString()],
    ["Attribution policy", conversion.attributionPolicy],
    ["Metadata", JSON.stringify(conversion.metadata)],
  ];
  return (
    <main className="rv-page rv-stack">
      <Link className="underline" href={`/app/${slug}/conversions`}>
        Back to conversions
      </Link>
      <h1>Conversion detail</h1>
      <Link
        className="break-all underline"
        href={`/app/${slug}/analytics/${conversion.clickId}`}
      >
        Attributed click: {conversion.clickId}
      </Link>
      <dl className="rv-card grid gap-5 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="font-semibold">{label}</dt>
            <dd className="rv-muted mt-2 break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="rv-muted">
        Immutable server-reported event. No payment verification,
        refund/correction handling or inferred visitor attribution is claimed.
      </p>
    </main>
  );
}
