import { indexingPolicy } from "@/lib/routeverity/indexing-policy.cjs";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const { enabled, origin } = indexingPolicy(process.env);
  if (!enabled || !origin) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/app",
        "/account",
        "/operations",
        "/login",
        "/signup",
        "/api",
        "/click",
        "/conversion",
        "/r/",
        "/s/",
      ],
    },
    sitemap: new URL("/sitemap.xml", origin).toString(),
  };
}
