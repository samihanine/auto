import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import type { Database } from "./crud-table";
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
