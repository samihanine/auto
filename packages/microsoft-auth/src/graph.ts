import { getToken } from "./client";

export const GRAPH = "https://graph.microsoft.com/v1.0";

export type DriveItem = {
  id: string;
  name: string;
  webUrl: string;
  parentReference: { driveId: string };
  folder?: object;
  file?: { mimeType: string };
};

export class GraphError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Calls Microsoft Graph with the user's token; throws a GraphError with Graph's message and code. */
export async function graphFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path.startsWith("http") ? path : `${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getToken("graph")}`,
      ...(typeof init.body === "string" && { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const where = `${init.method ?? "GET"} ${decodeURIComponent(path.split("?")[0].split("/workbook")[1] ?? path)}`;
    throw new GraphError(
      `${data?.error?.message ?? `Microsoft Graph error ${response.status}`} (${where})`,
      String(data?.error?.innerError?.code ?? data?.error?.code ?? response.status),
    );
  }
  return data as T;
}

/** Encodes a sharing / document link for the /shares endpoint. */
export const shareId = (url: string) =>
  `u!${btoa(String.fromCharCode(...new TextEncoder().encode(url.trim())))
    .replace(/=+$/, "")
    .replace(/\//g, "_")
    .replace(/\+/g, "-")}`;

/** OneDrive / SharePoint link (sharing link or address bar URL) → drive item. */
export const resolveLink = (url: string) => graphFetch<DriveItem>(`/shares/${shareId(url)}/driveItem`);
