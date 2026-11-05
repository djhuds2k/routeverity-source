// Modified for RouteVerity, 2026-10-06 through 2026-10-17. See root NOTICE.md.
import { brand } from "@/lib/routeverity/brand";
import { appOrigin } from "@/lib/routeverity/environment";
import { sourceArchive } from "@/lib/routeverity/source";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(appOrigin()),
  title: { default: brand.name, template: `%s | ${brand.name}` },
  description: brand.description,
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>
        {children}
        <footer
          aria-label="Source code"
          className="border-t border-[var(--rv-border)] bg-white px-6 py-4 text-center text-sm"
        >
          <a href={sourceArchive} className="underline">
            Historical source archive (AGPL)
          </a>
          <Link href="/privacy" className="ml-4 underline">
            Privacy and retention
          </Link>
          <a href="/third-party-notices.txt" className="ml-4 underline">
            Third-party notices
          </a>
          <Link href="/contact" className="ml-4 underline">
            Contact
          </Link>
          <p className="rv-muted mt-3">
            {brand.legalName} &middot;{" "}
            <a className="underline" href={`mailto:${brand.contactEmail}`}>
              {brand.contactEmail}
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
