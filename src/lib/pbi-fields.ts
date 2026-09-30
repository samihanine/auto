import type { models } from "powerbi-client";

/** Fields are written "Table[Column]" or "[Measure]" (or "Table[Measure]"). */
export type Field = { table?: string; name: string };

export function parseField(value: string): Field {
  const match = value.trim().match(/^'?([^'[]*)'?\[(.+)\]$/);
  if (!match) return { name: value.trim() };
  return { table: match[1] || undefined, name: match[2] };
}

export const daxRef = ({ table, name }: Field) =>
  table ? `'${table.replace(/'/g, "''")}'[${name}]` : `[${name}]`;

/** Power BI target (column, measure, aggregated column, hierarchy level) → "Table[Name]" / "[Measure]". */
export function formatTarget(target: models.IBaseTarget | Record<string, unknown>): string {
  const t = target as Record<string, string>;
  if (t.measure) return `[${t.measure}]`;
  return `${t.table}[${t.column ?? t.hierarchyLevel ?? t.hierarchy ?? ""}]`;
}

export type SimpleFilter = {
  field: string;
  operator?: "In" | "NotIn" | "All";
  values?: (string | number | boolean)[];
  /** Non-basic Power BI filter kept as-is (advanced, top N, relative date…). */
  raw?: unknown;
};

export function fromPbiFilter(filter: models.IFilter): SimpleFilter {
  const f = filter as unknown as {
    target: Record<string, unknown>;
    operator?: string;
    values?: SimpleFilter["values"];
    filterType?: number;
  };
  const field = f.target ? formatTarget(f.target) : "";
  if (f.filterType === 1 && Array.isArray(f.values))
    return { field, operator: (f.operator as SimpleFilter["operator"]) ?? "In", values: f.values };
  return { field, raw: filter };
}

export function toPbiFilter(filter: SimpleFilter): models.IFilter {
  if (filter.raw) return filter.raw as models.IFilter;
  const { table, name } = parseField(filter.field);
  return {
    $schema: "http://powerbi.com/product/schema#basic",
    target: { table: table ?? "", column: name },
    operator: filter.operator ?? "In",
    values: filter.values ?? [],
    filterType: 1,
    requireSingleSelection: false,
  } as unknown as models.IFilter;
}

/** Parses a JSON filters cell; invalid content counts as no filter. */
export function parseFilters(value: unknown): SimpleFilter[] {
  try {
    const data = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(data) ? data.filter((f) => f && typeof f.field === "string") : [];
  } catch {
    return [];
  }
}

export function parseJson<T>(value: unknown, fallback: T): T {
  try {
    return value ? (JSON.parse(String(value)) as T) : fallback;
  } catch {
    return fallback;
  }
}
