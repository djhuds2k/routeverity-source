import type { Metadata } from "next";
import { brand } from "./brand";
import { appOrigin } from "./environment";
import { indexingPolicy } from "./indexing-policy.cjs";

export function publicMetadata(
  path: string,
  title: string,
  description: string,
): Metadata {
  const url = new URL(path, appOrigin()).toString();
  const { enabled } = indexingPolicy(process.env);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: enabled, follow: enabled },
    openGraph: {
      type: "website",
      siteName: brand.name,
      title,
      description,
      url,
      images: [{ url: brand.logo, alt: brand.name }],
    },
    twitter: { card: "summary", title, description, images: [brand.logo] },
  };
}
