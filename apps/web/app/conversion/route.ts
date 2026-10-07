import { conversionIngestion } from "@/lib/routeverity/conversion-ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = conversionIngestion;
export const HEAD = conversionIngestion;
export async function POST() {
  return new Response("Use POST /api/v1/conversions.", {
    status: 405,
    headers: { Allow: "GET", "Cache-Control": "private, no-store" },
  });
}
