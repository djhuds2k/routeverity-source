const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "../../..");
const ui = path.join(root, "packages", "ui");
const iconEntry = path.join(ui, "src", "icons", "index.tsx");
const replacements = path.join(ui, "src", "icons", "lucide-icons.tsx");
const excluded = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  ".git",
  "(ee)",
  "stripe-app",
  "nucleo",
]);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (excluded.has(entry.name)) return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(filename)
      : /\.[jt]sx?$/.test(entry.name)
        ? [filename]
        : [];
  });
}

function parse(filename) {
  return ts.createSourceFile(
    filename,
    fs.readFileSync(filename, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
}

function exportedNames(filename, visited = new Set()) {
  if (visited.has(filename)) return new Set();
  visited.add(filename);
  const names = new Set();
  for (const statement of parse(filename).statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        statement.exportClause.elements.forEach((item) =>
          names.add(item.name.text),
        );
      } else if (statement.moduleSpecifier?.text.startsWith(".")) {
        const base = path.resolve(
          path.dirname(filename),
          statement.moduleSpecifier.text,
        );
        assert.ok(
          !base.split(path.sep).some((segment) => excluded.has(segment)),
        );
        const target = [
          `${base}.ts`,
          `${base}.tsx`,
          path.join(base, "index.ts"),
          path.join(base, "index.tsx"),
        ].find((candidate) => fs.existsSync(candidate));
        if (target) {
          exportedNames(target, visited).forEach((name) => names.add(name));
        }
      }
    } else if (
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      if (statement.name) names.add(statement.name.text);
      if (ts.isVariableStatement(statement)) {
        statement.declarationList.declarations.forEach((item) => {
          if (ts.isIdentifier(item.name)) names.add(item.name.text);
        });
      }
    }
  }
  return names;
}

test("all permitted shared UI consumers have explicit named exports", () => {
  const icons = exportedNames(iconEntry);
  const publicUi = exportedNames(path.join(ui, "src", "index.tsx"));
  let imports = 0;
  for (const filename of [
    ...sourceFiles(path.join(root, "apps")),
    ...sourceFiles(path.join(root, "packages")),
  ]) {
    for (const statement of parse(filename).statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const moduleName = statement.moduleSpecifier.text;
      const resolved = path.resolve(path.dirname(filename), moduleName);
      const names =
        moduleName === "@dub/ui"
          ? publicUi
          : moduleName === "@dub/ui/icons" ||
              resolved === path.dirname(iconEntry) ||
              resolved === replacements.replace(/\.tsx$/, "")
            ? icons
            : null;
      if (!names || !statement.importClause?.namedBindings) continue;
      const bindings = statement.importClause.namedBindings;
      if (!ts.isNamedImports(bindings)) continue;
      imports++;
      for (const item of bindings.elements) {
        const name = (item.propertyName || item.name).text;
        assert.ok(
          names.has(name),
          `${filename}: missing ${name} from ${moduleName}`,
        );
      }
    }
  }
  assert.ok(imports > 0, "consumer inventory must not be empty");
});

test("every replacement renders an accessible SVG and supports fill variants", async () => {
  const icons = await import(
    pathToFileURL(path.join(ui, "dist", "icons", "index.mjs")).href
  );
  const names = [...exportedNames(replacements)].filter(
    (name) => name !== "ReplacementIconProps",
  );
  assert.equal(names.length, 206);
  for (const name of names) {
    assert.ok(icons[name], `missing built export ${name}`);
    const markup = renderToStaticMarkup(
      React.createElement(icons[name], {
        className: "migration-icon",
        "aria-label": name,
        width: 18,
        height: 18,
        strokeWidth: 1.5,
        variant: "fill",
      }),
    );
    assert.match(markup, /^<svg\b/);
    assert.ok(markup.includes(`aria-label="${name}"`));
    assert.match(markup, /class="[^"]*migration-icon[^"]*"/);
    assert.match(markup, /width="18"/);
    assert.match(markup, /height="18"/);
    assert.match(markup, /stroke-width="1.5"/);
    assert.match(markup, /fill="currentColor"/);
    assert.doesNotMatch(markup, /\bvariant=/);
  }
  const outline = renderToStaticMarkup(
    React.createElement(icons.Check2, { variant: "outline" }),
  );
  assert.match(outline, /fill="none"/);
  const override = renderToStaticMarkup(
    React.createElement(icons.Check2, { variant: "fill", fill: "red" }),
  );
  assert.match(override, /fill="red"/);
});

test("permitted UI sources and the two email templates have no restricted icon dependencies", () => {
  for (const filename of sourceFiles(path.join(ui, "src"))) {
    for (const statement of parse(filename).statements) {
      if (
        !ts.isImportDeclaration(statement) &&
        !ts.isExportDeclaration(statement)
      )
        continue;
      const moduleName = statement.moduleSpecifier?.text;
      if (moduleName) {
        assert.ok(
          !moduleName.split(/[\\/]/).includes("nucleo"),
          `${filename}: restricted icon dependency`,
        );
      }
    }
  }
  for (const template of [
    "partner-program-summary.tsx",
    "program-payout-reminder.tsx",
  ]) {
    const source = fs.readFileSync(
      path.join(root, "packages", "email", "src", "templates", template),
      "utf8",
    );
    assert.doesNotMatch(source, /https?:\/\/[^\s"']*\/icons\//);
    assert.doesNotMatch(source, /nucleo/i);
    assert.doesNotMatch(source, /src=\{icon\}/);
    assert.match(source, /\{title\}/);
    assert.match(source, /\{value\}/);
  }
});
