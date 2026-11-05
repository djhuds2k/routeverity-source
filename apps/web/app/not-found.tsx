// Modified for RouteVerity, 2026-10-06 through 2026-10-17. See root NOTICE.md.
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="rv-page rv-stack">
      <h1>Page not found</h1>
      <p>This page is unavailable in the RouteVerity baseline.</p>
      <Link className="rv-button w-fit" href="/app">
        Open your workspace
      </Link>
    </main>
  );
}
