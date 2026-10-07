import { normalizeDestinationHostname } from "./campaign-policy";

export function captureClickMetadata(headers: Headers) {
  const rawUserAgent =
    headers
      .get("user-agent")
      ?.replace(/[\r\n]/g, "")
      .slice(0, 512) || null;
  const referrer = headers.get("referer");
  let referrerHostname: string | null = null;
  if (referrer && referrer.length <= 8000) {
    try {
      const url = new URL(referrer);
      if (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      )
        referrerHostname = normalizeDestinationHostname(url.hostname);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      // Optional untrusted referrer metadata is not a redirect validation input.
    }
  }
  return { analyticsCaptured: true, rawUserAgent, referrerHostname };
}
