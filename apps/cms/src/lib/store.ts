import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { z } from "zod";
import { collection, value } from "@repo/storage";

/** An Excel file managed with one of the table structures. */
export const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  structure: z.string(),
});
export type Source = z.infer<typeof sourceSchema>;

const settingsSchema = z.object({
  activeSource: z.string().default(""),
  /** OneDrive / SharePoint folder where uploaded images go (empty = paste links only). */
  imagesFolder: z.string().default(""),
});
type Settings = z.infer<typeof settingsSchema>;

export const store = {
  sources: collection("cms:sources", sourceSchema),
  settings: value("cms:settings", settingsSchema),
};

const defaults = settingsSchema.parse({});

export function useSettings() {
  const client = useQueryClient();
  const { data = defaults } = useQuery({ queryKey: ["settings"], queryFn: store.settings.get });
  const update = useCallback(
    async (patch: Partial<Settings>) => client.setQueryData(["settings"], await store.settings.update(patch)),
    [client],
  );
  return [data, update] as const;
}

export function useSources() {
  const client = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["sources"], queryFn: store.sources.list });
  const refresh = () => client.invalidateQueries({ queryKey: ["sources"] });
  return {
    sources: data,
    add: async (source: Omit<Source, "id">) => {
      const created = await store.sources.put({ ...source, id: crypto.randomUUID() });
      await refresh();
      return created;
    },
    remove: async (id: string) => {
      await store.sources.remove(id);
      await refresh();
    },
  };
}
