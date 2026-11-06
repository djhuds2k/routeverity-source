# Preparing the P3 corresponding-source release

## Candidate18 notice consistency — 6 November 2026

Candidate18 synchronizes the generated public notices with the dated root
modification record. Licence texts/package/native versions, application,
dependencies, schema, Git suppression and no-cache workflow remain unchanged.
It preserves the actual Candidate17 local Linux build,726unit/contract tests,
compiled privacy probes and41browser/HTTP passes for identical runtime inputs;
it does not represent a new full Candidate18 build or another browser run.
Regenerated-versus-frozen and served notice bytes are checked separately against
the repaired source package. Exact hashes/results remain outside its ZIP.

The first isolated browser attempt failed due to a test-harness line-ending
fault; a clean corrected run passed all41tests without skips/flakes. No hosted
Vercel acceptance or legal/provenance clearance follows from those local tests.
Earlier candidates and the existing published Candidate17 source are preserved.
Candidate18 requires its own matching-source publication before deployment.

## Candidate17 public CI bootstrap — 5 November 2026

Candidate17 preserves Candidate16's Git deployment suppression and explicitly
disables dependency caching in the pinned pnpm/setup-node actions. The source
repository cache-policy API is plan-gated; the first Product checks run will
not rely on unverified paid cache settings. Workflow commands,30minute timeout,
standard ubuntu-24.04 runner, contentsread and pinned action revisions stay
unchanged. No artifacts are uploaded by the workflow. Routine GitHub run logs
remain subject to the existing provider policy; no new paid storage is selected.

Application code, dependencies/lock, schema and public third-party notice bytes
match Candidate16/Candidate15. Exact publication identities and local checks are
external to the ZIP; no hosted pass, source publication or licence-provenance
clearance is represented by this preparation. Earlier candidates are preserved.

## Candidate16 Git deployment safeguard — 5 November 2026

This configuration/documentation-only candidate adds git.deploymentEnabled=false
to apps/web/vercel.json, preserving its filtered frozen install and workspace
build commands. The documented setting suppresses automatic Git deployments;
explicit CLI/API/deploy-hook behavior and first-push provider handling require
their own verification. It is not a staging-data or secret-isolation control.

Application, lockfile/manifests, schema, Product checks workflow and third-party
notice bytes remain identical to Candidate15. Its726local tests/actual-ZIP build
are inherited evidence for those unchanged runtime inputs, not a fresh full
Candidate16 build or hosted Product checks pass. Exact archive/source/manifest
identities, targeted checks and comparison evidence are recorded alongside the
new candidate outside its ZIP. Candidate15 remains immutable.

Owner election to proceed with unresolved review risks does not supply missing
third-party notice/provenance facts. Four existing native/marker entries remain
explicit; no professional/legal/compliance finding is claimed. Historical public
source link remains historical until matching approved publication is verified.
No provider setting, deployment, public source or indexing change is performed
by preparing this local source candidate.


## Candidate15 dependency and guide batch - E199, 1 November 2026

Candidate15 prepares a scoped dependency cleanup and factual guide correction.
Unused @tiptap/html, @vercel/functions and direct fast-xml-parser product
inputs are removed. Product tests explicitly use Node; the unused optional
Vitest happy-dom peer is excluded. The existing concurrently development
command is retained with shell-quote1.11.0 and actual quoting/command
regressions. No unrelated retained package version is upgraded.

Immutable source/archive hashes and executed preparation/restoration results
belong in the external E199 release record. This paragraph describes source
scope, not a build-pass claim or deployment permission. Candidate14 and its
E193721-test record remain historical and unchanged. Current runtime/vendor/
native inventory and notices must be regenerated and matched for this source.
Four native/marker issues, qualified policy/security review, account access,
matching source publication and actual hosted acceptance remain open.
Historical public source URL, branding, tracking/conversion behavior and
disabled indexing are preserved; no live service change is represented.

## Candidate14 native component-evidence correction — E193,31October2026

Local Candidate14 actual-ZIP execution is **VERIFIED_COMPLETE** in the
external E193 release record: configured fresh Linux install/build,
types/lint/boundary,721tests and native/HTTP/notices checks pass. This
supersedes the preparation status for this candidate, not the remaining
native/marker, policy/security, publication and hosted acceptance gates.
Candidate14 includes the uhdr/libultrahdr declaration fix, exact original upstream
component text/evidence index, checksum/scope/path safeguards, regression tests,
test/export wiring and refreshed inventory/notices. Source revision/hash maps
belong alongside the ZIP. Prior candidate13 is immutable. Application code,
dependencies/lock, Next patch, historical public source URL and indexing unchanged.

Notice preparation may reuse candidate13's exact unchanged compiled runtime in
a read-only volume with the new auditing inputs mounted read-only; this is notice
generation, not a claimed new build. Candidate14 must independently execute its
actual configured install/build from its freshly extracted ZIP, run relevant
checks and reproduce notices before acceptance. No borrowed clients, node_modules
or build output in that independent restoration. Four original bundle/marker
obligations remain open, with no invented licence permissions or publication.

## Candidate13 install/build alignment — E190,31October2026

Status: **IN_PROGRESS** until separate actual-ZIP pipeline evidence is recorded.
Candidate13 changes the versioned Vercel install command to the verified filtered
root/web frozen closure with lifecycle scripts disabled, updates its existing
policy test and records this dated configuration modification. Build command,
application code, dependencies/lock, Next patch and native/public notices remain
unchanged from independently accepted local candidate12. Earlier artifacts remain
immutable. This does not change a live Vercel setting or accept dashboard overrides.

Exact source/manifest/archive identity and actual install/build execution from
apps/web belong in private E190 evidence alongside candidate13. A cached
generated client or pre-run prisma:generate must not conceal a configured build
failure; the actual unchanged build command must generate it itself. Matching
runtime inventory/notices and relevant local checks are separate from hosted
acceptance. Four licence/provenance/conveyance and provider/approval gates remain;
no publication or deployment and no historical footer/indexing activation.

## Candidate12 runtime privacy repair — E189,31October2026

Status: **IN_PROGRESS** until separate actual-ZIP execution evidence is recorded.
Candidate12 includes the bounded exception telemetry helper/Next hook, mutation
error-path correction and actual repository regressions, plus the updated dated
modification notice and refreshed Linux inventory/notices. Dependency manifests,
lock and Next security patch are unchanged. Earlier candidates remain immutable;
candidate11 documentation alone does not include this runtime correction.

Use the external candidate12 archive/hash map and source fingerprint as its exact
revision. Full preparation and independent clean-ZIP restoration results belong
alongside that ZIP, not inside a circular checksum. Do not infer a clean build
from this paragraph or an archive inspection. Four native/marker provenance/
conveyance gaps, residual security and legal/hosting/publication gates remain.
The historical public source URL is unchanged; no source or deployment is
published by local preparation.

## Candidate11 P4-A documentation preparation — E188,31October2026

Status: **IMPLEMENTED_UNVERIFIED** pending the separate immutable packaging
record. New documentation-only candidate11 adds the infrastructure assessment
and unexecuted deployment/rollback runbook. Application, lock, package manifests,
Next patch and generated notices remain byte-identical to restored candidate10;
candidate10 and earlier archives remain immutable. This is not a new accepted
hosted or security-fixed runtime. The error-hook privacy defect found during P4-A
still requires the prepared local correction, regression tests and a new runtime
candidate before real hosted tracking.

Candidate11 ZIP/file/manifest hashes, documentation-only delta and fresh extraction
checks belong outside its ZIP in private E188 evidence. No fresh build is claimed
from ZIP inspection; E187 remains the actual candidate10 Linux acceptance evidence
for unchanged runtime bytes. No application source URL or indexing flag changed,
and no publication/deployment action occurred. P3 legal/security/publication
gates remain BLOCKED. See [infrastructure](production-infrastructure.md) and
[unexecuted runbook](deployment-runbook.md).

## Candidate10 documentation review — 2026-10-31 (E187)

Status: **IMPLEMENTED_UNVERIFIED** until separate exact-ZIP restoration evidence
is recorded. Candidate10 is the next immutable local candidate after candidate9.
It repairs README/architecture links to deliberately omitted private documents,
adds the native obligation assessment, and records critical/high and certification
preparation. Application, manifests, lockfile, Next patch and generated notices
are unchanged from candidate9; no tracker/attribution/conversion behavior changed.

Candidate9 archive SHA256 remains
`e6a0786b1dda2db6becc34c7b24104a71735d97ca6539311aa360f3448ce4785`.
Its selected-source revision is
`d2fad3fa335e96d3ef865864777de4b335607489e5cbf3352d28e99105e04e29`.
E187 rechecks all857 entries and the external checksum ledger, then reconciles
its recorded isolated Linux restoration. The41 E186 browser/SQL tests ran on
Windows against matching working source; restored Linux/hosted browser acceptance
is not established. Historical candidate7/8 results are not substituted.

Candidate10's archive/hash map, exact documentation-only delta, toolchain,
actual fresh Linux restoration/build/test/native/notice results and limitations
belong alongside its ZIP in private E187 evidence. Do not infer a build pass
from this document or ZIP inspection. See [restoration](source-restoration.md).

P3 remains **IN_PROGRESS**, with publication **BLOCKED** by security acceptance,
[native/marker review](native-licensing-review.md), policies and approval. Public
footer still selects historical `v0.1.0-preproduction.20261007`; no new URL may
be selected until a matching release is approved, published and verified.

## Current local candidate preparation — 2026-10-31 (E186)

New candidate: `routeverity-source-20261031-candidate9.zip`, containing scoped
workspace dependency cleanup, follow-redirects1.16.2 and the preserved Next vendor
repair. Candidate8 remains immutable and represents its earlier dependency graph.
Current-source/lock/ZIP hashes and Linux restoration results are recorded outside
the archive in private E186 evidence. Workspace glob/minimatch migrations and
wider security/native/legal/hosted gates remain open; nothing is published.

The owner approved dependency-audit metadata transmission on2026-10-31. Same-
scope necessary reruns do not require repeated permission. This does not approve
source publication, hosted processing, deployment or external service changes.

## Historical candidate8 preparation — 2026-10-30 (E184)

New candidate: `routeverity-source-20261030-candidate8.zip`, containing the
version-bound Next vendor repair, fixed dependency graph, installed-byte guard,
bounded security tests and refreshed Linux inventory/notices. Candidate7 remains
immutable and describes the pre-repair revision. Exact archive/source hashes and
actual restoration evidence belong alongside candidate8, outside the ZIP.

Installation must use pinned pnpm9.15.9 so package extensions and patch application
are honoured, even with scripts disabled. The patch, generator, checker, policy
and tests are explicit export inputs; [repair details](security-vendor-patch.md)
describe reproduction and the targeted Babel backport. Fresh full-graph registry
audit transmission remains pending approval; no clean-security claim follows.
Four attribution/native gaps and wider release reviews remain open. No source
publication, footer URL change or deployment is authorized by this preparation.

## Historical candidate7 preparation — 2026-10-30 (E182)

New candidate: `routeverity-source-20261030-candidate7.zip`. This supersedes
candidate6 for current local preparation only; it is not a published release
or legal clearance. Candidate6 and its historical evidence remain immutable.
Current candidate includes the security updates, dedicated CI, public evaluation
pages/search controls and refreshed Ubuntu Linux notices.

Preparation uses Node22.23.2/pnpm9.15.9 and filtered frozen product installation.
Exact archive/file/manifest/lock hashes and actual independent restoration
results are recorded alongside the ZIP in private release evidence. The embedded
Linux inventory identifies its preparation build; a restored build has a separate
build ID/inventory and must reproduce notice bytes and coverage. Source-only
preparation does not claim byte-identical compiled binaries.

The notice fetcher reads the exact Next release's `packages/next/package.json`,
rejects mismatched release evidence and retains version-pinned upstream texts.
Four attribution gaps remain explicit: client-only/server-only0.0.1 and GNU/musl
libvips bundles1.3.4. Native source/relinking/conveyance, supplemental provenance,
assets and final legal/privacy review remain release gates. The public footer
still links to the historical20261007 archive; no publication or link activation
occurs through preparing candidate7.

## Historical candidate6 preparation

Nothing here publishes source or authorizes deployment. Suggested local name:
`routeverity-source-p4-20261019-candidate6.zip`. The upstream base is
`3cc0c50e39b7ee35ebddf9c9a030293130da9af9`; independent uncommitted modifications
mean **HEAD alone is not the application revision**.

Candidate6 adds the independently generated Linux platform inventory/notices
and native-notice retrieval safeguards to candidate4's merchant reference/API
preparation. The four explicitly unresolved attribution/provenance gaps remain
in the audit; this archive is not legal clearance or native-conveyance approval.
Candidate4 and candidate3 remain immutable; their historical results do not
certify candidate6. Candidate5 is retained as a failed preparation attempt: its
production build completed, but its notice-byte check caught the predecessor's
embedded modification notice. Candidate6 regenerates that text from the updated
source rather than changing the failed archive. Acceptance of the
new ZIP requires its own external hash record and independent restoration
results. No publication or deployment is authorized by preparing either archive.

## Content, checksums and regeneration

The exporter includes explicit runtime/build source, permitted workspaces,
schemas/tests, pinned dependencies, licensing inventories/notices and required
install/build/local-service scripts, with the full root licence and
[modification notice](../NOTICE.md). It omits restricted trees, original Git
history, archived upstream app, node_modules, dist, .next, private operational
records, real environment files, keys and dumps. The manifest lists selected
source files; the generated manifest itself is one additional filesystem file.
Next.js automatically discovers the retained request-error instrumentation;
its entry point and both permitted Axiom helpers are included, even though they
are outside the application route directories. Axiom transmission remains
conditional on its existing private configuration; no provider is configured.
The standalone merchant reference and its dependency-free native tests are
explicit export inputs, alongside application parity and local API acceptance
tests. The export regression runs the reference tests from the Git-free copy
without borrowing application dependencies.

Record SHA256 for every selected file; hash the JSON encoding of the
lexicographically sorted path-to-SHA256 map. Also record the lockfile, manifest
and actual ZIP SHA256. Keep `SHA256SUMS` and release/restoration evidence alongside,
not inside, the ZIP to avoid circular self-checksums. Include Node/pnpm/OS,
commands, configuration boundaries and actual results.

```powershell
pnpm routeverity:licenses
node .\scripts\export-routeverity-source.mjs C:\src\candidate
# Review exact contents, inventory, notices, exclusions and available-secret scan.
# ZIP every selected file/dotfile plus the manifest; extract and verify that ZIP.
Get-FileHash -LiteralPath C:\releases\routeverity-source-p4-20261019-candidate6.zip -Algorithm SHA256
```

Never overwrite a candidate. Re-export after any selected-source change. Repeat
affected checks and restoration/build after code/schema/lock/script/config changes.
Documentation-only updates still require new archive hashes/content verification.
An old successful archive does not prove a newer revision. Re-audit on the
actual deployment platform; Windows tracing does not certify a Linux artifact.

## Prepared source offer and publication gate

> RouteVerity is modified AGPL-covered software. Download complete matching
> corresponding source, licence/copyright and modification notices, pinned
> dependency information and installation/build scripts free of charge at
> **[approved immutable source URL for this exact deployed revision]**.

This is a preparation template, **not an active link to a nonexistent release**.
`apps/web/lib/routeverity/source.ts` remains pinned to the published historical
`v0.1.0-preproduction.20261007` tag. That tag is not claimed to match P3.
No production source-link configuration is changed.

After explicit owner/legal approval, publish only the sanitized ZIP or a fresh-
history sanitized repository, never the original working Git history. Agree
an immutable release/tag in the existing sanitized repository or another approved
public HTTPS archive host with anonymous free download.

Download anonymously; verify the approved ZIP SHA256 and every extracted source/
manifest hash and omission. A Git-host-generated ZIP may differ in wrapper bytes:
compare its complete file map and record both ZIP hashes rather than claiming
byte equality. Only once the release exists and is verified, update
`sourceRelease`/`sourceArchive` to the real immutable revision, verify the footer
download and `/third-party-notices.txt`, and deploy the matching approved source.
Coordinate that final configuration change and artifact fingerprint explicitly.

[Licensing questions](licensing-audit.md), source publication, privacy/business,
production access and deployment remain separate approval gates.
