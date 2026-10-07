import { requireWorkspace } from "@/lib/routeverity/auth";
import { brand } from "@/lib/routeverity/brand";
import { SignOut } from "@/ui/routeverity/sign-out";
import { WorkspaceNavigation } from "@/ui/routeverity/workspace-navigation";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace } = await requireWorkspace(slug);
  return (
    <div className="min-h-screen bg-neutral-200 p-2 md:flex">
      <aside className="mb-2 flex shrink-0 md:mb-0 md:w-[304px]">
        <div className="hidden w-16 shrink-0 flex-col items-center gap-6 py-4 md:flex">
          <Link href="/app" title="Workspaces">
            <Image
              src={brand.logo}
              alt="RouteVerity workspaces"
              width={40}
              height={40}
            />
          </Link>
        </div>
        <div className="flex w-full shrink-0 flex-col rounded-xl bg-neutral-100 px-4 py-4 md:w-60">
          <Link href="/app" className="font-semibold">
            {workspace.name}
          </Link>
          <span className="rv-muted mt-1 text-xs">Free development plan</span>
          <WorkspaceNavigation slug={slug} />
          <div className="mt-auto space-y-3 border-t border-neutral-200 pt-4">
            <Link href="/" className="block text-sm">
              RouteVerity website
            </Link>
            <SignOut />
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <header className="flex h-12 items-center justify-between border-b px-3 sm:h-16 sm:px-6">
          <Link href={`/app/${slug}`} className="font-semibold">
            {workspace.name}
          </Link>
          <span className="rv-muted text-xs">RouteVerity</span>
        </header>
        {children}
      </div>
    </div>
  );
}
