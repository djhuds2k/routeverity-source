const { mkdirSync, writeFileSync } = require("node:fs");
const { isAbsolute, relative, resolve, sep } = require("node:path");

function buildInventoryPlugin(root, target) {
  return {
    apply(compiler) {
      compiler.hooks.done.tap("RouteVerityBuildInventory", (stats) => {
        if (stats.hasErrors()) return;
        const compilation = stats.compilation;
        const resources = new Set();
        function collect(module, parentEmitted = false) {
          const emitted =
            parentEmitted ||
            compilation.chunkGraph.getNumberOfModuleChunks(module) > 0;
          if (!emitted) return;
          if (module.resource) {
            const path = relative(root, module.resource.split("?")[0]);
            if (
              isAbsolute(path) ||
              path === ".." ||
              path.startsWith(`..${sep}`)
            )
              throw new Error(
                `Emitted dependency is outside the source tree: ${module.resource}`,
              );
            resources.add(path.split(sep).join("/"));
          }
          for (const nested of module.modules ?? []) collect(nested, emitted);
        }
        for (const module of compilation.modules) collect(module);
        const directory = resolve(root, "apps", "web", ".next");
        mkdirSync(directory, { recursive: true });
        writeFileSync(
          resolve(directory, `routeverity-build-${target}.json`),
          JSON.stringify(
            {
              schemaVersion: 1,
              target,
              evidence:
                "Resources in emitted webpack chunks, including concatenated modules; not proof that every export survived minification.",
              resources: [...resources].sort(),
            },
            null,
            2,
          ) + "\n",
        );
      });
    },
  };
}

module.exports = { buildInventoryPlugin };
