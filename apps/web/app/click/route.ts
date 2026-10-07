import { transparentRedirect } from "@/lib/routeverity/transparent-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = transparentRedirect;
export const HEAD = transparentRedirect;
export const POST = transparentRedirect;
export const PUT = transparentRedirect;
export const PATCH = transparentRedirect;
export const DELETE = transparentRedirect;
export const OPTIONS = transparentRedirect;
