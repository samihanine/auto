import { useSyncExternalStore } from "react";

/**
 * Rows shared with the agent. Every row is shared by default:
 * we only remember the ones the user unchecked, per table.
 */
const excluded = new Map<string, ReadonlySet<number>>();
const listeners = new Set<() => void>();
const empty: ReadonlySet<number> = new Set();

const set = (table: string, ids: ReadonlySet<number>) => {
  excluded.set(table, ids);
  listeners.forEach((listener) => listener());
};

export const selection = {
  isShared: (table: string, id: number) => !excluded.get(table)?.has(id),
  toggle(table: string, id: number) {
    const next = new Set(excluded.get(table));
    if (!next.delete(id)) next.add(id);
    set(table, next);
  },
  /** Share or unshare several rows at once (header checkbox). */
  setMany(table: string, ids: number[], shared: boolean) {
    const next = new Set(excluded.get(table));
    ids.forEach((id) => (shared ? next.delete(id) : next.add(id)));
    set(table, next);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

/** Ids the user unchecked in a table (stable reference between changes). */
export const useExcluded = (table: string) =>
  useSyncExternalStore(selection.subscribe, () => excluded.get(table) ?? empty);
