import type { models } from "powerbi-client";

/** Filters in a simple form: {"field":"Table[Column]","operator":"In"|"NotIn","values":[…]}. */
export type SimpleFilter = {
  field: string;
  operator?: "In" | "NotIn" | "All";
  values?: (string | number | boolean)[];
  /** Non-basic Power BI filter kept as-is (advanced, top N, relative date…). */
  raw?: unknown;
};

const parseField = (value: string) => {
  const match = value.trim().match(/^'?([^'[]*)'?\[(.+)\]$/);
  return match ? { table: match[1], column: match[2] } : { table: "", column: value.trim() };
};

/** Power BI target → "Table[Column]" / "[Measure]". */
export function formatTarget(target: Record<string, unknown>) {
  if (target.measure) return `[${String(target.measure)}]`;
  return `${String(target.table)}[${String(target.column ?? target.hierarchyLevel ?? target.hierarchy ?? "")}]`;
}

export function fromPbiFilter(filter: models.IFilter): SimpleFilter {
  const f = filter as unknown as { target?: Record<string, unknown>; operator?: string; values?: SimpleFilter["values"]; filterType?: number };
  const field = f.target ? formatTarget(f.target) : "";
  if (f.filterType === 1 && Array.isArray(f.values))
    return { field, operator: (f.operator as SimpleFilter["operator"]) ?? "In", values: f.values };
  return { field, raw: filter };
}

export function toPbiFilter(filter: SimpleFilter): models.IFilter {
  if (filter.raw) return filter.raw as models.IFilter;
  const { table, column } = parseField(filter.field);
  return {
    $schema: "http://powerbi.com/product/schema#basic",
    target: { table, column },
    operator: filter.operator ?? "In",
    values: filter.values ?? [],
    filterType: 1,
    requireSingleSelection: false,
  } as unknown as models.IFilter;
}

/** JSON cell → filters (invalid content = no filter). */
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
