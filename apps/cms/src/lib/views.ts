import { FEATURES } from "@repo/config";
import { useLocalState } from "@repo/storage/react";
import type { Filters, Sort } from "./filters";
import { emptyFilters } from "./filters";
import type { TableSchema } from "@repo/tables/schema";

/** A saved way of looking at a source: name, filters, sort and visible columns. */
export type View = {
  id: string;
  name: string;
  filters: Filters;
  sort: Sort;
  /** Visible field names; null = default (string and option fields). */
  columns: string[] | null;
};

const baseView = (): View => ({ id: "base", name: "All rows", filters: emptyFilters, sort: null, columns: null });

export const defaultColumns = (table: TableSchema) =>
  table.columns.filter((field) => field.dataType === "string" || field.dataType === "option").map((field) => field.name);

export const visibleColumns = (table: TableSchema, view: View) => {
  const names = view.columns ?? defaultColumns(table);
  return table.columns.filter((field) => names.includes(field.name));
};

/** Views of a source, stored in this browser. There is always at least the base view. */
export function useViews(sourceId: string) {
  const [saved, setViews] = useLocalState<View[]>(`cms:views:${sourceId}`, [baseView()]);
  const [activeId, setActiveId] = useLocalState(`cms:active-view:${sourceId}`, "base");
  // Saved views off: only the first (base) view, still remembering its filters.
  const views = FEATURES.savedViews ? saved : saved.slice(0, 1);
  const view = views.find((v) => v.id === activeId) ?? views[0];

  const update = (id: string, patch: Partial<View>) =>
    setViews((all) => all.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  return {
    /** Adding, renaming and deleting views is allowed. */
    editable: FEATURES.savedViews,
    views,
    view,
    select: setActiveId,
    /** Updates the active view (filters, sort, columns…). */
    change: (patch: Partial<View>) => update(view.id, patch),
    rename: (id: string, name: string) => update(id, { name: name.trim() || "Untitled view" }),
    /** New view starting from the active one. */
    add: () => {
      const created = { ...view, id: crypto.randomUUID(), name: `View ${views.length + 1}` };
      setViews((all) => [...all, created]);
      setActiveId(created.id);
    },
    remove: (id: string) => {
      if (views.length < 2) return;
      setViews((all) => all.filter((v) => v.id !== id));
      if (id === view.id) setActiveId(views.find((v) => v.id !== id)!.id);
    },
  };
}
