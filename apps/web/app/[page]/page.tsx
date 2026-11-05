import { brand } from "@/lib/routeverity/brand";
import { publicMetadata } from "@/lib/routeverity/public-metadata";
import Link from "next/link";
import { notFound } from "next/navigation";

const pages: Record<
  string,
  { title: string; lead: string; sections: { title: string; text: string }[] }
> = {
  features: {
    title: "Campaigns, clicks and server conversions",
    lead: "Explore the implemented preproduction product. Hosted operation and a real merchant deployment remain in review.",
    sections: [
      {
        title: "Campaigns and transparent redirects",
        text: "Create campaigns, approve destination hostnames and issue revocable tracking credentials. Transparent redirects validate the visible next hop and record durable evidence before returning the response. Standard links and DNS ownership checks are also implemented.",
      },
      {
        title: "Reports and conversion events",
        text: "Inspect retained click evidence, derived device/browser/OS dimensions and CSV exports. Authenticated server conversion events support exact revenue separated by currency. Reports measure prepared redirects and customer-reported conversions, not verified visits, people or payments.",
      },
      {
        title: "Merchant integration and workspace controls",
        text: "A consent-gated merchant endpoint supports limited matching against recorded GCLID hashes, separate unmatched outcomes and bounded reconciliation. Merchants must integrate their own consent, session/order storage and durable retries. Verified email access, workspace roles, retention settings, export/deletion and configured operator controls are implemented.",
      },
      {
        title: "Evaluation scope",
        text: "The browser conversion SDK, Google conversion uploads, unique-visitor/country measurement, outgoing webhooks and paid billing are not enabled. DNS/TLS provisioning, production supervision, recovery and hosted merchant acceptance remain launch work. Google certification has not been submitted.",
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
        text: "Google parallel tracking sends visitors directly to the ad final URL while measurement runs separately. RouteVerity's response-header click ID does not automatically reach the merchant. The implemented merchant endpoint can match a consented GCLID hash only when a single eligible retained request exists. Repeated identifiers can be ambiguous; they are not treated as unique Google clicks. Merchants must supply their own consent and order/session integration. This contract has local acceptance, not hosted or live Google acceptance. Advertising identifiers are retained as SHA-256 fingerprints, not recoverable values. No browser SDK or Google conversion upload is provided.",
      },
    ],
  },
  pricing: {
    title: "Evaluate the preproduction app",
    lead: "The current evaluation build does not collect subscription payments. Commercial plans and launch availability are not announced.",
    sections: [
      {
        title: "Current evaluation limits",
        text: "The default workspace configuration allows up to 25 standard links and 3 custom domains. Local development domains do not count toward the custom-domain limit. These evaluation limits are not a commercial service or availability commitment.",
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
        title: "Measurement scope",
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
        text: "This remains a preproduction baseline. Owners select 30, 60 or 90 days of detailed click/conversion retention; 90 days is the default and maximum. Click evidence expires from creation, conversions and retry receipts from conversion receipt. Evidence survives campaign deletion only until its retention deadline. A separate cleanup worker erases pending raw user agents at 24 hours and operator suspension audits after 365 days; hosted scheduling and failure alerts are not configured yet. Successful enrichment clears raw input sooner; late enrichment uses unknown dimensions. Cleanup permanently changes historical reports and exports, and removes expired retry/deduplication evidence. Owners can erase workspace data through account controls; account deletion requires no owned workspaces, revokes live sessions and preserves other members' workspaces/links. Operator incident history remains for its separate retention. Filtered click CSV, owner-only retained-workspace JSON and personal-account JSON exports are available. JSON downloads exclude credential fields and raw UA, and reject collection/byte overflow rather than truncating data. Larger export fulfilment and legal rights-request handling remain release work. See Privacy and retention for the draft policy and release limits. Contact contact@routeverity.com for suspected abuse. Automated malware screening is not provided.",
      },
      {
        title: "Open-source foundation",
        text: "RouteVerity uses permitted Dub open-source code under AGPL, with independently developed functionality. Restricted enterprise implementations and third-party icon assets are excluded.",
      },
      {
        title: "Corresponding source",
        text: "The footer links to a historical preproduction source archive. It is not represented as matching the current evaluation build. A reviewed matching corresponding-source release and notices are required before any public launch. This evaluation does not claim live hosting, Google certification or operational readiness.",
      },
    ],
  },
  privacy: {
    title: "Privacy and retention",
    lead: "Preproduction privacy notice: implementation facts, not a claim of GDPR compliance or a final legal policy.",
    sections: [
      {
        title: "Operator and enquiries",
        text: `${brand.name} is operated by ${brand.legalName} Contact ${brand.contactEmail} for privacy requests, support or abuse reports. This identifies the operator and enquiry channel; the policy remains a preproduction draft pending legal review.`,
      },
      {
        title: "Merchant submissions",
        text: "The merchant endpoint requires an explicit granted measurement-consent assertion before retaining minimal order/event, currency, amount and occurrence data with a supplied GCLID hash. Missing or ambiguous evidence is reported separately from attributed revenue. Pending no-match submissions can be reconciled for 24 hours from first receipt; retries do not extend that deadline. Hashes are cleared at attributed or terminal outcomes, subject to worker operation and retention cleanup. The assertion is not independent proof of valid consent.",
      },
      {
        title: "Account and tracking data",
        text: "Dashboard accounts use email addresses, workspace membership and database-backed sessions. Click records contain random identifiers, timestamps, hostnames, integrity fingerprints and bounded coarse metadata. No IP address, persistent visitor identifier or visitor cookie is stored in click/conversion records. Optional advertising identifiers are hash-only, not guaranteed anonymous. Customer-submitted order IDs, opaque references and scalar metadata can still be personal data; do not submit sensitive personal data or secrets.",
      },
      {
        title: "Retention and expiry",
        text: "Detailed click/redirect records are retained for 90 days by default, with owner settings of 30 or 60 days available. Conversion events and retry receipts use the same setting measured from conversion receipt, not occurrence date. Operator suspension/resumption audits have a separate 365-day limit. Raw user-agent strings are cleared after successful enrichment or become eligible for erasure at 24 hours. Late enrichment uses unknown dimensions. A separate cleanup worker performs erasure; hosting, supervision and expiry-failure alerts remain release gates. A stopped cleanup worker cannot guarantee physical deletion deadlines. Increasing retention cannot restore deleted records.",
      },
      {
        title: "Authentication cookies and infrastructure",
        text: "Dashboard authentication uses essential session and request-verification cookies. The transparent click endpoint does not add visitor-tracking cookies. Hosting, email, database and rate-limiter providers may process network addresses and operational logs separately; application-level collection limits do not prove those providers collect nothing. The final list of hosting, database, rate-limiter and email providers will be published after the hosting arrangement is confirmed. Provider agreements, regions, log retention and transfer safeguards remain under review.",
      },
      {
        title: "Rights, export and release limits",
        text: "Authenticated workspace members can export filtered click CSV data. Owner-only workspace JSON contains retained active-product configuration, memberships by random user ID, clicks and conversions; personal-account JSON contains your own profile, memberships and non-secret session/provider metadata. JSON exports exclude credential fields, raw UA and operator incident history, and are limited to 10,000 rows per collection and 20 MiB total with explicit errors and no partial file. They are not database backups or complete legal subject-access responses; customer notes/URLs/metadata may contain sensitive text. Owners can permanently erase workspace operational data with exact address confirmation; operator incident audits retain random scalar IDs and reasons for their separate 365-day policy. Account deletion requires no owned workspaces and exact email confirmation, removes live sessions/login tokens and memberships, and clears author IDs while preserving links in others' workspaces. Suspended owned workspaces still block account deletion but can be exported or erased through account controls. Live database erasure cannot remove previously downloaded exports or instantly erase provider backups, logs or external DNS/hosting; restoration needs reapplication of expiry rules. Registered business details, lawful bases, customer processing agreements, larger-export fulfilment and backup/log retention must be finalized before accepting customers. Contact contact@routeverity.com for privacy, support or abuse enquiries.",
      },
    ],
  },
  security: {
    title: "Access controls and release readiness",
    lead: "Review the controls implemented in the evaluation build. Production security and operational acceptance remain separate launch gates.",
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
  contact: {
    title: "Contact RouteVerity",
    lead: `Operated by ${brand.legalName}`,
    sections: [
      {
        title: "Support, privacy and abuse",
        text: `Use ${brand.contactEmail} for product support, privacy enquiries and suspected abuse. Include relevant workspace or campaign references when needed; do not email passwords, session links, tracking credentials or unnecessary personal data.`,
      },
      {
        title: "Evaluation status",
        text: "RouteVerity remains in preproduction. Hosted availability, commercial plans, support response commitments and final legal policies have not been announced.",
      },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const content = pages[page];
  if (!content) notFound();
  return publicMetadata(`/${page}`, content.title, content.lead);
}

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
        {page === "contact" ? (
          <a href={`mailto:${brand.contactEmail}`} className="rv-button w-fit">
            Email RouteVerity
          </a>
        ) : (
          <Link href="/signup" className="rv-button w-fit">
            Evaluate the app
          </Link>
        )}
      </div>
    </main>
  );
}
