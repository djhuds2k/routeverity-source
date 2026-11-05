import { brand } from "@/lib/routeverity/brand";
import { publicMetadata } from "@/lib/routeverity/public-metadata";
import Image from "next/image";
import Link from "next/link";

export const metadata = publicMetadata(
  "/",
  "Transparent click tracking",
  "Transparent redirects, campaign reports and server-side conversion measurement. Preproduction evaluation; hosted launch and merchant integration remain in review.",
);

export default function Home() {
  return (
    <div className="rv-grid min-h-screen">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-5">
        <Link href="/">
          <Image
            src={brand.wordmark}
            alt="RouteVerity"
            width={216}
            height={54}
            priority
          />
        </Link>
        <nav
          aria-label="Public"
          className="flex flex-wrap items-center gap-5 text-sm"
        >
          {[
            ["Features", "features"],
            ["Google Ads", "google-ads"],
            ["Pricing", "pricing"],
            ["Transparency", "transparency"],
            ["Security", "security"],
          ].map(([title, path]) => (
            <Link key={path} className="hover:underline" href={`/${path}`}>
              {title}
            </Link>
          ))}
          <Link href="/login">Login</Link>
          <Link className="rv-button" href="/signup">
            Evaluate the app
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 pb-20 pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--rv-action)]">
          Advertising infrastructure, without the guesswork
        </p>
        <section className="mt-7 grid gap-10 lg:grid-cols-2">
          <div>
            <h1 className="max-w-2xl text-5xl leading-[1.1] sm:text-6xl">
              {brand.tagline}
            </h1>
            <p className="rv-muted mt-6 max-w-lg text-xl leading-relaxed">
              Inspect transparent redirects, report campaign clicks and measure
              conversions reported by your server.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/signup" className="rv-button">
                Evaluate the app
              </Link>
              <Link href="/transparency" className="rv-button rv-secondary">
                Our approach
              </Link>
            </div>
            <p className="rv-muted mt-6 text-sm">
              Preproduction evaluation. Core tracking and reporting are
              implemented; hosted launch and real merchant integration remain in
              review.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-[var(--rv-ink)] p-8 text-white sm:p-12">
            <p className="text-xs uppercase tracking-widest text-[var(--rv-inverse)]">
              Built around a clear signal
            </p>
            <div aria-hidden="true" className="my-12 flex items-center gap-3">
              <span className="h-4 w-4 rounded-full bg-[var(--rv-signal)]" />
              <span className="h-px flex-1 bg-[var(--rv-inverse)]" />
              <Image src={brand.logo} alt="" width={84} height={84} />
              <span className="h-px flex-1 bg-[var(--rv-inverse)]" />
              <span className="h-4 w-4 rounded-full border border-[var(--rv-inverse)]" />
            </div>
            <h2 className="text-2xl">Know what your infrastructure does.</h2>
            <p className="mt-4 leading-relaxed text-[var(--rv-inverse)]">
              Clear ownership. Verifiable destinations. No invented performance
              metrics.
            </p>
          </div>
        </section>
        <section className="mt-16 grid gap-5 md:grid-cols-3">
          {[
            [
              "Transparent redirects",
              "Campaign policies validate the visible destination and record redirect evidence before sending the response.",
            ],
            [
              "Reports and conversions",
              "Review retained click evidence, export reports and receive authenticated server conversion events with revenue separated by currency.",
            ],
            [
              "Your workspaces and domains",
              "Verified email access, workspace roles and domain ownership controls. Hosting and TLS require separate setup.",
            ],
          ].map(([title, text]) => (
            <article className="rv-card" key={title}>
              <h2 className="text-lg">{title}</h2>
              <p className="rv-muted mt-3 leading-relaxed">{text}</p>
            </article>
          ))}
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 border-t border-[var(--rv-border)] px-6 py-8 text-sm">
        <span>RouteVerity &middot; Transparent click tracking.</span>
        <div className="flex gap-5">
          <Link href="/transparency">Transparency</Link>
          <Link href="/security">Security</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
