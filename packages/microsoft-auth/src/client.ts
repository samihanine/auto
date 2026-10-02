import type { Resource } from "./config";
import { PROXY_PORT } from "./config";

export const PROXY_URL =
  (import.meta.env.VITE_AUTH_PROXY_URL as string | undefined) ?? `http://127.0.0.1:${PROXY_PORT}`;

export class LoginRequiredError extends Error {
  constructor(readonly resource: Resource) {
    super(`Sign-in required for ${resource}`);
  }
}

export type AuthStatus = {
  resources: Record<Resource, boolean>;
  pending: { resource: Resource; userCode: string; verificationUri: string; expiresAt: number; error?: string } | null;
};

const unreachable = () =>
  new Error("The auth proxy is not running — start it with `bun run auth-proxy`.");

async function proxy<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${PROXY_URL}${path}`, init).catch(() => {
    throw unreachable();
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `Auth proxy error ${response.status}`);
  return data as T;
}

const cache = new Map<Resource, { token: string; expiresAt: number }>();

/** Access token for Graph or Power BI, cached until shortly before it expires. */
export async function getToken(resource: Resource) {
  const cached = cache.get(resource);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const response = await fetch(`${PROXY_URL}/token?resource=${resource}`).catch(() => {
    throw unreachable();
  });
  if (response.status === 401) throw new LoginRequiredError(resource);
  const data = (await response.json()) as { accessToken: string; expiresAt: number; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Could not get a token");
  cache.set(resource, { token: data.accessToken, expiresAt: data.expiresAt });
  return data.accessToken;
}

export const getStatus = () => proxy<AuthStatus>("/status");
export const startLogin = (resource: Resource) =>
  proxy<AuthStatus["pending"]>(`/login?resource=${resource}`, { method: "POST" });
export const logout = async () => {
  cache.clear();
  await proxy("/logout", { method: "POST" });
};
