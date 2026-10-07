# Milestone 0 licensing audit

Date: 2026-10-06.
Upstream: <https://github.com/dubinc/dub> at
`3cc0c50e39b7ee35ebddf9c9a030293130da9af9`.

This is an engineering inspection, not legal advice or a complete release
clearance. No EE implementation was used as a reference.

## License boundaries and exclusions

The root [LICENSE.md](../LICENSE.md) contains AGPLv3 and explicitly identifies
two commercial trees. Its default applies outside those trees subject to
third-party licenses. The manifests declare `AGPL-3.0-or-later`; the license
body is version 3. Preserve both rather than silently changing this distinction.

| Path | Tracked files | Finding | Decision |
| --- | --- | --- | --- |
| `apps/web/app/(ee)` | 694 | Dub Commercial License | EE - DO NOT USE |
| `apps/web/app/app.dub.co/(dashboard)/[slug]/(ee)` | 304 | Root exclusion; nested license refers to first EE license | EE - DO NOT USE |
| `packages/stripe-app` | 18 | Manifest says `~~proprietary~~`; scope conflict with root default | Quarantine; do not assume AGPL permission |
| `packages/ui/src/icons/nucleo` | 261 | Nucleo notice prohibits redistribution and restricts bundled-product use | Quarantine; independently replace or obtain explicit permission |

Both EE license documents were read. The commercial license discusses limited
development/testing permissions and client-side exceptions. RouteVerity's
stricter policy excludes the entire trees; no attempt was made to exploit those
exceptions or reclassify individual implementations.

Tracked path/license-name inventory and an OSS-side restriction-notice scan
found no additional declared EE directory at this commit. This is not a guarantee
that every asset or dependency has cleared provenance.

[licensing-exclusions.json](licensing-exclusions.json) is the machine-readable
inventory. All four trees were verified absent after Git sparse checkout.
Their contents remain in upstream Git objects: do not publish this repository's
raw Git history as an OSS-only distribution without an appropriate source export.

## OSS files depending on EE

The following are OSS-side references, not descriptions of EE internals.
Missing imports were left intact to preserve the inspected application baseline.

| OSS file or group | Restricted dependency / consequence |
| --- | --- |
| `apps/web/lib/cron/with-cron.ts` | Imports EE cron `logAndRespond`; shared wrapper is not standalone |
| `apps/web/app/api/postbacks/callback/route.ts` | Imports the same EE cron helper |
| `apps/web/app/api/veriff/webhook/route.ts`, `handle-session-event.ts`, `handle-decision-event.ts` | Import the same EE cron helper; identity verification is outside v1 |
| `apps/web/app/api/callback/stripe/route.ts` | Re-exports EE Stripe subscription webhook route |
| `apps/web/app/app.dub.co/(dashboard)/[slug]/links/domains/page.tsx`, `layout.tsx` | Re-export/import EE domain settings page/header |
| Same domain subtree: `default/page.tsx`, `email/page.tsx` | Re-export EE domain settings pages |
| `apps/web/ui/partners/partner-network/network-partner-sheet.tsx` | Imports EE invitation UI |
| `apps/web/ui/partners/bounties/bounty-social-content.tsx` | Imports EE referrals embed hook |
| `apps/web/scripts/stripe/backfill-discount-code-sales.ts` | Imports two EE Stripe integration helpers |
| `apps/web/tests/stripe/update-customer-with-stripe-customer-id.test.ts` | Imports EE implementation |
| `apps/web/tests/misc/submitted-lead-comment-access.test.ts` | Imports two EE route handlers |
| `apps/web/tests/misc/submitted-lead-comment-notification-routes.test.ts` | Imports two EE cron handlers and mocks an EE helper |
| `apps/web/vercel.json` | Contains EE cron function configuration |
| `apps/web/lib/middleware/utils/get-final-url.ts` | Comment links to EE Stripe integration; not an executable import |

Tracked path metadata additionally places the existing `/api/track/click`,
`lead`, `sale`, their client routes, `open`, and `visit` endpoints under EE.
OSS conversion helpers do exist, but these public endpoint implementations
must not be reused. EE path metadata also identifies click-stat aggregation and
click-webhook stream consumers. OSS stream publishers alone are not a complete
working pipeline.

## Other restricted dependencies

- `packages/ui/src/icons/index.tsx`, `icons/plan-feature-icons.tsx`,
  and `utm-builder.tsx` depend directly on the quarantined Nucleo tree.
  Many other UI components use those re-exported symbols.
- `packages/email/src/templates/partner-program-summary.tsx` and
  `program-payout-reminder.tsx` reference hosted Nucleo images. Omitting the
  local icon directory does not clear those references for RouteVerity.
- Removing these assets from the checkout intentionally blocks UI compilation.
  Do not restore them merely to make the build pass.

## Third-party license evidence

The embed core and React packages each supply an explicit MIT license granting
coverage to published versions, including earlier releases. CLI, HubSpot app
and shared tsconfig manifests also declare MIT; preserve notices and verify
distributed package contents at release.

OSS QR code files contain ISC/MIT upstream notices. Other OSS packages without
a local override inherit the root license, subject to embedded third-party terms.
The `icons/nucleo/license.tsx` filename is an icon, not a license grant.

`pnpm licenses list --json` completed against installed dependencies.
Most metadata entries are MIT, Apache-2.0, ISC or BSD. Other observed obligations:

- MPL-2.0: includes `@dub/analytics`, `@vercel/og`, `satori`, resvg and Turbo.
- `@img/sharp-win32-x64`: `Apache-2.0 AND LGPL-3.0-or-later`.
- Geist: SIL Open Font License.
- caniuse-lite: CC-BY-4.0.
- Additional metadata includes CC0, Unlicense, BlueOak, MulanPSL2, Python-2.0,
  and dual-license expressions. This inventory includes development/transitive
  dependencies; it is not a statement that every entry ships in production.

Three entries were reported as `Unknown`:

| Entry | Direct legal evidence |
| --- | --- |
| `@dub/embed-core` 0.0.18 | Checked-in explicit MIT license |
| `atomically` 2.0.3 | Installed `license` file: MIT, Fabio Spampinato, 2022-present |
| `stubborn-fs` 1.2.5 | Installed `license` file: MIT, Fabio Spampinato, 2020-present |

These metadata unknowns were resolved for this inspection by reading the actual
license files, not by guessing. The raw inventory remains a session artifact,
not a redistribution-ready third-party notice bundle.

## Required notices and hosted AGPL implications

Preserve Dub Technologies, Inc. copyright, the full AGPL license, warranty
disclaimer, embedded attribution, and all applicable third-party notices.
Mark modifications and their dates when producing a modified distribution.
Do not present Dub trademarks or its Google certification as RouteVerity's.

Commercial hosting is permitted subject to AGPL compliance. Section 13 requires
a modified network-interactive version to prominently offer its corresponding
source to all remote users, at no charge. An upstream-only source link is not
sufficient for a modified deployment. Corresponding source includes relevant
build/install/run scripts, not operational secrets or customer data.
See [open-source compliance](open-source-compliance.md).

## Unresolved release questions

1. Obtain permission or replace Nucleo assets independently, including remote images.
2. Resolve the Stripe integration package's proprietary declaration; v1 can omit it.
3. Verify asset/font/logo provenance and prepare notices for the actual shipped bundle.
4. Resolve AGPL/license-version and combined-work questions with qualified counsel.
5. Build a safe source export and portable exclusion gate before publishing/deployment.

No commercial-license entitlement, certification or production clearance is
claimed by this audit.
