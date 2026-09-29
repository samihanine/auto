import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { Database } from "./crud-table";
import { resolveImage } from "./images";
import type { SettingsSchema } from "./schemas";
import { settingsSchema } from "./schemas";
import { storage } from "./storage";

const defaults = settingsSchema.parse({});

export function useSettings() {
  const client = useQueryClient();
  const { data = defaults } = useQuery({
    queryKey: ["settings"],
    queryFn: storage.settings.get,
  });
  const update = useCallback(
    async (patch: Partial<SettingsSchema>) =>
      client.setQueryData(["settings"], await storage.settings.update(patch)),
    [client],
  );
  return [data, update] as const;
}

export const useRows = (db: Database, table: string) =>
  useSyncExternalStore(db.subscribe, () => db.rows(table));

export const DatabaseContext = createContext<Database | null>(null);

export function useDatabase() {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error("useDatabase must be used inside DatabaseContext");
  return db;
}

/** Displayable URL for a stored image value (remote URL or workspace path). */
export function useImageUrl(value: string | null | undefined) {
  const db = useDatabase();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (value) void resolveImage(db.dir, value).then((next) => active && setUrl(next));
    return () => {
      active = false;
    };
  }, [db, value]);
  return url;
}
