# Transparent redirect performance

Measured locally against the Milestone 3 **production Next.js build** on
2026-10-07, Node 22.23.2. The dedicated MySQL and Redis REST services were used.
Every success awaited a durable MySQL audit insert. No landing page, analytics,
geo service or queue was contacted.

The Playwright acceptance load scenario uses five warm-up requests, then 100
measured requests in batches of four concurrent requests. It verifies zero
status/Location errors and exactly 105 fixture audit rows before cleanup.
Latency is client-observed HTTP time on loopback, not a projected production SLA.

| Measurement           | Final observed result |
| --------------------- | --------------------- |
| Samples / concurrency | 100 / 4               |
| Requests per second   | 71.60                 |
| Median latency        | 35.02 ms              |
| p95 latency           | 51.26 ms              |
| p99 latency           | 376.64 ms             |
| Redirect error rate   | 0%                    |

Reproduce with the app and isolated services running:

```powershell
pnpm --filter web exec playwright test --config playwright.routeverity.config.ts transparent-redirect.spec.ts --grep "measures production"
```

The test emits measured JSON (`samples`, `concurrency`, `warmup`,
`requests_per_second`, `median_ms`, `p95_ms`, `p99_ms`, `error_rate`), never test
credentials or full destination URLs. Its p95-under-1,000-ms assertion is a
local regression budget, not a hosting SLO.

This small sample does not certify sustained throughput, tail behavior,
multi-region deployment, production database latency or malicious-load capacity.
The p99 outlier is reported, not hidden; no cause has been established.
Repeat larger controlled load and failure tests in an approved deployment
environment before choosing production limits or marketing performance claims.

## Milestone 4 remeasurement

The same production scenario was rerun after adding bounded analytics capture
to the existing audit insert. Parsing/enrichment stayed outside the request path.
On 2026-10-07, 100 samples / concurrency 4 / five warm-ups measured:

| Measurement         | Milestone 4 observed result |
| ------------------- | --------------------------- |
| Requests per second | 49.47                       |
| Median              | 60.11 ms                    |
| p95                 | 72.59 ms                    |
| p99                 | 380.60 ms                   |
| Redirect error rate | 0%                          |

These are different local runs with no controlled machine-load comparison.
The change is not evidence of a specific performance cause or production capacity.
Every measured success still matched the authoritative Location and acknowledged
durable evidence; the existing local p95 regression budget passed.

## Milestone 6 remeasurement

The final transparent-v2 production build passed the same standard-click
workload on 2026-10-07. Optional Google metadata was absent from these load
requests; the separate Google acceptance scenarios verified hash-only fields
and identical Location across source/device/network/crawler variants.

| Measurement                      | Milestone 6 observed result |
| -------------------------------- | --------------------------- |
| Samples / concurrency / warm-ups | 100 / 4 / 5                 |
| Requests per second              | 46.71                       |
| Median                           | 69.72 ms                    |
| p95                              | 87.68 ms                    |
| p99                              | 396.95 ms                   |
| Redirect error rate              | 0%                          |

No controlled machine-load comparison or production capacity claim is made.
The local p95 regression budget and durable target-integrity checks passed.

## Post-reinstall acceptance remeasurement

On 2026-10-17, the existing local production build passed all 29 browser/HTTP
scenarios against the user-approved fresh isolated development database and
Redis services. The unchanged durable redirect workload measured:

| Measurement                      | Recovery observed result |
| -------------------------------- | ------------------------ |
| Samples / concurrency / warm-ups | 100 / 4 / 5              |
| Requests per second              | 41.83                    |
| Median                           | 63.71 ms                 |
| p95                              | 100.96 ms                |
| p99                              | 371.38 ms                |
| Redirect error rate              | 0%                       |

The scenario asserts exact HTTP Location, durable fixture records and p95 below
1,000 ms. These loopback measurements are not a controlled comparison with
earlier runs, sustained production capacity or a hosting SLA. No deployment or
Google certification is implied.
