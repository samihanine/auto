/**
 * Gets a Power BI access token (device code sign-in, generic "organizations" tenant) and opens
 * the app so it is saved into config.xlsx automatically.
 *
 *   bun run pbi-token            reuse the cached session when possible
 *   bun run pbi-token --login    force a new sign-in
 *
 * The refresh token is cached in .local/pbi-refresh-token (gitignored) so later runs need no sign-in.
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const CLIENT_ID = "ea0616ba-638b-4df5-95b9-636659ae5121"; // Power BI public client (no app registration needed)
const LOGIN = "https://login.microsoftonline.com/organizations/oauth2/v2.0";
const SCOPE =
  "https://analysis.windows.net/powerbi/api/.default offline_access";
const CACHE = ".local/pbi-refresh-token";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

async function post<T>(endpoint: string, params: Record<string, string>) {
  const response = await fetch(`${LOGIN}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  });
  return (await response.json()) as T;
}

function open(url: string) {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  spawn(command[0], command.slice(1), {
    stdio: "ignore",
    detached: true,
  }).unref();
}

async function fromRefreshToken() {
  const refreshToken = await readFile(CACHE, "utf8").catch(() => "");
  if (!refreshToken.trim()) return null;
  const tokens = await post<TokenResponse>("token", {
    grant_type: "refresh_token",
    refresh_token: refreshToken.trim(),
    scope: SCOPE,
  });
  if (!tokens.access_token) {
    await rm(CACHE, { force: true });
    return null;
  }
  return tokens;
}

async function fromDeviceCode() {
  const device = await post<{
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    interval?: number;
    expires_in?: number;
    error_description?: string;
  }>("devicecode", { scope: SCOPE });
  if (!device.device_code || !device.user_code)
    throw new Error(device.error_description ?? "Could not start the sign-in.");
  const verification =
    device.verification_uri ?? "https://microsoft.com/devicelogin";
  console.log(
    `\nSign in at ${verification} with the code:\n\n    ${device.user_code}\n`,
  );
  open(verification);

  let interval = device.interval ?? 5;
  const deadline = Date.now() + (device.expires_in ?? 900) * 1000;
  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    const tokens = await post<TokenResponse>("token", {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: device.device_code,
    });
    if (tokens.error === "authorization_pending") continue;
    if (tokens.error === "slow_down") {
      interval += 5;
      continue;
    }
    if (!tokens.access_token)
      throw new Error(tokens.error_description ?? "Sign-in failed.");
    return tokens;
  }
  throw new Error("The code expired, run the script again.");
}

const tokens =
  (!process.argv.includes("--login") && (await fromRefreshToken())) ||
  (await fromDeviceCode());
if (tokens.refresh_token) {
  await mkdir(".local", { recursive: true });
  await writeFile(CACHE, tokens.refresh_token);
}

const url = `${APP_URL}/settings/config?powerbiToken=${encodeURIComponent(tokens.access_token ?? "")}`;
open(url);
console.log(
  `Power BI token ready (valid ~1 h). Opened ${APP_URL}/settings/config to save it.`,
);
