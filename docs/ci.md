# RouteVerity product CI

`.github/workflows/routeverity.yaml` defines the `Product checks` job on pull
requests, pushes to main and manual dispatch. It uses Ubuntu 24.04, the Node
version in `.node-version`, pnpm 9.15.9 and immutable official action commits.
Checkout applies the existing licensing exclusions before source is materialized.
The token has read-only contents access and checkout does not persist credentials.

The job restores the root and web workspace dependency graph with a frozen
lockfile and installation scripts disabled. Explicit Prisma generation happens
in the production build. The existing local helper generates ignored random
test credentials and starts the pinned MySQL/proxy/Redis/Redis REST/MailHog
containers on loopback. The schema push is for the fresh disposable runner
database only; it is not a production migration or a local database reset recipe.

Checks cover the licensing boundary, product lint, production build, TypeScript,
unit/contracts and the complete browser/HTTP/SQL suite. The fixed `.test`
operator identity is process configuration for the test runner and owned server.
No production service credentials, paid accounts, QStash, Tinybird, public SMTP,
provider API or deployment is needed.

For browser acceptance, `ROUTEVERITY_E2E_START_SERVER=1` makes Playwright start
the already-built production server. It refuses to reuse an existing listener,
waits for the loopback login route and shuts down its owned process afterward.
Managed mode requires the dedicated operator profile; CI forbids focused tests
and uses zero retries. The ordinary local test command retains its existing
externally started server behavior unless this mode is explicitly selected.

Managed mode writes `apps/web/test-results/routeverity-results.json`. The next
step runs `pnpm routeverity:e2e:check`: an empty, skipped, failed, flaky, retried,
expected-failure, interrupted or incomplete report cannot pass. The test count
can grow naturally; every discovered test must pass once. Missing/malformed
reports and runner errors also fail. Reports and environment files are not
uploaded as workflow artifacts. Cleanup always attempts to stop only the owned
local services; the disposable hosted runner removes its volumes afterward.

To rehearse browser management against the existing dedicated local services
and a current production build in PowerShell (do not have another server on8888):

```powershell
$env:CI = "true"
$env:ROUTEVERITY_OPERATOR_EMAIL = "operator-e2e@routeverity.test"
$env:ROUTEVERITY_E2E_START_SERVER = "1"
pnpm routeverity:e2e
if ($LASTEXITCODE -eq 0) { pnpm routeverity:e2e:check }
Remove-Item Env:ROUTEVERITY_E2E_START_SERVER
Remove-Item Env:ROUTEVERITY_OPERATOR_EMAIL
Remove-Item Env:CI
```

Preserve any pre-existing process values when using a shared shell. This example
does not start containers, apply schemas, change stored operator configuration
or authorize real emails. Existing fixture guards require the dedicated
loopback SQL/SMTP endpoints.

The old API, Playwright and formatting workflows are labelled legacy and run
only by manual dispatch. Their upstream commands are historical and are not
product acceptance or launch gates. The product job never deploys or publishes.

A local rehearsal and workflow lint do not prove a GitHub-hosted run. Publish
only approved sanitized source to the intended RouteVerity repository; the
upstream Dub remote is not that destination. After the first hosted pass, require
the `Product checks` job from `RouteVerity CI` in repository branch protection.
Repository settings and hosted execution are separate from authoring this file.
Security inventory, vendored versions, Linux/native notices, source matching,
hosted operations and merchant acceptance remain their own launch gates.

Implementation references: [GitHub workflow triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow),
[Playwright server lifecycle](https://playwright.dev/docs/test-webserver) and
[JSON reporting](https://playwright.dev/docs/test-reporters#json-reporter).
