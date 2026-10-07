# Upstream Dub baseline

Inspected: 2026-10-06. Scope: Milestone 0 inspection only.

## Repository and pin

- Repository: <https://github.com/dubinc/dub>
- Origin: `https://github.com/dubinc/dub.git`
- Commit: `3cc0c50e39b7ee35ebddf9c9a030293130da9af9`
- Branch: `main`
- Commit date: 2026-10-06
- Commit subject: `Merge pull request #4616 from dubinc/program-application-created-webhook`
- Acquisition: `git clone --depth 1 https://github.com/dubinc/dub.git .`
- The workspace was empty before cloning. No pre-existing application was found.
- This is a shallow upstream checkout, not a RouteVerity release. No commit or remote publication was performed.

The SHA, not moving `main`, is the baseline pin. Use it for future comparisons.
Upstream application source and dependency manifests remain unchanged.

## Toolchain

| Item | Upstream evidence | Observed environment |
| --- | --- | --- |
| Node | README recommends 23.11.0; root/web manifests do not declare engines | 24.12.0 |
| pnpm | Root `packageManager` pins 9.15.9 | 9.15.9 |
| npm | Not the workspace package manager | 11.6.2 |
| Git | No declared minimum found | 2.56.0.windows.2 |
| Docker | Local compose services supplied | CLI 29.6.2; Linux daemon unavailable |

Installed Next 15.5.8 declares Node `^18.18.0 || ^19.8.0 || >=20.0.0`.
The test toolchain is stricter: Vite 7.2.2 declares `^20.19.0 || >=22.12.0`;
Vitest 4.0.8 declares `^20.0.0 || ^22.0.0 || >=24.0.0`.
Do not infer the application's full runtime support from the README alone.
An inspected deployment-test workflow uses Node 20 without pinning its minor.
The observed Node 24 environment passed the targeted tests, not the full build.

## Monorepo

- `apps/web`: Next.js dashboard, APIs, host-based middleware, Prisma, tests.
- `packages/ui`: shared React UI; blocked by restricted icon imports.
- `packages/utils`: shared helpers and host/brand constants.
- `packages/email`: React email templates.
- `packages/tailwind-config`, `packages/tsconfig`: shared tooling.
- `packages/embeds/core`, `packages/embeds/react`: MIT-licensed embed packages.
- `packages/cli`: MIT-declared CLI.
- `packages/hubspot-app`: MIT-declared integration package.
- `packages/tinybird`: analytics SQL resources; 54 tracked `.pipe`/`.datasource` files.
- `packages/workers`: additional upstream service assets, not required for the bounded tests.
- `packages/stripe-app`: quarantined, proprietary-declared integration package.

Workspace patterns include `apps/*`, `apps/web/.react-email`, `packages/*`,
and `packages/embeds/*`. Not every directory is a pnpm project.
Installation after quarantine reported 11 workspace projects.

## License-safe checkout

See [licensing audit](licensing-audit.md) and the
[machine-readable exclusion list](licensing-exclusions.json).
Git sparse checkout physically omits all four restricted trees; this preserves
upstream tracked metadata and does not delete those files from upstream history.
The existing `.cursorignore` additionally records the development exclusions.

To reproduce exclusions in a clean checkout using PowerShell:

```powershell
$audit = Get-Content -LiteralPath '.\docs\licensing-exclusions.json' -Raw | ConvertFrom-Json
$audit.gitSparseCheckoutPatterns | git sparse-checkout set --no-cone --stdin
if ($LASTEXITCODE -ne 0) { throw 'Could not apply licensing exclusions' }
foreach ($entry in $audit.exclusions) {
  $path = $entry.path.Replace('/', '\')
  if (Test-Path -LiteralPath $path) { throw "Restricted path is present: $path" }
}
```

Sparse state is local Git configuration, not a portable CI enforcement mechanism.
Every new checkout must apply the manifest before checks/development.
Do not disable sparse checkout to obtain a green build. CI enforcement and a
publishable OSS-only source export remain future work requiring approval.
