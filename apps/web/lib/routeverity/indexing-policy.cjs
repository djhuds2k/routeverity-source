const { isIP } = require("node:net");

const publicPaths = Object.freeze([
  "/",
  "/features",
  "/google-ads",
  "/pricing",
  "/transparency",
  "/privacy",
  "/security",
  "/tracking-domains",
  "/contact",
]);

/** @param {Record<string, string | undefined>} env */
function indexingPolicy(env) {
  let url;
  try {
    url = new URL(env.NEXTAUTH_URL || "");
  } catch {
    return { enabled: false, origin: null };
  }
  const host = url.hostname.toLowerCase();
  const publicHost =
    host.includes(".") &&
    host
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) &&
    !isIP(host.replace(/^\[|\]$/g, "")) &&
    !/(?:^|\.)(?:localhost|local|test|invalid|internal|example|onion)$/.test(
      host,
    );
  const enabled =
    env.ROUTEVERITY_PUBLIC_INDEXING === "enabled" &&
    env.NODE_ENV === "production" &&
    (!env.VERCEL_ENV || env.VERCEL_ENV === "production") &&
    url.protocol === "https:" &&
    publicHost &&
    !url.port &&
    !url.username &&
    !url.password &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash;
  return {
    enabled,
    origin:
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
        ? url.origin
        : null,
  };
}

module.exports = { publicPaths, indexingPolicy };
