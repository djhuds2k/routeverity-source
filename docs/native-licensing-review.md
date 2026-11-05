# Native and marker-package release review

## E193 technical correction for libultrahdr2.0.2

The native inventory parser maps uhdr to the publisher's libultrahdr table row.
The publisher's declared MIT summary remains separate from the complete original
upstream text, which states both MIT and Apache2. Exact source revision
e5f5a022fe96fc4dc2ee35c19f733a50df807abe and SHA256
c9247b5cb07866938643cc238292434e6f2af8642e1fce10771c0e4cc7909316
are bound in [component evidence](native-license-evidence.json). The unmodified
text is included in generated public notices once and referenced by both GNU/musl
component records. No inferred SPDX choice or native-bundle waiver is made.

This technical correction supersedes E191's null-label finding for candidate14;
candidate13 remains immutable. Four bundle/marker warnings, complete native
copyright/source/replacement material and qualified conveyance/provenance
acceptance remain open. It does not replace the review below.

E187, 2026-10-31. Status: **IN_PROGRESS** for evidence; **BLOCKED** for material
conveyance/provenance acceptance. This report does not grant permissions or legal
clearance. Four existing missing-text warnings remain in generated notices.

## Verified package evidence

Exact npm metadata and all four tarballs were retrieved and SHA512 integrity
checked. Private E187 evidence records URLs, SHA256, complete tar member lists
and supplied textual metadata. No native binary enters the source ZIP.

| Component | Verified licence / provenance | Remaining issue |
| --- | --- | --- |
| @img/sharp-libvips-linux-x641.3.4 | npm declares LGPL-3.0-or-later, published gitHead ebb95f8add54eee8bed840e3fb587e4cbec857d7; six tar members include native .so, versions.json and aggregate README licence table | Complete component copyright/licence texts and corresponding native source/build/relinking package are not supplied by that table |
| @img/sharp-libvips-linuxmusl-x641.3.4 | Same declared licence/gitHead and six-member structure for musl | Same packaging gate; conservative trace presence is not proof musl executes on GNU |
| client-only0.0.1 | npm declares MIT; tarball contains package.json and two JS files; no repository/gitHead/licence text | Exact copyright/licence provenance remains unresolved; generic React MIT text cannot be attributed without evidence |
| server-only0.0.1 | npm declares MIT; tarball contains package.json and two JS files; no repository/gitHead/licence text | Same provenance gap; no invented copyright or waiver |

The restored GNU smoke actually loads Sharp0.35.5/libvips8.18.7. Both GNU/musl
bundles are conservatively traced;56 native records represent two28-component
tables, not56 independently loaded libraries. The publisher distributes its
bundle under LGPLv3 terms using upstream later-version permissions. The
packaging scripts' Apache2 licence does not license those native libraries.
The upstream libvips core's LGPL2.1-or-later description does not override the
actual bundle's declared terms or the other components' terms.

Sources: [GNU package metadata](https://registry.npmjs.org/@img%2fsharp-libvips-linux-x64/1.3.4),
[musl metadata](https://registry.npmjs.org/@img%2fsharp-libvips-linuxmusl-x64/1.3.4),
[client-only metadata](https://registry.npmjs.org/client-only/0.0.1),
[server-only metadata](https://registry.npmjs.org/server-only/0.0.1),
[version-pinned vendor licence summary](https://github.com/lovell/sharp-libvips/blob/ebb95f8add54eee8bed840e3fb587e4cbec857d7/THIRD-PARTY-NOTICES.md),
[version-pinned build recipe](https://github.com/lovell/sharp-libvips/blob/ebb95f8add54eee8bed840e3fb587e4cbec857d7/build/posix.sh).

## Deployment-specific acceptance

| Intended action | Evidence and required acceptance |
| --- | --- |
| Source-only ZIP | Native package bytes are absent. Preserve Dub/AGPL notices, manifests, patch and build instructions. This alone does not meet obligations for a later binary delivery or clear marker provenance in generated output |
| Execution under company control | Establish who receives/copies binaries and under whose direction/control. Network service alone differs from conveyance, but delivery to a hosting contractor must be assessed under the actual arrangement; do not assume every cloud upload is exempt |
| Vercel function/container/VM delivery | Enumerate exact native files and component licences in the actual deployment output. Assemble applicable copyright and GPL/LGPL texts, corresponding library source including modifications and build instructions, and an effective replacement/relinking mechanism. Shared-library filenames alone do not establish compliance for statically combined constituent libraries |
| Delivery to customer/independent operator | Review object-code conveyance, source access/offer, LGPL combined-work conditions and installation information where applicable; ensure contractual terms do not restrict permitted modification/debugging |
| AGPL network application | Publish approved matching corresponding source for the deployed modified application and provide the network user's source opportunity. The historical archive remains historical and cannot represent this revision |

Legal basis for review: [LGPLv3 sections0/4](https://spdx.org/licenses/LGPL-3.0-or-later.html),
[GPLv3 sections1/2/6](https://spdx.org/licenses/GPL-3.0-or-later.html), and
the retained [root licence](../LICENSE.md). This is an engineering checklist;
qualified review must decide the actual conveyance and combination obligations.

These are verified missing materials/provenance and deployment packaging
questions. No actual licence violation is established by missing npm text alone.
No knowingly noncompliant delivery has been approved. Obtain version-specific
rights-holder evidence for the marker notices and review the exact deployment
native source/replacement package before publication/deployment acceptance.
No licence substitution, dependency removal or legal decision was invented.
