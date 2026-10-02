import type { Row } from "@repo/tables/schema";

export type Filters = { search: string; options: Record<string, string[]> };
export const emptyFilters: Filters = { search: "", options: {} };

export type Sort = { column: string; direction: "asc" | "desc" } | null;

/** Next sort when clicking a column header: asc → desc → none. */
export const nextSort = (sort: Sort, column: string): Sort =>
  sort?.column !== column ? { column, direction: "asc" } : sort.direction === "asc" ? { column, direction: "desc" } : null;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const text = (value: unknown) => [value].flat().filter((v) => v !== null && v !== undefined).join(", ");

/** Option slicers (any selected value matches) + search in every column. */
export function applyFilters(rows: Row[], filters: Filters) {
  const search = filters.search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      Object.entries(filters.options).every(
        ([column, selected]) => !selected.length || [row[column]].flat().some((v) => selected.includes(String(v))),
      ) && (!search || Object.values(row).some((value) => text(value).toLowerCase().includes(search))),
  );
}

/** Sorts on one column; numbers numerically, text naturally, empty values last. */
export function applySort(rows: Row[], sort: Sort) {
  if (!sort) return rows;
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const [x, y] = [a[sort.column], b[sort.column]];
    const [emptyX, emptyY] = [text(x) === "", text(y) === ""];
    if (emptyX || emptyY) return Number(emptyX) - Number(emptyY);
    if (typeof x === "number" && typeof y === "number") return (x - y) * factor;
    return collator.compare(text(x), text(y)) * factor;
  });
}
