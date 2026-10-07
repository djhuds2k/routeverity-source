# Milestone 1A: bounded icon migration

Implemented and verified on 2026-10-06.

## Scope and inventory

The shared UI icon entry point, UTM builder, pricing-plan feature icons, and
two email templates no longer depend on the quarantined icon implementation
or its hosted images. Application routes, authentication, dependency manifests,
root configuration, EE trees, and the Stripe app were not modified.

The inventory was derived from named imports in permitted consumers under
`apps` and `packages`, including `@dub/ui`, `@dub/ui/icons`, and relative
imports resolving to the shared icon entry point. Existing permitted exports
were subtracted to identify **206 required replacement names**. No excluded
implementation was read, restored, copied, or adapted.

The complete, explicit inventory and semantic mapping is maintained in
[`packages/ui/src/icons/lucide-icons.tsx`](../packages/ui/src/icons/lucide-icons.tsx).
Each exported name is mapped to a specific installed Lucide component, without
dynamic lookup, `Proxy`, catch-all fallback, or `any` casts. The consumer
inventory regression test checks named-export coverage across permitted
sources while skipping excluded directories before traversal.

Legacy names, including `NucleoPhoto`, are retained solely for import
compatibility; they do not identify the underlying implementation. Platform
aliases `AndroidLogo`, `Apple`, and `AppleLogo` use neutral device glyphs, not
reproductions of third-party logos. Similar legacy variants share a semantic
Lucide glyph where appropriate. These are replacements, not pixel-identical
copies of the old artwork.

## Licensing and compatibility

The existing installed dependency is **lucide-react 0.462.0**. Its installed
`LICENSE` is ISC and identifies Feather-derived portions under MIT. Preserve
the dependency's license and copyright notices when redistributing. No new
dependency, copied SVG geometry, or remote replacement icon service was added.

The adapter preserves SVG attributes, accessibility attributes, event handlers,
Lucide sizing/stroke options, and forwarded SVG refs. It accepts the existing
optional `variant="outline" | "fill"` vocabulary without forwarding that
attribute into the DOM: outline defaults to `fill="none"`; fill defaults to
`fill="currentColor"`; explicit `fill` wins. Every replacement is checked for
assignment to the existing exported `Icon` type and compatibility with
`withFillVariant`.

`partner-program-summary.tsx` and `program-payout-reminder.tsx` now display
their existing text labels and values without decorative remote icons.
Existing wordmarks, program logos, links, values, and summary calculations
remain unchanged. The excluded source directory remains quarantined; this
milestone neither restores nor grants permission to use it.

## Validation results

Run these commands from the repository root:

| Check                                                                                                                                                                                                                              | Actual result                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @dub/ui build`                                                                                                                                                                                                      | **PASS**: ESM bundles and declaration files generated for UI, icons, and charts.                                                                                             |
| `node --test packages\ui\tests\icon-migration.test.cjs`                                                                                                                                                                            | **PASS**: 3 tests; permitted-consumer export coverage, rendering all 206 aliases with SVG/accessibility/fill props, and absence of restricted UI imports/hosted email icons. |
| `pnpm --filter @dub/ui exec tsc --noEmit --strict --skipLibCheck --jsx react-jsx --moduleResolution node --target es2020 --esModuleInterop tests\icon-type-compatibility.tsx`                                                      | **PASS**: all replacement exports assign to `Icon`; fill helper, refs, events, and Lucide props typecheck.                                                                   |
| `pnpm --filter @dub/email exec tsc --noEmit --strict --skipLibCheck --jsx react-jsx --moduleResolution node --target es2020 --esModuleInterop src\templates\partner-program-summary.tsx src\templates\program-payout-reminder.tsx` | **PASS**: both modified templates typecheck.                                                                                                                                 |
| `pnpm --filter @dub/ui check-types`                                                                                                                                                                                                | **FAIL**, exit 2: five unrelated diagnostics remain, listed below; no icon migration diagnostics.                                                                            |
| Scoped `pnpm exec eslint --quiet` on modified source/test files                                                                                                                                                                    | **BLOCKED**, exit 2: ESLint 8.48.0 cannot find a configuration file in this checkout. No configuration was added.                                                            |
| Editor diagnostics for changed TS/TSX files                                                                                                                                                                                        | **PASS**: no errors reported.                                                                                                                                                |

The editor test runner did not discover Node's built-in tests; the explicit
`node --test` command above ran them successfully.

Remaining full UI typecheck diagnostics, intentionally outside this milestone:

- `packages/tailwind-config/tailwind.config.ts:4`: TS7016, missing declaration
  for the existing `tailwind-scrollbar-hide` dependency.
- `packages/ui/src/rich-text-area/table-hover-controls.tsx:443,489,500,528`:
  TS2488, DOM collection iteration without the configured iterable library.

Build output also reports existing workspace `pnpm.overrides`, outdated
Browserslist data, and Tailwind configuration module-type warnings. None
requires restoring excluded code or expanding this milestone's scope.
