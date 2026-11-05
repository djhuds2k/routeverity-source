import { dataExportResponse } from "@/lib/routeverity/data-export";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return dataExportResponse(request, slug);
}
