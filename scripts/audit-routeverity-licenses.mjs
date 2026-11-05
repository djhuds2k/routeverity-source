import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { arch, platform, release } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyVendorPatch } from "./check-routeverity-vendor-patch.mjs";
import {
  nativeLicenseDeclarations,
  nativeNoticeFor,
} from "./routeverity-native-licenses.cjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const vendorSecurityRepair = verifyVendorPatch(root);
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--"))
    throw new Error(`Missing ${name} value.`);
  return resolve(args[index + 1]);
}
const source = option("--source", root);
const output = option(
  "--output",
  join(root, "docs", "licensing-inventory.json"),
);
const noticeOutput = option(
  "--notices",
  join(root, "apps", "web", "public", "third-party-notices.txt"),
);
const read = (file) => readFileSync(file, "utf8");
const json = (file) => JSON.parse(read(file));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const rel = (file) => relative(root, file).split(sep).join("/");
const manifest = json(join(source, "routeverity-source-manifest.json"));
const selected = new Set(manifest.files);
const physical = new Map();
const observed = [];
const warnings = [];
const noticeSourcesPath = join(root, "docs", "licensing-notice-sources.json");
const noticeSources = existsSync(noticeSourcesPath)
  ? json(noticeSourcesPath).records
  : [];
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : entry.isFile()
        ? [join(directory, entry.name)]
        : [],
  );
}
function licenseFiles(directory) {
  const result = [];
  const external = rel(directory).includes("node_modules/");
  function visit(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name);
      if (
        entry.isFile() &&
        /^(?:licen[cs]es?|copying|copyright|notice|authors)(?:[._-].*)?$/i.test(
          entry.name,
        )
      )
        result.push(file);
      if (
        external &&
        entry.isDirectory() &&
        !["node_modules", ".git"].includes(entry.name)
      )
        visit(file);
    }
  }
  visit(directory);
  return result.sort();
}
function textLicense(text) {
  if (/Permission is hereby granted, free of charge/.test(text)) return "MIT";
  if (/Permission to use, copy, modify, and(?:\/or| or) distribute/.test(text))
    return "ISC";
  if (/SIL OPEN FONT LICENSE/.test(text)) return "OFL-1.1";
  if (/Apache License[\s\S]*Version 2\.0/.test(text)) return "Apache-2.0";
  return null;
}
function register(directory, descriptor) {
  directory = realpathSync(directory);
  if (physical.has(directory)) return physical.get(directory);
  const p = descriptor ?? json(join(directory, "package.json"));
  if (!p.name) return null;
  const attributionFiles = licenseFiles(directory);
  let declaredLicense =
    typeof p.license === "string" ? p.license : p.license?.type ?? null;
  let version = p.version ?? null;
  let name = p.name;
  const notes = [];
  if (rel(directory).includes("/next/dist/compiled/")) {
    const suffix = rel(directory).split("/next/").at(-1);
    const repair = vendorSecurityRepair.files.find((file) =>
      file.path.startsWith(suffix + "/"),
    );
    if (repair)
      notes.push(
        repair.forwarder
          ? `Version-bound Next repair: this entry is only a verified forwarder to ${repair.forwarder}; the separately inventoried fixed dependency supplies its implementation. Original framework attribution is retained.`
          : "Version-bound Next repair: compiled Babel core remains 7.26.10; its external source-map read delegates to the verified publisher reader from @babel/core 7.29.6. This is a targeted backport, not a full Babel version upgrade.",
      );
  }
  if (!version && rel(directory).includes("/next/dist/compiled/")) {
    const nextDirectory = directory.slice(
      0,
      directory.indexOf(`${sep}dist${sep}compiled${sep}`),
    );
    version = `bundled-with-next-${json(join(nextDirectory, "package.json")).version}`;
    notes.push(
      "Vendored Next component; its independent upstream version is not declared in the installed subpackage.",
    );
  }
  if (!declaredLicense && attributionFiles.length) {
    declaredLicense = textLicense(attributionFiles.map(read).join("\n"));
    if (declaredLicense)
      notes.push(
        "Licence identified from included licence text, not package.json.",
      );
  }
  if (
    rel(directory).includes("node_modules/.prisma/client") &&
    name.startsWith("prisma-client-")
  ) {
    name = "@prisma/client-generated";
    declaredLicense = "Apache-2.0";
    notes.push(
      "Generated Prisma runtime; regenerated from the archived project schema. Prisma runtime licence is supplied by @prisma/client; project schema retains the root AGPL licence.",
    );
  }
  if (!rel(directory).includes("node_modules/") && !declaredLicense) {
    declaredLicense = "AGPL-3.0-or-later";
    notes.push(
      "Permitted workspace source covered by the repository root licence; third-party material retains its own terms.",
    );
  }
  for (const notice of noticeSources.filter(
    (n) => n.name === name && n.version === version,
  )) {
    const file = resolve(root, notice.file);
    if (hash(readFileSync(file)) !== notice.sha256)
      throw new Error("Upstream notice checksum mismatch: " + notice.file);
    attributionFiles.push(file);
    notes.push(
      `Additional unmodified vendor notice retrieved from ${notice.source} at ${notice.revision}.`,
    );
  }
  const record = {
    name,
    version,
    source: p.repository ?? p.homepage ?? null,
    license: declaredLicense,
    scopes: new Set(),
    roots: [rel(directory)],
    notes,
    attributionFiles,
    directory,
  };
  physical.set(directory, record);
  return record;
}
function nearest(file) {
  const compiled = rel(file).match(
    /^(.*\/next\/dist\/compiled\/)((?:@[^/]+\/)?[^/]+)/,
  );
  if (compiled) {
    const directory = resolve(root, compiled[1], compiled[2]);
    const packageJson = join(directory, "package.json");
    if (existsSync(packageJson) && json(packageJson).name)
      return register(directory);
    if (licenseFiles(directory).length)
      return register(directory, { name: `next-vendored/${compiled[2]}` });
  }
  let directory = statSync(file).isDirectory() ? file : dirname(file);
  for (;;) {
    if (existsSync(join(directory, "package.json"))) {
      const p = json(join(directory, "package.json"));
      if (p.name) return register(directory);
    }
    if (directory === root) return null;
    const parent = dirname(directory);
    if (parent === directory)
      throw new Error("Dependency escaped the restoration tree: " + file);
    directory = parent;
  }
}
function observe(file, scope) {
  if (!existsSync(file))
    throw new Error("Build evidence references a missing file: " + rel(file));
  const actual = realpathSync(file);
  const difference = relative(root, actual);
  if (
    isAbsolute(difference) ||
    difference === ".." ||
    difference.startsWith(`..${sep}`)
  )
    throw new Error(
      "Build depends on a file outside the source restoration: " + file,
    );
  const p = nearest(actual);
  if (p) p.scopes.add(scope);
}
const pnpm = join(root, "node_modules", ".pnpm");
for (const entry of readdirSync(pnpm, { withFileTypes: true }).filter((e) =>
  e.isDirectory(),
)) {
  const container = join(pnpm, entry.name, "node_modules");
  if (!existsSync(container)) continue;
  for (const child of readdirSync(container, { withFileTypes: true })) {
    if (child.name.startsWith(".")) continue;
    const directory = join(container, child.name);
    const candidates =
      child.name.startsWith("@") && existsSync(directory)
        ? readdirSync(directory).map((name) => join(directory, name))
        : [directory];
    for (const candidate of candidates) {
      if (existsSync(join(candidate, "package.json"))) register(candidate);
    }
  }
}
const declarations = [];
for (const file of manifest.files.filter((f) =>
  /(?:^|\/)package\.json$/.test(f),
)) {
  const full = join(root, file);
  const p = register(dirname(full));
  p.scopes.add("source-workspace");
  const body = json(full);
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ])
    for (const [name, range] of Object.entries(body[field] ?? {}))
      declarations.push({ manifest: file, field, name, range });
}
const tools = [
  ["packages/ui/node_modules/tsup", "workspace build"],
  ["apps/web/node_modules/typescript", "type checking"],
  ["apps/web/node_modules/prisma", "client generation"],
  ["apps/web/node_modules/postcss", "stylesheet build"],
  ["apps/web/node_modules/autoprefixer", "stylesheet build"],
  [
    "apps/web/node_modules/tailwindcss",
    "stylesheet build and generated preflight/utilities",
  ],
  ["node_modules/eslint", "scoped lint"],
  ["apps/web/node_modules/vitest", "unit validation"],
  ["apps/web/node_modules/@playwright/test", "browser/HTTP validation"],
].map(([file, purpose]) => {
  const p = register(resolve(root, file));
  p.scopes.add("build-or-test-tool");
  return {
    name: p.name,
    version: p.version,
    purpose,
    sourceArchiveInclusion: false,
    note: "External tool fetched by frozen install, not copied into source archive.",
  };
});
const next = join(root, "apps", "web", ".next");
const buildId = read(join(next, "BUILD_ID")).trim();
for (const target of ["browser", "server", "edge"]) {
  const file = join(next, `routeverity-build-${target}.json`);
  const data = json(file);
  if (data.target !== target || !data.resources?.length)
    throw new Error("Missing emitted-module evidence for " + target);
  observed.push({
    target,
    evidence: data.evidence,
    sha256: hash(readFileSync(file)),
    resources: data.resources,
  });
  for (const file of data.resources)
    observe(resolve(root, file), `${target}-chunk`);
}
const traces = [];
for (const file of files(next).filter((f) => f.endsWith(".nft.json"))) {
  traces.push({ file: rel(file), sha256: hash(readFileSync(file)) });
  for (const traced of json(file).files)
    observe(resolve(dirname(file), traced), "server-file-trace");
}
if (!traces.length) throw new Error("No server traces found.");
const generatedStyles = files(join(next, "static", "css"))
  .filter((f) => f.endsWith(".css"))
  .map((file) => ({
    file: rel(file),
    sha256: hash(readFileSync(file)),
    tailwindVersion: read(file).match(/tailwindcss v([\d.]+)/)?.[1] ?? null,
  }));
const tailwind = register(
  join(root, "apps", "web", "node_modules", "tailwindcss"),
);
if (!generatedStyles.some((s) => s.tailwindVersion === tailwind.version))
  throw new Error(
    "Generated stylesheet lacks the expected installed Tailwind version notice; inspect its provenance.",
  );
tailwind.scopes.add("browser-generated-css");
const workspaceBundles = [];
for (const workspace of ["ui", "utils"]) {
  const directory = join(root, "packages", workspace);
  const metas = files(join(directory, "dist")).filter((f) =>
    /metafile.*\.json$/.test(f),
  );
  if (!metas.length)
    throw new Error(
      "No workspace metafile; rebuild with ROUTEVERITY_LICENSE_AUDIT=1: " +
        workspace,
    );
  for (const file of metas) {
    const data = json(file);
    const inputs = Object.keys(data.inputs);
    workspaceBundles.push({
      file: rel(file),
      inputs,
      sha256: hash(readFileSync(file)),
    });
    for (const input of inputs)
      if (!input.startsWith("<"))
        observe(resolve(directory, input), "workspace-bundle-input");
  }
}
function obligations(license) {
  const result = [
    "Preserve applicable copyright, licence and notice texts when redistributing the component.",
  ];
  if (!license)
    result.push(
      "UNRESOLVED: identify licence/provenance before distributing this component.",
    );
  if (/LGPL/.test(license ?? ""))
    result.push(
      "Review linked library source availability, modifications, relinking/replacement, reverse-engineering permissions and required notices if conveying linked binaries; LGPL is not automatically prohibited.",
    );
  if (/MPL|Mozilla Public/.test(license ?? ""))
    result.push(
      "Review file-level source and modification disclosure/availability when conveying covered files; MPL is not automatically prohibited.",
    );
  if (/(?:^|[^A-Z])AGPL/.test(license ?? ""))
    result.push(
      "Offer matching complete corresponding source to network users of the modified AGPL application; preserve notices, licence and modification information.",
    );
  if (/(?:^|[^A-ZL])GPL/.test(license ?? ""))
    result.push(
      "Review binary-conveyance corresponding source, licence compatibility and installation-information requirements.",
    );
  if (/OFL|SIL OPEN FONT LICENSE/.test(license ?? ""))
    result.push(
      "Preserve font copyright/OFL; review reserved font names and embedding/redistribution terms; do not sell font software by itself.",
    );
  if (/Apache/.test(license ?? ""))
    result.push(
      "Retain supplied NOTICE and relevant attribution; mark modifications and review patent/trademark limits.",
    );
  if (/propriet|UNLICENSED|SEE LICENSE/i.test(license ?? ""))
    result.push(
      "UNRESOLVED: review the actual terms and permission; do not infer redistribution rights.",
    );
  if (/CC-BY/.test(license ?? ""))
    result.push(
      "Retain creator credit, licence link and change indication; distinguish database/data redistribution from facts used only during build.",
    );
  if (/\bOR\b/.test(license ?? ""))
    result.push(
      "Document the selected licence alternative; an OR expression does not require simultaneous compliance with every alternative.",
    );
  if (/Patent|Alliance for Open Media/i.test(license ?? ""))
    result.push(
      "Review the separately declared codec/patent grant; copyright licensing is not patent or trademark clearance.",
    );
  return result;
}
const notices = [
  "ROUTEVERITY THIRD-PARTY NOTICES",
  "",
  "Generated from the local audited build. These notices are not a declaration of legal clearance.",
  "The source archive contains no node_modules, generated third-party runtimes or native binaries.",
  "Native binary redistribution requires the additional source/notice/relinking review described in docs/licensing-audit.md.",
  "",
];
const emittedMedia = files(join(next, "static", "media"));
const emittedHashes = new Set(emittedMedia.map((f) => hash(readFileSync(f))));
const fontHashes = new Map();
for (const p of [...physical.values()].filter((p) => p.name === "geist")) {
  for (const file of files(join(p.directory, "dist")).filter((f) =>
    /\.(?:woff2?|ttf|otf)$/.test(f),
  )) {
    const fingerprint = hash(readFileSync(file));
    fontHashes.set(fingerprint, rel(file));
    if (emittedHashes.has(fingerprint)) {
      if (
        !p.attributionFiles.length ||
        !/OFL|SIL OPEN FONT LICENSE/.test(p.license ?? "")
      )
        throw new Error(
          "An emitted font lacks verified permission/copyright text.",
        );
      p.scopes.add("browser-font-asset");
    }
  }
}
const grouped = new Map();
for (const record of physical.values()) {
  const key = `${record.name}@${record.version ?? "undeclared"}:${record.license}`;
  const previous = grouped.get(key);
  if (previous) {
    previous.roots.push(...record.roots);
    for (const scope of record.scopes) previous.scopes.add(scope);
    for (const file of record.attributionFiles)
      if (
        !previous.attributionFiles.some(
          (f) => hash(readFileSync(f)) === hash(readFileSync(file)),
        )
      )
        previous.attributionFiles.push(file);
  } else grouped.set(key, record);
}
const packages = [...grouped.values()]
  .sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
  )
  .map((p) => {
    const scopes = [...p.scopes].sort();
    const production = scopes.some((s) =>
      /chunk$|file-trace$|generated-css$|font-asset$/.test(s),
    );
    const sourceArchive = p.roots.some((r) =>
      selected.has(r ? `${r}/package.json` : "package.json"),
    );
    const required = obligations(p.license);
    const supplemental = noticeSources.filter(
      (n) => n.name === p.name && n.version === p.version,
    );
    if (
      production &&
      !p.attributionFiles.length &&
      !sourceArchive &&
      p.name !== "@prisma/client-generated"
    )
      warnings.push(`No supplied attribution text: ${p.name}@${p.version}`);
    if (production || scopes.includes("build-or-test-tool")) {
      notices.push(
        `\n===== ${p.name}@${p.version ?? "undeclared"} (${p.license ?? "UNRESOLVED"}) =====\n`,
      );
      for (const file of p.attributionFiles)
        notices.push(`--- ${rel(file)} ---\n${read(file)}\n`);
    }
    return {
      name: p.name,
      version: p.version,
      upstreamVersion:
        supplemental.find((n) => n.actualVersion)?.actualVersion ?? p.version,
      source:
        p.source ??
        (sourceArchive
          ? { archiveRoots: p.roots }
          : supplemental.length
            ? { upstreamNotice: supplemental[0].source }
            : {
                packageRegistry: `https://registry.npmjs.org/${p.name}/${p.version ?? ""}`,
                sourceProvenance:
                  "Original source repository/revision not declared; review before redistribution.",
              }),
      license: p.license,
      scopes,
      productionInclusion: production
        ? "observed emitted chunk, font, generated stylesheet or conservative server file trace"
        : scopes.includes("workspace-bundle-input")
          ? "workspace compilation input; final Next tree-shaking not proven per input"
          : scopes.includes("build-or-test-tool")
            ? "external build/test tool; tool package code not observed in production"
            : "not observed; installed/declaration alone is not distribution evidence",
      sourceArchiveInclusion: sourceArchive
        ? "permitted workspace source"
        : "external package bytes not included",
      declarations: declarations.filter((d) => d.name === p.name),
      requiredAttribution:
        production && p.attributionFiles.length
          ? "Supplied texts retained in apps/web/public/third-party-notices.txt"
          : sourceArchive
            ? "Root/project licence and existing source notices retained"
            : "Preserve vendor notices if later redistributed; external bytes absent from source archive",
      attributionEvidence: p.attributionFiles.map((f) => ({
        file: rel(f),
        sha256: hash(readFileSync(f)),
      })),
      obligationsRequiringReview: required,
      notes: [...p.notes, ...supplemental.map((n) => n.note).filter(Boolean)],
      installedRoots: [...new Set(p.roots)].sort(),
    };
  });
const nativeComponents = [];
const nativeNoticeSources = json(
  join(root, "docs/native-license-evidence.json"),
).records;
const includedNativeNotices = new Set();
for (const record of physical.values()) {
  if (
    !record.scopes.has("server-file-trace") ||
    !existsSync(join(record.directory, "versions.json")) ||
    !record.name.startsWith("@img/sharp-")
  )
    continue;
  const readme = read(join(record.directory, "README.md"));
  notices.push(
    `\n===== ${record.name}: vendor native component declarations =====\n${readme}\n`,
  );
  for (const { name, version, license } of nativeLicenseDeclarations(
    readme,
    json(join(record.directory, "versions.json")),
  )) {
    const evidence = nativeNoticeFor(
      root,
      name,
      version,
      `${record.name}@${record.version}`,
      nativeNoticeSources,
    );
    if (evidence && !includedNativeNotices.has(evidence.sha256)) {
      notices.push(
        `\n===== Native component ${name}@${version}: complete upstream text =====\nSource: ${evidence.source}\nScope: ${evidence.review}\n${evidence.text}\n`,
      );
      includedNativeNotices.add(evidence.sha256);
    }
    nativeComponents.push({
      name,
      version,
      source: {
        binaryPackage: `${record.name}@${record.version}`,
        upstreamBuild: "https://github.com/lovell/sharp-libvips",
        evidence: `${rel(record.directory)}/versions.json and README.md`,
      },
      license,
      ...(evidence
        ? {
            attributionEvidence: [
              {
                file: evidence.file,
                sha256: evidence.sha256,
                source: evidence.source,
              },
            ],
            notes: [evidence.upstreamStatement, evidence.review],
          }
        : {}),
      productionInclusion:
        "contained in conservatively traced native image library; not browser JavaScript",
      sourceArchiveInclusion:
        "no native binary or native library source included",
      requiredAttribution:
        "Vendor aggregate licence table preserved; complete component copyright/licence and matching-source/relinking package must be reviewed before conveying native binaries",
      obligationsRequiringReview: obligations(license),
      classification: /LGPL|Mozilla/.test(license ?? "")
        ? "licensed with obligations"
        : license
          ? "permissive with notices/patent review where applicable"
          : "unclear",
    });
  }
}
const resources = new Set(observed.flatMap((o) => o.resources));
const emittedScripts = [
  ...files(join(next, "static")),
  ...files(join(next, "server")),
]
  .filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: rel(f), text: read(f) }));
const assets = [];
for (const file of manifest.files) {
  if (/\.[cm]?[jt]sx?$|\.css$/.test(file)) {
    const references = new Set(
      [...read(join(root, file)).matchAll(/https?:\/\/[^\s"'`<>\\)]+/gi)]
        .map((m) => m[0])
        .filter((url) =>
          /\.(?:png|jpe?g|gif|webp|svg|woff2?|ttf|m?js)(?:[?#].*)?$/i.test(url),
        ),
    );
    for (const url of references) {
      const host = new URL(url).hostname;
      const fixture =
        /(?:^|\.)(?:example\.(?:com|net|org)|example|test|invalid)$/.test(host);
      const fragment = url.split("${")[0];
      const productionEvidence = emittedScripts
        .filter((s) => s.text.includes(fragment))
        .map((s) => ({
          file: s.file,
          evidence:
            fragment === url
              ? "exact URI string in emitted JavaScript"
              : "static URI prefix in emitted JavaScript; interpolation/use not established",
        }));
      assets.push({
        name: `${file}: ${url}`,
        version: null,
        source: url,
        referenceInSourceArchive: true,
        license: null,
        classification: fixture
          ? "test fixture reference"
          : "unclear external reference",
        sourceArchiveInclusion: false,
        productionInclusion: productionEvidence.length
          ? "URI/prefix observed in emitted JavaScript; remote asset bytes are not included and actual rendering/fetching is not established"
          : "Source-only URI reference not individually observed in emitted JavaScript; remote bytes not included or fetched",
        productionEvidence,
        requiredAttribution: fixture
          ? "Reserved-domain test fixture, not supplied third-party artwork"
          : "Do not enable/use uncleared external artwork or vendor scripts. Confirm original terms/provenance or replace the referenced asset with an owned RouteVerity graphic or a documented permissive alternative; no branding redesign is required.",
      });
    }
  }
  if (/\.(?:png|jpe?g|gif|webp|ico|woff2?|ttf|otf|svg)$/i.test(file)) {
    const owned = /^apps\/web\/public\/(?:brand\/.*\.png|favicon\.ico)$/.test(
      file,
    );
    assets.push({
      name: file,
      version: hash(readFileSync(join(root, file))),
      source: owned
        ? "User-confirmed RouteVerity geometric brand assets; historical private provenance audit, not new legal ownership certification"
        : "Archived source path",
      license: owned
        ? "RouteVerity-owned artwork under the source distribution's root terms; trademark rights not granted"
        : "Requires individual provenance review",
      classification: owned ? "RouteVerity-owned" : "unclear",
      sourceArchiveInclusion: true,
      productionInclusion: file.startsWith("apps/web/public/")
        ? "public asset"
        : resources.has(file)
          ? "observed module resource"
          : "not individually observed",
      requiredAttribution: owned
        ? "Retain root source notices; ownership/trademark confirmation remains a human responsibility"
        : "Review before distribution",
    });
  }
  if (
    /\.[cm]?[jt]sx?$/.test(file) &&
    /<svg(?:\s|>)/.test(read(join(root, file)))
  )
    assets.push({
      name: file,
      version: hash(readFileSync(join(root, file))),
      source:
        "Permitted source tree, outside restricted Nucleo/EE/Stripe paths",
      license:
        "Root AGPL-3.0-or-later unless an existing third-party notice specifies otherwise",
      classification: "licensed with obligations",
      sourceArchiveInclusion: true,
      productionInclusion: resources.has(file)
        ? "observed emitted module; not proof every icon/export survives"
        : file.startsWith("packages/ui/")
          ? "workspace source; individual inclusion obscured by workspace bundling/tree-shaking"
          : "not individually observed",
      requiredAttribution:
        "Retain source/root notices; this is not proof against unrecorded historical copying or a trademark clearance",
    });
}
for (const file of emittedMedia) {
  const version = hash(readFileSync(file));
  const font = fontHashes.get(version);
  assets.push({
    name: rel(file),
    version,
    source: font ?? "Unmatched emitted asset: individual provenance required",
    license: font ? "OFL-1.1 (Geist; byte-matched to installed font)" : null,
    classification: font
      ? "permissively licensed with OFL obligations"
      : "unclear",
    sourceArchiveInclusion: false,
    productionInclusion: "emitted static asset",
    requiredAttribution:
      "Preserve matched font copyright and OFL in apps/web/public/third-party-notices.txt; generated asset bytes are not part of source-only archive",
  });
}
const inventory = {
  schemaVersion: 1,
  vendorSecurityRepair,
  scope:
    "Local platform-specific production build, permitted source archive and installed dependency context; not all lockfile/installed packages are shipped.",
  environment: {
    node: process.version,
    packageManager: json(join(root, "package.json")).packageManager,
    platform: platform(),
    arch: arch(),
    osRelease: release(),
  },
  revision: {
    upstreamCommit: manifest.upstreamCommit,
    completeRevision:
      "Exact sanitized-source per-file hash map and archive SHA256 are recorded alongside the candidate; upstream HEAD alone excludes independent modifications.",
    lockfileSha256: hash(readFileSync(join(root, "pnpm-lock.yaml"))),
    buildId,
  },
  summary: {
    packages: packages.length,
    productionObservedPackages: packages.filter((p) =>
      /observed emitted/.test(p.productionInclusion),
    ).length,
    nativeComponents: nativeComponents.length,
    sourceAndEmittedAssets: assets.filter((a) => !a.referenceInSourceArchive)
      .length,
    externalReferenceRecords: assets.filter((a) => a.referenceInSourceArchive)
      .length,
    assetRecords: assets.length,
    serverTraces: traces.length,
  },
  limitations: [
    "Tree-shaking can remove exports inside a recorded emitted resource.",
    "Server file traces conservatively include framework capabilities whether or not a user exercises them.",
    "Workspace metafiles identify compilation inputs, not byte-precise final client provenance.",
    "Installed/declaration-only packages are not classified as production-shipped.",
    "Windows evidence does not certify a later Linux/provider build; rerun on the actual deployment target.",
    "Restricted source was neither restored nor inspected; known path/import/external-asset checks cannot prove that no historical code was ever copied elsewhere.",
    "Vendor native version/licence tables are declarations, not a complete native-source or relinking distribution.",
    "Legal, ownership, trademark, patent and unknown-provenance conclusions require qualified human review.",
  ],
  warnings,
  tools,
  packages,
  nativeComponents,
  assets,
  emittedModules: observed,
  generatedStyles,
  workspaceBundles,
  serverTraces: traces,
};
writeFileSync(output, JSON.stringify(inventory, null, 2) + "\n");
writeFileSync(noticeOutput, notices.join("\n") + "\n");
console.log(
  JSON.stringify(
    {
      ...inventory.summary,
      warnings,
      inventory: rel(output),
      notices: rel(noticeOutput),
    },
    null,
    2,
  ),
);
