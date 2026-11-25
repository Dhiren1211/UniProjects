import type { NextRequest } from "next/server";

/**
 * True when the request was made by our own pages (the app's fetch calls),
 * not typed into the address bar or sent from another website.
 *
 * Browsers attach Sec-Fetch-Site to every request and pages cannot change it:
 * "same-origin" for our own fetches, "none" when a URL is opened directly,
 * "cross-site" from elsewhere. Older browsers without it fall back to the
 * Origin / Referer host.
 *
 * This keeps casual visitors and other sites out of semi-public lists. It is
 * not authentication - a script can fake headers - so anything sensitive
 * must still require sign-in.
 */
export function isFromOurPages(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "same-site";
  const from = req.headers.get("origin") || req.headers.get("referer");
  if (!from) return false;
  try {
    return new URL(from).host === req.headers.get("host");
  } catch {
    return false;
  }
}
