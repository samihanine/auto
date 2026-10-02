import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { z } from "zod";
import { value } from "@repo/storage";

export const reportSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  /** Optional dataset link, when the report metadata can't be read. */
  datasetUrl: z.string().optional(),
});
export type SavedReport = z.infer<typeof reportSchema>;

const settingsSchema = z.object({
  reports: z.array(reportSchema).default([]),
  activeReport: z.string().default(""),
  /** Excel the assistant writes to drive the report (page, filters). */
  viewerExcel: z.string().default(""),
  guideExcel: z.string().default(""),
  dataExcel: z.string().default(""),
});
export type Settings = z.infer<typeof settingsSchema>;

const settings = value("viewer:settings", settingsSchema);
const defaults = settingsSchema.parse({});

export function useSettings() {
  const client = useQueryClient();
  const { data = defaults } = useQuery({ queryKey: ["settings"], queryFn: settings.get });
  const update = useCallback(
    async (patch: Partial<Settings>) => client.setQueryData(["settings"], await settings.update(patch)),
    [client],
  );
  return [data, update] as const;
}
