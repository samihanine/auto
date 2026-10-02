/**
 * Local auth proxy: browsers can't call the device code / token endpoints of a generic client
 * (CORS), so the apps ask this server. Run with `bun run auth-proxy`.
 *
 *   GET  /status            → state of each resource (+ pending sign-in code)
 *   POST /login?resource=…  → starts a device code sign-in
 *   GET  /token?resource=…  → fresh access token (401 when a sign-in is needed)
 *   POST /logout            → forgets the session
 *
 * Refresh tokens are kept in .local/ms-auth.json (gitignored). Only local origins are allowed.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PROXY_PORT, RESOURCES, TENANT_ID } from "./src/config";
import type { Resource } from "./src/config";

const LOGIN = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0`;
const STORE = ".local/ms-auth.json";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};
type Pending = { resource: Resource; userCode: string; verificationUri: string; expiresAt: number; error?: string };

let refreshTokens: Record<string, string> = await readFile(STORE, "utf8")
  .then((text) => JSON.parse(text) as Record<string, string>)
  .catch(() => ({}));
const accessTokens = new Map<Resource, { token: string; expiresAt: number }>();
let pending: Pending | null = null;

const save = async () => {
  await mkdir(".local", { recursive: true });
  await writeFile(STORE, JSON.stringify(refreshTokens));
};

async function post(endpoint: string, params: Record<string, string>) {
  const response = await fetch(`${LOGIN}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return (await response.json()) as TokenResponse & Record<string, unknown>;
}

function remember(resource: Resource, tokens: TokenResponse) {
  const { clientId } = RESOURCES[resource];
  if (tokens.refresh_token) refreshTokens[clientId] = tokens.refresh_token;
  accessTokens.set(resource, {
    token: tokens.access_token!,
    expiresAt: Date.now() + ((tokens.expires_in ?? 3600) - 120) * 1000,
  });
  void save();
}

/** Access token from cache or refresh token (its own client first, then other Microsoft clients). */
async function accessToken(resource: Resource) {
  const cached = accessTokens.get(resource);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const { clientId, scope } = RESOURCES[resource];
  const candidates = [refreshTokens[clientId], ...Object.values(refreshTokens)].filter(Boolean);
  for (const refreshToken of new Set(candidates)) {
    const tokens = await post("token", { client_id: clientId, grant_type: "refresh_token", refresh_token: refreshToken, scope });
    if (tokens.access_token) {
      remember(resource, tokens);
      return tokens.access_token;
    }
  }
  return null;
}

async function startLogin(resource: Resource) {
  const { clientId, scope } = RESOURCES[resource];
  const device = await post("devicecode", { client_id: clientId, scope });
  if (!device.device_code) throw new Error(String(device.error_description ?? "Could not start the sign-in"));
  pending = {
    resource,
    userCode: String(device.user_code),
    verificationUri: String(device.verification_uri ?? "https://microsoft.com/devicelogin"),
    expiresAt: Date.now() + Number(device.expires_in ?? 900) * 1000,
  };
  void poll(resource, String(device.device_code), Number(device.interval ?? 5), Number(device.expires_in ?? 900));
  return pending;
}

async function poll(resource: Resource, deviceCode: string, interval: number, expiresIn: number) {
  const deadline = Date.now() + expiresIn * 1000;
  const code = pending?.userCode;
  while (Date.now() < deadline && pending?.resource === resource && pending.userCode === code) {
    await Bun.sleep(interval * 1000);
    const tokens = await post("token", {
      client_id: RESOURCES[resource].clientId,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
    });
    if (tokens.error === "authorization_pending") continue;
    if (tokens.error === "slow_down") {
      interval += 5;
      continue;
    }
    if (tokens.access_token) {
      remember(resource, tokens);
      pending = null;
    } else if (pending) pending.error = tokens.error_description ?? "Sign-in failed";
    return;
  }
}

const isLocal = (origin: string | null) =>
  !origin || origin === "null" || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const json = (data: unknown, origin: string | null, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin ?? "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });

Bun.serve({
  port: PROXY_PORT,
  hostname: "127.0.0.1",
  async fetch(request) {
    const origin = request.headers.get("origin");
    if (!isLocal(origin)) return new Response("Forbidden origin", { status: 403 });
    if (request.method === "OPTIONS") return json(null, origin, 204);

    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") as Resource | null;
    if (resource && !(resource in RESOURCES)) return json({ error: "unknown resource" }, origin, 400);

    try {
      switch (`${request.method} ${url.pathname}`) {
        case "GET /status": {
          // An expired code can't be used anymore: forget it so the app asks for a new one.
          if (pending && pending.expiresAt < Date.now()) pending = null;
          const resources: Record<string, boolean> = {};
          for (const name of Object.keys(RESOURCES) as Resource[]) resources[name] = !!(await accessToken(name));
          return json({ resources, pending }, origin);
        }
        case "POST /login":
          return json(await startLogin(resource ?? "graph"), origin);
        case "GET /token": {
          const token = await accessToken(resource ?? "graph");
          if (!token) return json({ error: "login_required" }, origin, 401);
          return json({ accessToken: token, expiresAt: accessTokens.get(resource ?? "graph")!.expiresAt }, origin);
        }
        case "POST /logout":
          refreshTokens = {};
          accessTokens.clear();
          pending = null;
          await save();
          return json({ ok: true }, origin);
        default:
          return json({ error: "not found" }, origin, 404);
      }
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, origin, 500);
    }
  },
});

console.log(`Auth proxy listening on http://127.0.0.1:${PROXY_PORT}`);
