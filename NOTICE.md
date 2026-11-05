# RouteVerity source and modification notice

This is a modified, sanitized version of permitted Dub open-source software,
based on upstream commit `3cc0c50e39b7ee35ebddf9c9a030293130da9af9`.
Copyright (c) 2024-present Dub Technologies, Inc. Existing upstream notices and
the complete [root licence](LICENSE.md) are retained.

RouteVerity modifications and independent additions, 2026-10-06 through
2026-10-19, include the transparent tracker, campaign policies and reporting,
authentication and workspace controls, conversion and merchant ingestion,
bounded reconciliation/retention/enrichment/health workers, privacy/export/
deletion, operator controls, RouteVerity interface and branding, tests, local
service/build tooling, licensing inventories and source-release preparation.
They are provided under the root AGPL terms (manifests declare
AGPL-3.0-or-later; the root wording/version distinction requires review), subject to third-party
material's original terms. No proprietary implementation is licensed by this
notice. No trademark rights or legal clearance are claimed.

Prominent dated notices identify modified upstream code/schema files. Modified
structured configuration that cannot carry comments includes root/web/email
package manifests, the frozen lockfile, web TypeScript and hosting configuration.
The environment example, README, ignore configuration and permitted shared UI/
email/build files have also been adapted. New RouteVerity application, library,
worker, test and documentation files are identified by the archive's complete
file manifest; a hash map alongside the archive defines the exact revision.
The upstream commit alone does not identify these uncommitted modifications.

Four restricted trees, original Git history, the archived upstream application,
installed dependencies, generated clients/build products, real environment
files and private operational records are deliberately omitted. See the
[exclusions](docs/licensing-exclusions.json) and [source release](docs/source-release.md).

Third-party licence/copyright texts are preserved in
[public third-party notices](apps/web/public/third-party-notices.txt), reachable
at `/third-party-notices.txt` in the application. The
[audit](docs/licensing-audit.md) and [machine inventory](docs/licensing-inventory.json)
distinguish actual emitted/traced components, source-only workspaces, build
tools, native libraries and installed-only packages. Outstanding attribution,
native-binary and other legal questions are not silently waived.

Linux release preparation on 2026-10-19 updates platform-specific inventories/
notices and prevents the libvips packaging scripts' Apache licence from being
misrepresented as permission for all bundled native libraries. Unresolved native
and React marker-package attribution/provenance remains explicit.

Security preparation on 2026-10-29 updates the application and permitted shared
packages to Next.js 15.5.28 and pins Next.js's Sharp dependency to 0.35.5 in the
workspace configuration and lockfile. Existing platform inventories, generated
third-party notices and published source archives describe their recorded
earlier builds; regenerate and review the matching release materials before
distributing this changed dependency graph.

SMTP security preparation on 2026-10-29 updates email sign-in and operational
notifications to Nodemailer 10.3.0, adapts accepted-recipient handling to its
bundled types, and moves the existing React type overrides to the workspace
root so they are applied consistently. The manifest, lockfile and notification
helper changes require refreshed matching release materials before distribution.

Validation and ID security preparation on 2026-10-29 pins active Zod 4 users to
4.6.7 and Nano ID users to patched versions within their existing major lines
(5.1.16 and 3.3.18). Adds a regression test for early rejection of oversized
campaign destination policies. Retained upstream Zod 3 consumers are not silently
migrated to Zod 4; their remaining advisory and release review stay explicit.

Shipping-dependency preparation on 2026-10-30 removes unused Firecrawl and
Plain SDK declarations from the active web package and patches the observed
base-x, js-cookie, Babel runtime, mdast-to-hast, Tiptap core/PM and ProseMirror
dependency versions within their existing major lines. Build inventory and
advisory matching remain scoped technical evidence, not legal clearance or
proof of exploitability. Refresh matching target-platform release materials.

The same 2026-10-30 preparation makes temporary DNS resolver failures explicit
without changing ownership status, with unit and browser assertions separating
missing TXT records from resolver outages. Unexpected failures still propagate.

CI preparation on 2026-10-30 adds a dedicated permitted-source product workflow,
manual-only labels for obsolete upstream test/format workflows, opt-in owned
Playwright server management and a tested completion-report gate. CI scripts,
workflow and documentation are included in corresponding-source preparation;
local validation is not a claim that GitHub-hosted execution has occurred.

Public-site preparation on 2026-10-30 reconciles evaluation and merchant claims,
adds the owner-confirmed operator/contact details and labels the old source link
as historical. Per-page canonical/social metadata, robots/sitemap routes and a
default-deny release indexing policy are independently added and tested. Public
indexing, deployment, final legal approval and a new source release are not
activated by these changes.

Local source-release preparation on 2026-10-30 refreshes Ubuntu Linux dependency
inventory and notices for the current security/CI/public-page revision. The
independent notice fetcher now reads the package-specific Next release dependency
file, validates release identity and includes regression tests for mismatches.
Version-pinned upstream texts are retained unchanged with checksums. Four marker/
native attribution gaps and other recorded review obligations remain explicit;
this preparation does not grant legal clearance, publish source or deploy a site.

Security repair on 2026-10-30 adds a reproducible, version-bound pnpm patch for
Next15.5.28. Four compiled entry points forward to pinned fixed upstream cookie,
picomatch, send and ws packages. The compiled Babel external-map read delegates
to the publisher's verified reader from @babel/core7.29.6, preserving the older
core version and remaining compiler behavior. Original framework notices remain;
actual dependency notices are collected separately. Policy, generator, installed
byte checks, bounded regressions and build/export wiring are independently added.
This is scoped technical remediation, not broad security or legal clearance.

Workspace dependency cleanup on2026-10-31 removes unused SAML/SCIM and direct
legacy matcher inputs from the active web manifest, preserving the documented
product boundary. Same-major follow-redirects1.16.2 is selected for retained
Axios/proxy dependency chains. Source/reference files and earlier candidate
archives are preserved; no SSO feature, provider or public deployment is enabled.

Exception-telemetry privacy repair on 2026-10-31 replaces the inherited Next
request-error logger with a bounded RouteVerity event/type/incident-ID record.
Unexpected mutation errors use the same helper; raw request/query/header/body,
error message/stack/cause and arbitrary error names are not forwarded. Standard
Web Crypto supports the Node and Edge hook builds. Focused regressions cover
synthetic secret-bearing errors, hostile accessors and existing mutation/auth
responses. This does not change redirect, conversion or attribution decisions,
publish source, activate external telemetry or certify provider log privacy.

Native notice preparation on 2026-10-31 corrects the uhdr/libultrahdr licence-table
alias and preserves the exact libultrahdr 2.0.2 upstream text with its checksum
and source revision. The vendor summary and complete upstream text remain
distinct; no SPDX choice or complete native-bundle clearance is inferred.
Regression cases cover unknown declarations, scoped evidence, altered bytes and
unsafe paths. Four existing native/marker provenance and conveyance gaps remain.

Modification record, 1 November 2026: removed unused product manifest inputs
for legacy HTML/editor, Vercel helper and XML features; retained the supported
development command with a scoped compatible shell-quote repair and regression
coverage. Corrected dated local release/privacy/provider guide statements.
No live deployment, provider selection, source publication or rights waiver is
represented by these local changes.

Product tests explicitly use the Node environment and omit the unused optional
DOM peer of the test runner. The retained shell-quoting command path is tested
for supported literal arguments and rejection of malicious object tokens.

Modification record, 5 November 2026: hosting configuration now sets
git.deploymentEnabled=false to suppress automatic Git-triggered Vercel
deployments for this source. Explicit deployment methods and live provider
settings remain separate controls. The install/build contract, application,
dependencies, schema, CI workflow and third-party texts are unchanged by this
configuration/documentation batch. No hosted acceptance, publication or new
rights/provenance finding is represented.

Modification record, 5 November 2026 (CI bootstrap): explicitly disabled pnpm
and setup-node dependency caching for the first public Product checks run.
The install/build/test commands, pinned action revisions and application inputs
are unchanged. No paid cache capacity or runner is requested by this workflow.
