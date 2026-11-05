# Public evaluation pages and indexing

The public pages describe the implemented evaluation build, its attribution
limits and the remaining launch work. They do not announce hosted availability,
paid plans or Google certification. The merchant contract is implemented and
locally tested; a real merchant consent/session/order integration and permitted
live Google acceptance remain separate checks.

Owner-confirmed public identity (2026-10-30): **Multitouch Displays Ltd.**,
**contact@routeverity.com** for support, privacy and abuse. No message was sent
to test delivery, and no response-time commitment is published. Registered
business details, final privacy/terms/processing policies and operational support
procedures still require release review. The privacy page stays labelled draft.

The footer's existing source URL is labelled a **historical source archive**.
It does not claim to match the current build. A reviewed, matching immutable
source archive and notices must be published before public launch; relabelling
an old link is not corresponding-source or legal acceptance.

## Search policy

Search indexing is disabled by default. Every response has a default
`X-Robots-Tag: noindex, nofollow`; the root metadata also defaults to noindex.
`robots.txt` blocks crawling and the preproduction sitemap contains no URLs.
Robots directives are crawler instructions, not access control; authentication,
workspace permissions and private export protections remain separate controls.

After explicit release approval, set `ROUTEVERITY_PUBLIC_INDEXING=enabled` with
the same configuration at build and runtime, then rebuild/redeploy. Enabling
indexing is not authorized by this preparation. The policy also requires a
production Node environment and a public HTTPS `NEXTAUTH_URL` origin without
credentials, a path/query/fragment or nonstandard port. Local/IP/reserved hosts,
development and declared preview/unknown deployment environments remain blocked.

Only these fixed public routes receive indexable metadata/canonical-host header
overrides or sitemap entries: `/`, `/features`, `/google-ads`, `/pricing`,
`/transparency`, `/privacy`, `/security`, `/tracking-domains`, `/contact`.
Auth/account/workspace/operator/API/tracking and unknown routes retain the
default noindex header; tracking-domain hosts cannot use the public host override.
Canonical/social URLs use configured app origin, not incoming Host or query data.
The sitemap uses no fabricated modification dates or private database records.

Metadata routes/public pages and Next headers are build artifacts. Changing the
runtime flag alone is insufficient; verify rebuilt HTML, response headers,
robots and sitemap together on the approved canonical deployment before release.
Per-page titles/descriptions, Open Graph and Twitter summary metadata reuse the
existing brand image; no new imagery, certification or organization details are
invented.

References: [Next metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata),
[robots](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots),
[sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
and [header rules](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers).
