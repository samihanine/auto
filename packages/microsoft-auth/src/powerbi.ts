import { getToken } from "./client";

export const PBI_API = "https://api.powerbi.com/v1.0/myorg";

export type DatasetRef = { datasetId: string; groupId?: string };
export type ReportRef = { reportId: string; groupId?: string };

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Workspace id from "/groups/<id>/…" or "groupId=<id>" ("me" = My workspace → none). */
function groupOf(url: string) {
  const id = url.match(/groups\/([^/?#]+)/i)?.[1] ?? url.match(/[?&]groupId=([^&#]+)/i)?.[1];
  return id && GUID.test(id) ? id.toLowerCase() : undefined;
}

/** Dataset / semantic model link (with or without workspace) or bare id. */
export function parseDatasetUrl(url: string): DatasetRef {
  const id = url.match(/(?:datasets|semanticmodels|models)\/([0-9a-f-]{36})/i)?.[1] ?? url.match(GUID)?.[0];
  if (!id) throw new Error("No dataset id found in this link");
  return { datasetId: id.toLowerCase(), groupId: groupOf(url) };
}

/** Report link (…/reports/<id>/<page>?…&visual=<id>) or embed link (reportEmbed?reportId=…&pageName=…). */
export function parseReportUrl(url: string) {
  const reportId = url.match(/reports\/([0-9a-f-]{36})/i)?.[1] ?? url.match(/reportId=([0-9a-f-]{36})/i)?.[1];
  if (!reportId) throw new Error("No report id found in this link");
  return {
    reportId: reportId.toLowerCase(),
    groupId: groupOf(url),
    pageName: url.match(/reports\/[0-9a-f-]{36}\/([^/?#]+)/i)?.[1] ?? url.match(/[?&]pageName=([^&#]+)/i)?.[1],
    visualId: url.match(/[?&]visual=([^&#]+)/i)?.[1],
  };
}

export const embedUrl = (ref: ReportRef) =>
  `https://app.powerbi.com/reportEmbed?reportId=${ref.reportId}${ref.groupId ? `&groupId=${ref.groupId}` : ""}`;

const scope = (groupId?: string) => (groupId ? `${PBI_API}/groups/${groupId}` : PBI_API);

export async function pbiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await getToken("powerbi")}`, "Content-Type": "application/json", ...init.headers },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok)
    throw new Error(data.error?.pbi?.error?.details?.[0]?.detail?.value ?? data.error?.message ?? `Power BI error ${response.status}`);
  return data as T;
}

/** Report metadata (name, dataset) — needs access to the report through the REST API. */
export const getReport = (ref: ReportRef) =>
  pbiFetch<{ id: string; name: string; datasetId: string }>(`${scope(ref.groupId)}/reports/${ref.reportId}`);

type QueryResponse = { results: { tables?: { rows: Record<string, unknown>[] }[]; error?: { message: string } }[] };

/** "Table[Column]" / "[Measure]" result keys → "Column" / "Measure". */
const cleanKeys = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/^.*\[(.*)\]$/, "$1"), value]));

/** DAX query with executeQueries only: Build/Read permission on the dataset is enough. */
export async function executeQuery(ref: DatasetRef, dax: string) {
  const data = await pbiFetch<QueryResponse>(`${scope(ref.groupId)}/datasets/${ref.datasetId}/executeQueries`, {
    method: "POST",
    body: JSON.stringify({ queries: [{ query: dax }], serializerSettings: { includeNulls: true } }),
  });
  const result = data.results[0];
  if (result?.error) throw new Error(result.error.message);
  return (result?.tables?.[0]?.rows ?? []).map(cleanKeys);
}

export type DatasetModel = {
  tables: {
    name: string;
    description?: string;
    columns: { name: string; dataType: string; description?: string }[];
    measures: { name: string; expression: string; formatString?: string; description?: string }[];
  }[];
  relationships: { from: string; to: string; active: boolean }[];
};

/** Model read with INFO.VIEW.* DAX functions (no metadata API, no workspace membership needed). */
export async function readModel(ref: DatasetRef): Promise<DatasetModel> {
  const query = (fn: string) => executeQuery(ref, `EVALUATE ${fn}()`);
  const [tables, columns, measures, relationships] = await Promise.all([
    query("INFO.VIEW.TABLES"),
    query("INFO.VIEW.COLUMNS"),
    query("INFO.VIEW.MEASURES"),
    query("INFO.VIEW.RELATIONSHIPS").catch(() => []),
  ]);
  const visible = (row: Record<string, unknown>) => row.IsHidden !== true;
  const text = (value: unknown) => (value === null || value === undefined ? undefined : String(value));
  return {
    tables: tables.filter(visible).map((table) => ({
      name: String(table.Name),
      description: text(table.Description),
      columns: columns
        .filter((c) => c.Table === table.Name && visible(c) && !String(c.Name).startsWith("RowNumber-"))
        .map((c) => ({ name: String(c.Name), dataType: String(c.DataType ?? ""), description: text(c.Description) })),
      measures: measures
        .filter((m) => m.Table === table.Name && visible(m))
        .map((m) => ({ name: String(m.Name), expression: String(m.Expression ?? ""), formatString: text(m.FormatString), description: text(m.Description) })),
    })),
    relationships: relationships.map((r) => ({
      from: `${String(r.FromTable)}[${String(r.FromColumn)}]`,
      to: `${String(r.ToTable)}[${String(r.ToColumn)}]`,
      active: r.IsActive !== false,
    })),
  };
}
