import { prisma } from "@/lib/prisma";
import { userAgentFromString } from "next/server";

export function enrichUserAgent(value: string | null) {
  const parsed = userAgentFromString(value ?? "");
  return {
    device: parsed.device.type ?? (parsed.browser.name ? "desktop" : "Unknown"),
    browser: parsed.browser.name ?? "Unknown",
    operatingSystem: parsed.os.name ?? "Unknown",
  };
}

export async function enrichClickBatch(limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500)
    throw new Error("Enrichment batch size must be between 1 and 500.");
  const pending = await prisma.routeVerityRedirectAudit.findMany({
    where: { analyticsCaptured: true, enrichedAt: null },
    orderBy: [{ timestamp: "asc" }, { clickId: "asc" }],
    take: limit,
    select: { clickId: true, rawUserAgent: true },
  });
  let enriched = 0;
  for (const record of pending) {
    const metadata = enrichUserAgent(record.rawUserAgent);
    const updated = await prisma.routeVerityRedirectAudit.updateMany({
      where: {
        clickId: record.clickId,
        analyticsCaptured: true,
        enrichedAt: null,
      },
      data: { ...metadata, enrichedAt: new Date(), rawUserAgent: null },
    });
    enriched += updated.count;
  }
  return { scanned: pending.length, enriched };
}
