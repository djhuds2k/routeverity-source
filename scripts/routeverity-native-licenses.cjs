const { createHash } = require("node:crypto");
const { readFileSync, realpathSync } = require("node:fs");
const { isAbsolute, relative, resolve, sep } = require("node:path");

const aliases = {
  archive: "libarchive",
  exif: "libexif",
  ffi: "libffi",
  heif: "libheif",
  imagequant: "libimagequant",
  png: "libpng",
  rsvg: "librsvg",
  spng: "libspng",
  tiff: "libtiff",
  uhdr: "libultrahdr",
  vips: "libvips",
  webp: "libwebp",
  xml2: "libxml2",
};

function nativeLicenseDeclarations(readme, versions) {
  const table = new Map(
    readme
      .split(/\r?\n/)
      .filter((line) => /^\| [a-z]/.test(line))
      .map((line) => {
        const parts = line.split("|").map((part) => part.trim());
        return [parts[1], parts[2]];
      }),
  );
  return Object.entries(versions).map(([name, version]) => ({
    name,
    version,
    license: table.get(aliases[name] ?? name) ?? null,
  }));
}

function nativeNoticeFor(root, name, version, binaryPackage, records) {
  const matches = records.filter(
    (record) =>
      record.name === name &&
      record.version === version &&
      record.binaryPackages.includes(binaryPackage),
  );
  if (!matches.length) return null;
  if (matches.length !== 1)
    throw new Error("Ambiguous native notice evidence.");
  const record = matches[0];
  const directory = realpathSync(resolve(root, "docs/licenses"));
  const candidate = resolve(root, record.file);
  const child = relative(directory, candidate);
  if (
    isAbsolute(record.file) ||
    isAbsolute(child) ||
    child === ".." ||
    child.startsWith(".." + sep)
  )
    throw new Error("Native notice must remain in docs/licenses.");
  const actual = realpathSync(candidate);
  const actualChild = relative(directory, actual);
  if (
    isAbsolute(actualChild) ||
    actualChild === ".." ||
    actualChild.startsWith(".." + sep)
  )
    throw new Error("Native notice must remain in docs/licenses.");
  const text = readFileSync(actual, "utf8");
  if (createHash("sha256").update(text).digest("hex") !== record.sha256)
    throw new Error("Native notice checksum mismatch.");
  return { ...record, text };
}

module.exports = { nativeLicenseDeclarations, nativeNoticeFor };
