import { PBI_TOKEN_TTL_MS } from "./constants";
import { storage } from "./storage";

export const tokenAge = (savedAt: number) => Date.now() - savedAt;
export const isTokenExpired = (savedAt: number) => !savedAt || tokenAge(savedAt) > PBI_TOKEN_TTL_MS;

/** Current Power BI access token, saved by `bun run pbi-token` through /settings?pbiToken=… */
export async function getPbiToken() {
  const { pbiToken, pbiTokenAt } = await storage.settings.get();
  if (!pbiToken) throw new Error("No Power BI token — run `bun run pbi-token` (see Settings).");
  if (isTokenExpired(pbiTokenAt))
    throw new Error("The Power BI token expired — run `bun run pbi-token` again.");
  return pbiToken;
}

/** Claims of the JWT (tenant id, user name…), without verifying it. */
export function tokenClaims(token: string): Record<string, string> {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(payload))));
  } catch {
    return {};
  }
}
