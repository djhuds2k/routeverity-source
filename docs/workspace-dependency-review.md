# Workspace dependency cleanup — 2026-10-31

## Candidate15 targeted install cleanup - E199, 1 November 2026

The E198 current-candidate review found four dated critical advisory records
matching installed happy-dom, XML parser and shell-quote versions, without
observed shipping-output matches. Candidate15 removes unused product HTML/
editor, Vercel helper and XML inputs and excludes Vitest optional happy-dom
for the explicitly Node-only product tests. It retains concurrently with a
scoped shell-quote1.11.0 repair and malicious-object/normal-command regressions.
Selected source has no direct/literal imports of these removed input families;
retained upstream consumers outside the supported export are not enabled.

The lock loses71 package versions and adds only shell-quote1.11.0. Two retained
Vercel package records refresh registry deprecation descriptions; their
versions/integrity and other retained package inputs do not change. The refreshed production-workspace audit records364 raw findings
(31low,177moderate,152high,4critical) across236 advisory records; all four
critical paths belong to deferred HubSpot tooling. None of happy-dom/XML parser
is installed in the filtered Linux product; shell-quote is1.11.0. The1376-entry
installed context preserves the same257 observed runtime identities. These are
scoped results, not a full security clearance. Exact build/test/audit results
belong in external E199 evidence.
Dated workspace counts below are historical; no clean-security or hosted
acceptance follows. Unresolved bundled/native/build-input and actual provider
review remain distinct from this scoped correction.

## Candidate9 acceptance review — E187, 2026-10-31

Status: **IN_PROGRESS**. The approved E186 report contains385 raw findings and
256 advisory records. All8 critical and118 high advisory records are now
registered, including all published dependency paths, installed/finding versions,
direct workspace sections, immediate lockfile callers, affected/fixed ranges,
runtime/build evidence and priority. The raw report's161 high findings are not
118 unique vulnerabilities in the website. The complete dated JSON/Markdown
register is private E187 release evidence; no findings are waived.

Full range comparison finds zero known-version affected matches in candidate9's
262 production-observed identities. Eight high records match unknown-version
vendor names: path-to-regexp, picomatch and ws. E183/E184/E185 evidence reviews
their exact Next release declarations or fixed forwarders; this is scoped
evidence, not permission to suppress all unknown versions. PostCSS observations
are build/test tooling, not evidence of a browser/server runtime defect. Zod4.6.7
is outside the reported older affected range. Native components and36 unknown
vendored identities remain outside a complete ordinary npm version comparison.

### Critical findings and actual owners

| Package / affected finding | Dependency owner / observed context | Advisory minimum fix | Next action |
| --- | --- | --- | --- |
| happy-dom18.0.1 | web → @tiptap/html3.15.3; installed, not observed in emitted/traced product | 20.0.0 | P2: remove unused editor parent from supported install or validate supported parent upgrade; never evaluate untrusted HTML/scripts in the retained tool |
| form-data2.x | hubspot-app → @hubspot/cli7.6.2 → cms-dev-server → request; absent from filtered product install | 2.5.4 | P3: keep deferred CLI out of deployment; migrate its parent only if reactivated |
| fast-xml-parser4.x | web → @vercel/functions3.4.3; installed, not observed runtime | 4.5.4 | P2: validate compatible parent/parser upgrade against every applicable advisory, not just this minimum |
| fast-xml-parser5.0.6 | direct web declaration; installed, not observed runtime | 5.3.5 | P2: confirm remaining supported caller, remove unused input or upgrade within supported major; later advisories may require a newer5.x |
| shell-quote≤1.8.3 | web → concurrently8.0.1; development command, installed not observed runtime | 1.8.4 | P2: compatible tooling repair with command-quoting regression before adoption |
| proxy-addr1.x | hubspot CLI development server; absent filtered product | 2.0.8 | P3: deferred parent migration; never expose legacy dev server |
| @storybook/core8.x | hubspot CLI/Storybook; absent filtered product | 8.6.19 | P3: deferred parent migration; no public Storybook build/server |
| storybook8.x | hubspot CLI/Storybook; absent filtered product | 8.6.19 | P3: same parent acceptance, no blind cross-major override |

Fixed versions above are each critical record's published minimum, not a claim
that every vulnerability affecting that family is fixed there. Each record in
the complete register retains its own fixed range and original advisory URL.

### Remediation and acceptance order

1. P0: investigate any newly demonstrated affected internet-facing runtime/input
   immediately. None is currently confirmed by this build's known-version range
   evidence. Recheck if platform, configuration or dependency bytes change.
2. P1: retain byte-checked Next repairs and bounded exploit regressions; finish
   unknown native/vendor coverage and deployment input review. Existing E184
   targeted tests and E186 credential regression remain bound to their revisions.
3. P2: active build/dev tool findings (XML, shell quoting, glob/minimatch, Axios,
   archive/email/lint) need supported parent/API-specific changes. Build in
   isolation without production credentials; do not process untrusted preview
   content. Test actual affected caller behavior for any fix, then freeze a new
   candidate. No speculative dependency change was made in E187.
4. P3: HubSpot/Storybook/MCP/legacy integration graphs are deferred tooling,
   never production entry points. Keep them out of the deployment install rather
   than delaying hosted preparation for an unlimited whole-monorepo migration.

No blanket major matcher override, security approval or acceptance of residual
risk is recorded. Release security acceptance remains **IN_PROGRESS** until the
actual hosting package/input model and unresolved native/vendor coverage have
been reviewed. [Native licensing review](native-licensing-review.md) is separate.

E186 follows the approved E185 production-workspace audit. The accepted product
build did not observe the newly flagged node-forge, follow-redirects, minimatch
or glob implementations in emitted/traced runtime evidence. Installed-only does
not mean universally unreachable; the dependency owners still need review.

## Completed scoped cleanup

Removed the active web manifest's unused `@boxyhq/saml-jackson` dependency.
SAML/SCIM/SSO is explicitly outside the product boundary; source references in
legacy Jackson/SAML/type helpers are not supported product entry points. The SDK
was the only node-forge parent. Its removal eliminates that entire dependency
chain rather than relying on a Forge version with unresolved advisory coverage.

Removed direct minimatch10.1.1 from the web manifest. Its direct use was in a
legacy referral-fraud helper outside the shipping app/shared source. This does
not remove transitive minimatch from build/email tooling or clear its findings.

Pinned retained follow-redirects1.x inputs below1.16.2 to1.16.2. All retained
Axios/http-proxy parent snapshots resolve to the fixed same-major version. A
bounded two-loopback-server fixture uses only a generated custom credential and
checks same-realm and genuine node:vm cross-realm sensitive-header arrays. The
old Linux candidate passes the normal-array case and leaks the synthetic header
in the cross-realm case; the repaired dependency passes both. No real credential
or external request is involved.

The new audit has385 findings (34low/182moderate/161high/8critical), down from487
including11critical. There are no node-forge or follow-redirects advisory records
in the new graph. These remain workspace counts, not proven site exploits or a
clean-security certificate. Product and release acceptance is recorded in E186.

## Remaining migration packages

| Family | Owner/caller contracts | Required follow-up |
| --- | --- | --- |
| minimatch3/5 | ESLint8 config, older glob7 and readdir-glob; callable CommonJS and older matching API | Migrate callers or prepare reviewed compatible backports. Forcing modern object exports into callable consumers is not validated |
| minimatch9/10 | Modern glob10/11 and TypeScript-ESLint parser | Test minimatch11.0.1 through real parser/glob APIs, matching semantics and trusted pattern handling; broad old-version advisories remain open |
| glob10/11 | Email preview CLI, archiver-utils, Storybook docgen and rimraf5 | Fixed14.0.2 is a major migration. Verify async/sync/stream/Glob interfaces, cancelled-signal behavior, archive/preview paths and Node22 installation |
| glob7 | rimraf3 and sucrase | Retain distinct callback consumers during modern migration. This version is outside the recent >=9 cancellation range, but other legacy findings are not waived |

The current product lint command uses ESLint8's eslintrc interface. A parent
upgrade to ESLint9 needs deliberate flat-config/CLI migration; it is not resolved
by renaming a dependency version. Modern glob/minimatch fixed versions support
Node22 but have new exports/dependencies. Compatibility validation must cover the
retained tooling, not only route/browser tests. These migrations remain separate
open packages alongside the remaining critical workspace advisories.

Sources: [follow-redirects cross-realm advisory](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p),
[glob cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4),
[minimatch preprocessing](https://github.com/advisories/GHSA-g3hv-75wg-m249).
