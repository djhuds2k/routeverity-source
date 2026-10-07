import { brand } from "@/lib/routeverity/brand";
import { sourceArchive } from "@/lib/routeverity/source";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s | ${brand.name}` },
  description: brand.description,
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
            Free corresponding source (AGPL)
          </a>
        </footer>
      </body>
    </html>
  );
}
