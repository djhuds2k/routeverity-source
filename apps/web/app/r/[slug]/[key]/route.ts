import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/routeverity/environment";
import { resolveStandardLink } from "@/lib/routeverity/redirect";
import { isLocalOrigin } from "@/lib/routeverity/validation";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; key: string }> },
) {
  if (!isLocalOrigin(appOrigin()))
    return new NextResponse("Development links are unavailable.", {
      status: 404,
    });
  const { slug, key } = await params;
  const domain = await prisma.domain.findFirst({
    where: { type: "DEVELOPMENT", project: { slug, disabledAt: null } },
  });
  const url = domain && (await resolveStandardLink(domain.slug, key, true));
  return url
    ? NextResponse.redirect(url, {
        status: 302,
        headers: { "Cache-Control": "no-store" },
      })
    : new NextResponse("Link not found or unavailable.", { status: 404 });
}
