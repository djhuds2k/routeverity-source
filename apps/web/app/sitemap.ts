import {
  indexingPolicy,
  publicPaths,
} from "@/lib/routeverity/indexing-policy.cjs";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const { enabled, origin } = indexingPolicy(process.env);
  return enabled && origin
    ? publicPaths.map((path) => ({ url: new URL(path, origin).toString() }))
    : [];
}
