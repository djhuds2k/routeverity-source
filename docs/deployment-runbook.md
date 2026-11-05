# Deployment and rollback runbook

E188 / P4-A,31October2026. **IMPLEMENTED_UNVERIFIED**: procedure prepared, not
executed. This file grants no deployment, publication, DNS, database, spend,
worker/retention activation, email or external-submission authority. Existing
live infrastructure remains read-only. It supports the existing completion
programme and [infrastructure findings](production-infrastructure.md).

## Release record and prerequisite gates

Use one private release record containing archive/manifest/lock/patch hashes,
source fingerprint, published-source URL, hosted deployment ID and source/input
hashes, effective configuration revision, native notice/source package, schema
before/after digest, runtime/worker versions, dependency regions, backup/restore
receipts, test results, owner/operator identities, change approvals and rollback
target. No secrets, complete tracking URLs, raw customer logs or personal data.

Select Candidate15 using the immutable external E199 source/archive record and
its actual acceptance results; do not infer a pass from this procedure.
Candidate14 remains the independently restored predecessor, not an accepted
production release. E193 records its exact source/manifest/archive
identity and721tests. It includes the E189 bounded exception/mutation logging
repair and E190 filtered install alignment. Remaining gates include actual
provider-log privacy, native/marker and policy/security review, account access,
source publication, hosted acceptance and a compatible rollback target.

## Procedure — do not execute without the stated approval

1. **Select source.** Choose the explicitly approved sanitized source revision,
   not HEAD, current upstream remote, latest branch by name or the old production
   commit. Include the locally verified logging correction before real tracking.
   Freeze a new immutable candidate after any code/configuration change.
2. **Verify source archive.** Check ZIP/manifest/lock/Next patch and all selected
   files, complete omissions and secret screen. Fresh extraction and frozen
   pnpm9.15.9 install with Node22.23.2; guard patch, build/types/lint/tests/native/
   notices. Record actual hosted Node patch/platform differences and acceptance.
   No original node_modules/env/build borrowing. Do not run destructive setup.
3. **Clear licensing/notices.** Resolve or obtain qualified acceptance of the
   exact four issues and full native deployment package. Obtain source-publication
   approval, publish matching corresponding source, verify URL/download/hash and
   retain evidence. The historical footer is not current-source acceptance;
   only activate the approved matching link after publication is verified.
4. **Review schema and rollback.** Using read-only metadata or an approved isolated
   clone, compare exact current schema with selected source. No migration history
   is committed; do not replace it with automatic db push. Prepare reviewed
   additive SQL, privilege separation, lock/runtime impact, backfill plan and
   forward/backward compatibility matrix. Rehearse on isolated data. Obtain
   explicit SQL/production-change approval before applying anything.
5. **Confirm production settings.** Inspect only existing routeverity project in
   the recorded team, effective root/apps/web workspace access, filtered frozen
   install with scripts disabled, explicit Prisma generation, build command,
   Node/pnpm versions, native traces, region near SQL, memory/duration/connection
   budget, WAF and protection. Resolve app alias/TLS/403 causes from account
   evidence. Approval must enumerate any project/domain/security changes;
   never touch holding/shopify or change apex/www implicitly.
6. **Validate secrets/dependencies.** Check only required names, target scopes,
   ownership and expiry through authorised access. Deliver values privately to
   runtime. Do not download env to source/CI artifacts or print URLs/tokens.
   Verify SQL TLS/CA/user grants/allowlist/pool budget, Redis REST TLS/auth and
   SMTP TLS/sender using approved tests. Build uses disposable configuration;
   hosted runtime never uses fixtures. Keep indexing disabled.
7. **Create production-equivalent staging only after scoped deployment approval.**
   Use the same app/native build, accepted Node/platform, region/network pattern,
   pool/Redis/mail contracts and worker versions, but isolated approved database,
   Redis namespace and sink recipients. Protected deployment URL has no live
   domain assignment. No live customer records copied by default. Configure a
   stage-specific app origin: middleware routes by NEXTAUTH_URL, so a preview
   hostname cannot silently stand in for an unrelated production host. If the
   provider cannot isolate dependencies/configuration safely, stop before build.
8. **Run hosted tracking acceptance with approved fixture scope.** Create only
   owned fixture workspace/domain/campaign/test credentials. Verify login and
   tenant/role boundaries, malformed/duplicate/oversized inputs, rate/dependency
   failure paths, exact visible-next-hop=Location, no-cache/no-referrer headers,
   durable audit, conversions/idempotency/merchant retry without invented revenue.
   Do not follow third-party destinations. Measure host latency/error rate and
   SQL/Redis load; local p95 is not a production SLA. Redact credentials from
   evidence. Test Error/non-Error synthetic sentinels across enabled logging sinks;
   no query, advertising ID, auth header, cookie or body may leak.
9. **Accept workers and alerts with approved isolated writes/email.** Run one
   supervised instance per worker; applying retention only on approved fixtures.
   Verify enrichment, reconciliation, retention and integrity success in SQL,
   graceful shutdown/restart/reboot, singleton timer behavior, heartbeat failure
   and backlog/expiry thresholds. Exercise incident and recovery, confirm inbox
   delivery, then prove external dead-man detects monitor/VM outage. Same-host
   checks cannot prove resilience to losing that host. No user-facing health
   details exposed publicly.
10. **Accept backup and restore.** Verify encrypted off-site SQL backups, retention,
    retrieval credentials and age. Under a separately approved exercise, restore
    to an isolated service, verify schema/data consistency with scoped fixtures,
    application/worker behavior and measured recovery time/loss objective. No
    overwrite of production, no raw customer export to this workspace. Record
    source/schema/secret dependencies needed to restore service.
11. **Stage the production-configured release without live-domain assignment.**
    This is a deployment and requires approval even when unaliased. Record the
    exact new deployment ID/source/configuration. Vercel promotion can rebuild
    when crossing environments; a tested preview is not automatically the same
    artifact as a production-configured release. Verify actual result rather
    than assuming reuse. Prevent automatic production-domain assignment and
    automatic Git deployment; if the provider/tool cannot guarantee this in the
    existing project, stop for an explicit staging approach. Do not issue a
    default `--prod`, redeploy or promote command as an unaliased-build shortcut.
12. **Final release checks.** Compare production-configured deployment against
    accepted source/native/notice hashes and environment names. Verify source
    link, TLS/aliases, private auth origin/cookies, region/egress, WAF/log privacy,
    monitored dependency health, prepared singleton worker cutover, backup age,
    compatible rollback target and remaining security/legal decisions. Use a
    controlled approved routing mechanism for tests; do not add a temporary live
    alias, bypass protection or copy production secrets into the preview.
13. **Obtain explicit promotion approval.** Present deployment ID/hash, exact host
    assignments, settings/DNS/security/SQL changes, worker cutover, budget and
    maintenance window, accepted tests, current TLS renewal evidence and rollback
    conditions. Source publication, paid changes, production data/schema changes,
    DNS, promotion and email each need their scoped authority; no implicit grant
    from this runbook or prior candidate tests.
14. **Promote only the verified release.** Execute approved assignment/promotion
    without redeploying the old Git commit. Retain existing host map/rollback
    receipt. Cut over workers with no overlapping instances and the correct
    schema/release. Do not enable indexing/billing or submit Google in this step.
15. **Monitor the actual release.** Verify authenticated dependencies, expected
    request/redirect error/latency budgets, durable event counts, SQL connection
    headroom, Redis quota, worker progress/integrity/retention and accepted alerts.
    Use aggregate/redacted evidence. Stop collection or suspend the specific
    affected campaign through an approved incident procedure on integrity,
    privacy, dependency or expiry breach; don't redirect to a substitute target.
16. **Rollback safely when approved incident criteria trigger.** Switch only to a
    preverified deployment with matching source and schema compatibility. Quiesce
    incompatible writes/workers as preplanned; preserve queued durable work and
    idempotency receipts. Never reset schema or reverse additive changes blindly.
    If the old binary cannot read/write the new schema/data, use an accepted
    forward fix or separately approved restore/outage plan, not an automatic
    alias switch. A database restore can lose newer events and cannot be hidden
    as application rollback. Verify worker ownership, auth/secrets, routing,
    integrity and recovery alerts after rollback and record incident outcome.

## Database compatibility and approval record

| Change type | Before promotion | Rollback constraint |
| --- | --- | --- |
| Add nullable column/table/index | Both selected release and rollback binary tested; review locks/storage | Usually retain additive schema; compatibility must be demonstrated |
| New required field/changed enum/semantic policy | Expand/contract plan and older reader/writer behavior tested | Do not switch back if old binary rejects or misinterprets new rows |
| Backfill/deletion/retention | Explicit data-change authority, audited scope and verified backup/restore | Lost data is not recovered by switching application deployment |
| Credential/CA/connection or host change | Rotation/expiry and both environments reviewed | Old deployment needs accepted still-valid configuration; no secret copying into logs |

Current compatibility with recorded old production commit is unknown. It is not
an accepted rollback target simply because Vercel says READY.

## First hosted acceptance and Google follow-up

The bounded local logging fix is complete in Candidate14. Complete account
read-only diagnosis and actual hosted/provider privacy acceptance next.
Then, after P3 and explicit protected-staging approval, build the selected source
against isolated production-equivalent services with no live domain assignment.
Run the owned-fixture tests above before considering promotion. No step ran in
P4-A. Proposed corrections and missing connection are in the infrastructure
report; E188 correction preparation is historical and superseded by E189/E193.

Keep Google preparation separate: after a genuinely working approved public
tracker exists, verify actual Ads macro expansion/parallel tracking and a private
customer-style example. Refresh public policy/contact/domain ownership evidence
and submit only after explicit Google-submission approval. Billing is deferred.

Official behavior references reviewed31October2026:
[promotion](https://vercel.com/docs/deployments/promoting-a-deployment),
[function region](https://vercel.com/docs/functions/configuring-functions/region),
[function limits](https://vercel.com/docs/functions/limitations),
[TLS](https://vercel.com/docs/domains/working-with-ssl),
[Google preparation](google-ads.md). Actual account capabilities must be verified;
these references do not authorise action or prove this environment's settings.
