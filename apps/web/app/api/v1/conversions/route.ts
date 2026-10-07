import { conversionIngestion } from "@/lib/routeverity/conversion-ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = conversionIngestion;
export const GET = conversionIngestion;
export const HEAD = conversionIngestion;
export const PUT = conversionIngestion;
export const PATCH = conversionIngestion;
export const DELETE = conversionIngestion;
export const OPTIONS = conversionIngestion;
