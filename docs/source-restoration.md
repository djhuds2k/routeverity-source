# Independent source restoration

Use the actual current ZIP, not an old candidate or a working-tree copy.
Exact hashes and executed results belong alongside the ZIP in release/
restoration evidence, avoiding a circular archive checksum. This procedure
does not substitute historical tests for actual current acceptance.

## Clean extraction and pinned installation

1. Extract into a new short path, e.g. `C:\src\rv-p3`; refuse an existing path.
   Verify ZIP/manifest hashes, expected counts and every selected-source SHA256.
2. Confirm no `.git`, node_modules, dist, .next, real `.env*`, key/dump, private
   record or restricted tree. Do not initialize Git to recover excluded history.
3. Use Node **22.23.2** and **pnpm 9.15.9** with `NODE_PATH` unset. Do not inherit
   a working-tree-specific PATH/INIT_CWD or copy dependencies/generated clients/env.
4. Run `pnpm --filter dub-monorepo --filter web... install --frozen-lockfile --ignore-scripts --store-dir C:\src\rv-p3-store` with a
   dedicated store. Verify resolved workspace/dependency/client realpaths belong
   to the restored tree. Network failures do not permit borrowing the old tree.
   An integrity-checked package cache may supply a new installation; do not copy
   node_modules, generated clients or build output. Prisma is explicitly generated
   by the product build using `pnpm --filter web prisma:generate`, which selects
   the multi-file schema. Bare `prisma generate` selects no schema in this project.

## Disposable, non-production build configuration

No live database is required for the build. These are process-only placeholders,
not service passwords or production credentials:

```powershell
Remove-Item Env:NODE_PATH -ErrorAction SilentlyContinue
$env:DATABASE_URL = "mysql://build:disposable@127.0.0.1:19999/routeverity"
$env:PLANETSCALE_DATABASE_URL = "http://build:disposable@127.0.0.1:19998/routeverity"
$env:UPSTASH_REDIS_REST_URL = "http://127.0.0.1:19997"
$env:UPSTASH_REDIS_REST_TOKEN = "disposable-local-build-only"
$env:NEXTAUTH_URL = "http://localhost:8888"
$env:NEXTAUTH_SECRET = "disposable-source-build-only-not-for-production"
$env:EMAIL_SERVER = "smtp://127.0.0.1:11025"
$env:EMAIL_FROM = "RouteVerity Local <noreply@routeverity.test>"
$env:ROUTEVERITY_LICENSE_AUDIT = "1"
pnpm routeverity:build
```

Functional tests use only explicitly approved isolated loopback services.
On a fresh machine follow [local development](local-development.md): `setup`
supports a Git-free archive, generates private random local credentials and
preserves existing data/credentials. Never start a fresh stack over another
initialized volume.

An existing approved local test stack can be reused **explicitly** after
checking exact project labels, loopback bindings, dedicated storage and health.
Supply only its available service authentication in process memory plus a
fresh local auth secret. Do not copy the old `.env.local`, borrow production
credentials, reset data or resolve modules against the original checkout.
E2E safety checks require `routeverity` on `127.0.0.1:13306`, SMTP 11025 and
MailHog 18025; tests clean only their own fixtures.

## Acceptance

After the independent build generates Prisma and shared artifacts:

```powershell
pnpm routeverity:typecheck
pnpm routeverity:lint
pnpm routeverity:test
pnpm routeverity:licenses
node .\scripts\audit-routeverity-licenses.mjs --output C:\evidence\restored-inventory.json --notices C:\evidence\restored-notices.txt
```

Use external audit output paths so extracted source bytes remain unchanged.
Verify inventories, notices and outside-tree rejection. BUILD_ID naturally
changes: this proves independent source buildability, not bit-identical binaries.

With approved services, start the restored production app, check login HTTP 200/
public notices and run `pnpm routeverity:e2e`. For full rather than skipped
operator coverage set `ROUTEVERITY_OPERATOR_EMAIL=operator-e2e@routeverity.test`
on **both** server and runner. Record passed/failed/skipped counts and actual
worker CLI/heartbeat checks where applicable. Stop only exact verified owned
PIDs and restore the ordinary profile without that fake identity.

On failures record command/exit, exact executable/operation and relevant logs/
security events. Separate source/licence, network/service, security-product
and unknown causes. Never disable protection, add broad exclusions, suppress
detections or change executors to evade denial. Inspect publisher/signature/
source and obtain narrow human review before repeating a blocked operation.
Successful commands alone do not certify antivirus protection state.
