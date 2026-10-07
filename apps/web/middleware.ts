import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const configuredOrigin = process.env.NEXTAUTH_URL;
  if (!configuredOrigin)
    return new NextResponse("Application origin is not configured.", {
      status: 503,
    });
  const host = request.headers.get("host")?.split(":")[0].toLowerCase();
  const applicationHost = new URL(configuredOrigin).hostname.toLowerCase();
  const localAlias =
    ["localhost", "127.0.0.1"].includes(applicationHost) &&
    ["localhost", "127.0.0.1"].includes(host ?? "");
  if (host !== applicationHost && !localAlias) {
    if (request.nextUrl.pathname === "/click") return NextResponse.next();
    const key = request.nextUrl.pathname.slice(1);
    if (!host || !/^[a-zA-Z0-9_-]{1,80}$/.test(key) || request.method !== "GET")
      return new NextResponse("Link not found.", { status: 404 });
    const url = request.nextUrl.clone();
    url.pathname = `/s/${host}/${key}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
