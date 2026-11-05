# Next vendor security repair

The application remains on Next15.5.28 with a version-bound pnpm patch. This
addresses the eight vendor advisory groups reviewed in E183 without assuming
that an ordinary override rewrites framework bundles. Next16.4.3's cookie bundle
still equals the old bytes; its other reviewed bundles differ and were not
accepted as a complete repair merely from their version label.

`pnpm.packageExtensions` adds exact dependencies to Next's resolution context:
cookie0.7.2, picomatch4.0.4, send0.19.0, ws8.21.0 and @babel/core7.29.6.
The patch replaces four compiled entry points with simple forwards to those
packages. Original framework licence files are retained, and the real packages'
licences are collected separately from traced/emitted files.

Babel's compiled core remains7.26.10. Exactly one external-map read expression
delegates to the publisher's `read-input-source-map-file.js` from7.29.6. Its
verified SHA256 is recorded in the policy. This is a targeted publisher-fix
backport, not a full Babel core upgrade or suppression of its declared version.
Outside-package automatic maps are rejected while package-contained, inline
and explicitly supplied maps remain supported. No custom security algorithm
replaces the publisher's reader.

## Installation and verification

The exact patch path and hash are in package.json/pnpm-lock.yaml. pnpm applies
it during dependency materialization, including installation with lifecycle
scripts disabled. There is no postinstall edit. Use pinned Node22.23.2 and
pnpm9.15.9; a package manager that ignores these pnpm fields is not a verified
installation path. The product build first checks installed version, five file
hashes, extension package versions and publisher reader bytes, failing on drift.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm routeverity:vendor-check
pnpm routeverity:build
pnpm routeverity:test
```

`docs/security-vendor-patch.json` records pristine and repaired fingerprints,
dependency targets and the exact Babel expression replacement. To reproduce
the patch from a pristine integrity-verified Next15.5.28 npm package:

```sh
node scripts/prepare-routeverity-next-patch.mjs /path/to/pristine/next --check
# Omit --check to regenerate the patch deliberately, then regenerate the lockfile.
```

The generator refuses another release, any changed original bundle, multiple
replacement sites or unexpected repaired bytes. The source exporter explicitly
includes the patch, generator, checker, policy and security tests. Normal
installation/build does not download source files or licence texts separately.

## Scope and release acceptance

The eight reviewed groups are cookie GHSA-pxg6-pf52-xh8x, picomatch
GHSA-3v7f-55p6-f55p/GHSA-c2c7-rcm5-vvqj, send GHSA-m6fv-jmcg-4jfg, ws
GHSA-3h5v-q93c-6h6q/GHSA-58qx-3vcg-4xpx/GHSA-96hv-2xvq-fx4p, and Babel
GHSA-4x5r-pxfx-6jf8. Ten bounded regressions verify the actual framework imports
and behavior. The untouched old Linux candidate fails nine of these ten; the
positive legitimate-map case already passed there.

Inventory retains the compiled framework identities and declares the verified
repair separately. Forwarders contain no old library implementation; the
separately traced fixed packages supply it. Babel's legacy version can still
match version-only rules: use the backport fingerprints and behavior evidence,
not a fabricated version or blanket advisory exclusion. Other vendor/native/
workspace issues and future advisories are not cleared by this repair.

The owner approved full-graph registry-audit metadata transmission on2026-10-31;
E185/E186 record the scans and scope. Necessary same-scope reruns remain authorized.
Successful scanning is not a clean result or wider security clearance. Existing
official advisory evidence supports these specific repairs; wider security,
native attribution/provenance/legal, hosted CI/recovery/merchant and launch
acceptance remain separate gates. Earlier source candidates remain immutable;
publish only a newly reviewed matching candidate after explicit approval.

References: [pnpm patch](https://pnpm.io/cli/patch),
[Babel advisory and publisher repair](https://github.com/babel/babel/security/advisories/GHSA-4x5r-pxfx-6jf8),
[cookie](https://github.com/jshttp/cookie/security/advisories/GHSA-pxg6-pf52-xh8x),
[picomatch](https://github.com/micromatch/picomatch/security/advisories/GHSA-c2c7-rcm5-vvqj),
[send](https://github.com/pillarjs/send/security/advisories/GHSA-m6fv-jmcg-4jfg),
[ws](https://github.com/websockets/ws/security/advisories/GHSA-96hv-2xvq-fx4p).
