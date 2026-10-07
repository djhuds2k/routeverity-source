import Link from "next/link";
import { notFound } from "next/navigation";

const pages: Record<
  string,
  { title: string; lead: string; sections: { title: string; text: string }[] }
> = {
  features: {
    title: "A clear foundation for advertising measurement",
    lead: "RouteVerity is being developed in focused milestones. We distinguish available functionality from planned capabilities.",
    sections: [
      {
        title: "Available today",
        text: "Verified email sign-in, workspaces, campaigns and destination policies, credential-bound transparent redirects, integrity audits, click reporting with asynchronous device enrichment and CSV export, direct click-attributed server conversions, currency-separated revenue, standard links, domain ownership verification and workspace settings.",
      },
      {
        title: "Planned",
        text: "Browser conversion SDK, raw advertising identifier retention, Google conversion uploads, unique-visitor/country measurement and webhooks are not enabled. Billing remains deferred.",
      },
    ],
  },
  "google-ads": {
    title: "Designed for transparent advertising measurement",
    lead: "Generate campaign-bound templates and inspect transparent next-hop behavior in local evaluation.",
    sections: [
      {
        title: "Certification status: not submitted",
        text: "RouteVerity is not Google certified, Google approved, or an official Google tracker. No certification or integration is claimed.",
      },
      {
        title: "Implementation status",
        text: "Campaign pages provide a Google Ads template generator, single-encoding local preview and bounded ValueTrack handling. This has not been tested in a live Google Ads account, certified or deployed. Use Google Ads Test only after DNS/TLS and hosting are ready. The ordinary test URL builder is distinct from the Google template generator.",
      },
      {
        title: "Parallel tracking and attribution",
        text: "Google parallel tracking sends visitors directly to the ad final URL while measurement runs separately. RouteVerity's response-header click ID does not automatically reach the merchant. No browser SDK, Google conversion upload or automatic merchant correlation is provided. GCLID, GBRAID and WBRAID are retained only as SHA-256 fingerprints, not recoverable identifiers.",
      },
    ],
  },
  pricing: {
    title: "Start with the free working baseline",
    lead: "Evaluate the foundation without a paid subscription.",
    sections: [
      {
        title: "Free development plan",
        text: "Up to 25 links and 3 custom domains per workspace. Local development domains do not count toward the custom-domain limit.",
      },
      {
        title: "Paid plans are deferred",
        text: "Billing, checkout and subscription handling are not enabled. No payment will be collected by this baseline.",
      },
    ],
  },
  transparency: {
    title: "Marketing attribution you can verify",
    lead: "Transparency starts with being precise about what our product does.",
    sections: [
      {
        title: "No fabricated measurement",
        text: "Transparent redirects create durable integrity records before returning HTTP 302. Reporting counts prepared redirects, not confirmed landing-page visits or unique people. Device/browser/OS metadata is asynchronously derived from the supplied user agent and can be absent or inaccurate. Conversion events and revenue are reported by authenticated customer servers, not independently verified payments. Direct attribution uses the owned click ID and a 30-day occurrence-time window, with immutable events and currency-separated totals.",
      },
      {
        title: "The visible next hop is authoritative",
        text: "On /click the url parameter selects the next hop. It is decoded once and checked against the active campaign's approved hostnames. ASCII URLs retain their query order, repeated query values, escapes and fragments; international URLs receive deterministic IDNA/URI encoding. The actual Location header must equal the validated next hop. No stored destination, visitor metadata, crawler identity, cookies or referrer selects an alternate target.",
      },
      {
        title: "Recognised parameters and controls",
        text: "The current schema requires url, rv_campaign and rv_token exactly once. Optional bounded Google fields are campaignid, adgroupid, creative, matchtype, device, network, gclid, gbraid and wbraid, each at most once. Unknown fields and unresolved macros are rejected. HTTPS destinations, a current campaign bearer credential and the campaign's owned, verified, unsuspended transparent tracking domain are required. Source fields never select or modify the destination. A generated click ID is returned in a response header, not injected into the destination. Credentials can be rotated or revoked; campaigns and domains can be suspended.",
      },
      {
        title: "Privacy and failure behavior",
        text: "Records contain random request/click IDs, workspace/campaign IDs, timestamp, tracking and destination hostnames, URL fingerprints, policy/app version, HTTP status and decision timing. Analytics captures a bounded user-agent string for asynchronous coarse device/browser/OS parsing, then deletes that raw string after enrichment. Only the referrer hostname is retained, not its path/query. Optional bounded Google source IDs and device/network/match-type values are self-reported. GCLID/GBRAID/WBRAID are retained as SHA-256 fingerprints only, never raw values. Conversion records store bounded order/reference IDs, optional opaque customer references and bounded scalar metadata supplied by the customer; do not submit sensitive personal data. No IP, visitor cookie or persistent visitor identity is collected. Target URLs, query values, fragments and bearer credentials are not stored as target data. Fingerprints and device metadata are not guaranteed anonymous. Database, audit or rate-limiter failures reject the request without a fallback redirect; enrichment downtime leaves reports pending without changing redirects.",
      },
      {
        title: "Retention and abuse reporting",
        text: "This remains a preproduction baseline. Filtered click CSV export is available to workspace members; comprehensive personal-data export, automatic expiry and organisation-deletion workflows are not implemented. Evidence survives campaign deletion. Raw user-agent strings remain pending while the enrichment worker is stopped; run it regularly and establish retention procedures before hosting. Report suspected abuse to abuse@routeverity.com; the product does not claim a deployed abuse inbox or automated malware screening.",
      },
      {
        title: "Open-source foundation",
        text: "RouteVerity uses permitted Dub open-source code under AGPL, with independently developed functionality. Restricted enterprise implementations and third-party icon assets are excluded.",
      },
      {
        title: "Corresponding source",
        text: "The free corresponding-source download in every page's footer is pinned to this version's release tag, including the permitted source, dependency lockfile, schema, tests and build/run instructions. This is a preproduction baseline, not a claim of live hosting, Google certification or operational readiness.",
      },
    ],
  },
  security: {
    title: "Trust through clear boundaries",
    lead: "Security controls should be explicit, not implied by a badge.",
    sections: [
      {
        title: "Account and workspace access",
        text: "One-time email verification, database-backed sessions, role-checked writes and workspace-scoped queries protect baseline access.",
      },
      {
        title: "Domain ownership",
        text: "Custom domains require a matching DNS TXT record. DNS routing and TLS must be configured with your hosting provider; the product does not claim to provision them.",
      },
      {
        title: "Deployment responsibility",
        text: "The local setup is not a production security certification. Configure HTTPS, production email, private service access, backups and appropriate operational controls before deployment.",
      },
    ],
  },
  "tracking-domains": {
    title: "Tracking domain deployment status",
    lead: "No RouteVerity public tracking domain has been deployed or activated by this local milestone.",
    sections: [
      {
        title: "Configured domains are not hosting claims",
        text: "Workspace owners may assign their own verified transparent tracking domains. DNS routing and valid TLS must be supplied by the operator. The intended click.routeverity.com brand endpoint is not listed as live or certified.",
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(pages).map((page) => ({ page }));
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const content = pages[page];
  if (!content) notFound();
  return (
    <main className="rv-grid min-h-screen px-6 py-10">
      <div className="rv-stack mx-auto max-w-3xl">
        <Link href="/" className="font-semibold">
          RouteVerity &larr; Home
        </Link>
        <h1 className="mt-8 text-4xl leading-tight">{content.title}</h1>
        <p className="rv-muted text-lg">{content.lead}</p>
        {content.sections.map((section) => (
          <section className="rv-card" key={section.title}>
            <h2 className="text-lg">{section.title}</h2>
            <p className="rv-muted mt-3 leading-relaxed">{section.text}</p>
          </section>
        ))}
        {page === "google-ads" && (
          <section className="rv-card rv-stack">
            <h2>Official setup references</h2>
            <a
              className="underline"
              href="https://support.google.com/google-ads/answer/6305348?hl=en"
            >
              Google ValueTrack and URL insertion
            </a>
            <a
              className="underline"
              href="https://support.google.com/google-ads/answer/6076199?hl=en"
            >
              Tracking templates, inheritance and final URLs
            </a>
            <a
              className="underline"
              href="https://support.google.com/google-ads/answer/7544674?hl=en"
            >
              Google parallel tracking
            </a>
          </section>
        )}
        <Link href="/signup" className="rv-button w-fit">
          Get Started
        </Link>
      </div>
    </main>
  );
}
