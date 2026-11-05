// Modified for RouteVerity, 2026-10-06 through 2026-10-17. See root NOTICE.md.
const { resolve } = require("node:path");
const {
  indexingPolicy,
  publicPaths,
} = require("./lib/routeverity/indexing-policy.cjs");

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  outputFileTracingRoot: resolve(__dirname, "..", ".."),
  transpilePackages: ["@dub/ui", "@dub/utils"],
  experimental: { optimizePackageImports: ["@dub/ui"] },
  webpack(config, { isServer, nextRuntime }) {
    if (process.env.ROUTEVERITY_LICENSE_AUDIT === "1") {
      const {
        buildInventoryPlugin,
      } = require("../../scripts/routeverity-build-inventory.cjs");
      config.plugins.push(
        buildInventoryPlugin(
          resolve(__dirname, "..", ".."),
          isServer ? (nextRuntime === "edge" ? "edge" : "server") : "browser",
        ),
      );
    }
    return config;
  },
  async headers() {
    const { enabled, origin } = indexingPolicy(process.env);
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      ...(enabled && origin
        ? publicPaths.map((source) => ({
            source,
            has: [
              {
                type: "host",
                value: new URL(origin).hostname.replaceAll(".", "\\."),
              },
            ],
            headers: [{ key: "X-Robots-Tag", value: "index, follow" }],
          }))
        : []),
    ];
  },
};
