import { dataExportResponse } from "@/lib/routeverity/data-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return dataExportResponse(request);
}
