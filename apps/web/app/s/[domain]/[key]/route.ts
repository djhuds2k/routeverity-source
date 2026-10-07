import { resolveStandardLink } from "@/lib/routeverity/redirect";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ domain: string; key: string }> },
) {
  const { domain, key } = await params;
  if (
    new URL(`http://${request.headers.get("host")}`).hostname.toLowerCase() !==
    domain.toLowerCase()
  )
    return new NextResponse("Link not found.", { status: 404 });
  const url = await resolveStandardLink(domain, key, false);
  return url
    ? NextResponse.redirect(url, {
        status: 302,
        headers: { "Cache-Control": "no-store" },
      })
    : new NextResponse("Link not found or unavailable.", { status: 404 });
}
