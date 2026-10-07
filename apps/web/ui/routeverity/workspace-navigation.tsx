"use client";

import { brand } from "@/lib/routeverity/brand";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNavigation({ slug }: { slug: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Workspace"
      className="my-5 grid grid-cols-2 gap-1 md:flex md:flex-col"
    >
      {brand.navigation.map((item) => {
        const href = `/app/${slug}${item.slug ? `/${item.slug}` : ""}`;
        return item.enabled ? (
          <Link
            key={item.slug}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={`rounded-lg px-3 py-2.5 hover:bg-white ${pathname === href ? "bg-white font-medium shadow-sm" : ""}`}
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.slug}
            aria-disabled="true"
            className="rv-muted rounded-lg px-3 py-2.5"
          >
            {item.label}
            <span className="ml-2 text-[10px] uppercase">Soon</span>
          </span>
        );
      })}
    </nav>
  );
}
