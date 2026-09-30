import type { Database } from "./crud-table";
import { executeQuery } from "./pbi-api";
import type { DatasetModel } from "./pbi-dataset";
import { datasetOf } from "./pbi-dataset";
import type { SimpleFilter } from "./pbi-fields";
import { daxRef, parseField, parseFilters } from "./pbi-fields";
import type { Row } from "./schemas";
import { reportTable } from "@/table/report";
import { reportPageTable } from "@/table/report-page";
import { reportVisualTable } from "@/table/report-visual";

const MAX_ROWS = 500;
const list = (value: unknown) => [value].flat().filter((v): v is string => typeof v === "string" && !!v.trim());

const literal = (value: string | number | boolean) =>
  typeof value === "number" ? String(value) : typeof value === "boolean" ? `${value ? "TRUE" : "FALSE"}()` : `"${String(value).replace(/"/g, '""')}"`;

function isMeasure(field: string, model?: DatasetModel) {
  const { table, name } = parseField(field);
  if (!table) return true;
  return !!model?.tables.some((t) => t.name === table && t.measures.some((m) => m.name === name));
}

/** Result column of a field: column name, or the value alias (= measure / column name). */
export const resultKey = (field: string) => parseField(field).name;

function filterArg({ field, operator, values }: SimpleFilter) {
  const column = daxRef(parseField(field));
  const set = `{${(values ?? []).map(literal).join(", ")}}`;
  return operator === "NotIn"
    ? `KEEPFILTERS(FILTER(ALL(${column}), NOT ${column} IN ${set}))`
    : `KEEPFILTERS(TREATAS(${set}, ${column}))`;
}

/**
 * DAX of a visual from its fields: category/series columns are grouped, values are measures
 * (or summed columns); report + page + visual filters apply. Null for visuals without data.
 */
export function visualDax(visual: Row, model?: DatasetModel, filters: SimpleFilter[] = []) {
  const groups = [...list(visual.category), ...list(visual.series)].map((f) => daxRef(parseField(f)));
  const values = list(visual.values).map((field) => {
    const ref = daxRef(parseField(field));
    const expression = isMeasure(field, model) ? ref : `SUM(${ref})`;
    return `"${resultKey(field)}", ${expression}`;
  });
  if (!groups.length && !values.length) return null;

  const args = filters.filter((f) => !f.raw && f.values?.length && f.operator !== "All").map(filterArg);
  if (!groups.length) {
    const row = `ROW(${values.join(", ")})`;
    return `EVALUATE ${args.length ? `CALCULATETABLE(${row}, ${args.join(", ")})` : row}`;
  }
  const table = `SUMMARIZECOLUMNS(${[...groups, ...args, ...values].join(", ")})`;
  return `EVALUATE TOPN(${MAX_ROWS}, ${table}, ${groups[0]}, ASC)\nORDER BY ${groups[0]}`;
}

/** Report, page and visual filters that apply to a visual. */
export function visualFilters(db: Database, visual: Row) {
  const report = db.rows(reportTable.name).find((r) => r.powerBiReportId === visual.powerBiReportId);
  const page = db.rows(reportPageTable.name).find((p) => p.powerBiPageId === visual.powerBiPageId);
  return [report?.filters, page?.filters, visual.filters].flatMap(parseFilters);
}

/** Everything needed to query a visual: dataset ref and its DAX. */
export function visualQuery(db: Database, visual: Row, fallbackDatasetId?: string) {
  const report = db.rows(reportTable.name).find((r) => r.powerBiReportId === visual.powerBiReportId);
  const datasetId = String(report?.powerBiDatasetId ?? fallbackDatasetId ?? "");
  if (!datasetId) return null;
  const { ref, model } = datasetOf(db, datasetId);
  const dax = visualDax(visual, model, visualFilters(db, visual));
  return dax ? { ref, dax } : null;
}

/** Short text version of a result for the agent: row count + first rows as JSON lines. */
export const summarizeRows = (rows: Record<string, unknown>[]) =>
  [`${rows.length} row${rows.length === 1 ? "" : "s"}`, ...rows.slice(0, 20).map((row) => JSON.stringify(row))].join("\n");

/** Recomputes the `dax` and `data` columns of visuals (after the agent changed them). */
export async function refreshVisualData(db: Database, visuals: Row[], fallbackDatasetId?: string) {
  const updates = await Promise.all(
    visuals.map(async (visual) => {
      const query = visualQuery(db, visual, fallbackDatasetId);
      if (!query) return { ...visual, dax: null, data: null };
      const data = await executeQuery(query.ref, query.dax).then(summarizeRows, (error: Error) => `Error: ${error.message}`);
      return { ...visual, dax: query.dax, data };
    }),
  );
  if (updates.length) await db.update(reportVisualTable.name, updates);
}
