import { PBI_API } from "./constants";
import { getPbiToken } from "./pbi-auth";

export type DatasetRef = { datasetId: string; groupId?: string };
export type ReportRef = { reportId: string; groupId?: string };

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Group id from "/groups/<id>/…" or "groupId=<id>" ("me" = My workspace → none). */
function groupOf(url: string) {
  const id = url.match(/groups\/([^/?#]+)/i)?.[1] ?? url.match(/[?&]groupId=([^&#]+)/i)?.[1];
  return id && GUID.test(id) ? id : undefined;
}

/**
 * Accepts dataset / semantic model links (with or without a workspace) or a bare id:
 * …/groups/<g>/datasets/<id>/details · …/groups/me/semanticmodels/<id> · …/datahub/datasets/<id> · <id>
 */
export function parseDatasetUrl(url: string): DatasetRef {
  const id = url.match(/(?:datasets|semanticmodels|models)\/([0-9a-f-]{36})/i)?.[1] ?? url.match(GUID)?.[0];
  if (!id) throw new Error("No dataset id found in this link");
  return { datasetId: id.toLowerCase(), groupId: groupOf(url) };
}

/** Accepts report links (…/groups/<g>/reports/<id>/…) and embed links (reportEmbed?reportId=…). */
export function parseReportUrl(url: string): ReportRef {
  const id = url.match(/reports\/([0-9a-f-]{36})/i)?.[1] ?? url.match(/reportId=([0-9a-f-]{36})/i)?.[1];
  if (!id) throw new Error("No report id found in this link");
  return { reportId: id.toLowerCase(), groupId: groupOf(url) };
}

const scope = (groupId?: string) => (groupId ? `${PBI_API}/groups/${groupId}` : PBI_API);

export async function pbiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await getPbiToken()}`, "Content-Type": "application/json", ...init.headers },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok)
    throw new Error(data.error?.pbi?.error?.details?.[0]?.detail?.value ?? data.error?.message ?? `Power BI error ${response.status}`);
  return data as T;
}

type QueryResponse = {
  results: { tables?: { rows: Record<string, unknown>[] }[]; error?: { message: string } }[];
  error?: { message: string };
};

/**
 * Runs a DAX query with executeQueries only — works with Build/Read permission on the dataset,
 * without being a member of its workspace.
 */
export async function executeQuery(ref: DatasetRef, dax: string) {
  const data = await pbiFetch<QueryResponse>(`${scope(ref.groupId)}/datasets/${ref.datasetId}/executeQueries`, {
    method: "POST",
    body: JSON.stringify({ queries: [{ query: dax }], serializerSettings: { includeNulls: true } }),
  });
  const result = data.results?.[0];
  if (result?.error) throw new Error(result.error.message);
  return (result?.tables?.[0]?.rows ?? []).map(cleanKeys);
}

/** "Table[Column]" / "[Measure]" result keys → "Column" / "Measure". */
const cleanKeys = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/^.*\[(.*)\]$/, "$1"), value]));

/** Report metadata (name, dataset). Needs access to the report through the REST API. */
export const getReport = (ref: ReportRef) =>
  pbiFetch<{ id: string; name: string; datasetId: string; embedUrl: string }>(
    `${scope(ref.groupId)}/reports/${ref.reportId}`,
  );

export const embedUrl = (ref: ReportRef) =>
  `https://app.powerbi.com/reportEmbed?reportId=${ref.reportId}${ref.groupId ? `&groupId=${ref.groupId}` : ""}`;
