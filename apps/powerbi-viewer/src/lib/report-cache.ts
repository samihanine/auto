import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseDatasetUrl, parseReportUrl } from "@repo/microsoft-auth/powerbi";
import type { ReportInfo } from "./report-info";
import { extractReportInfo } from "./report-info";
import type { SavedReport } from "./store";

const cacheKey = (reportId: string) => `viewer:info:${reportId}`;

const readCache = (reportId: string): ReportInfo | null => {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(reportId)) ?? "null") as ReportInfo | null;
  } catch {
    return null;
  }
};

/** Extracted report info, cached in localStorage (re-extract with `refresh`). */
export function useReportInfo(report: SavedReport | undefined, log: (step: string) => void) {
  const client = useQueryClient();
  const ref = report ? parseReportUrl(report.url) : null;
  const query = useQuery({
    queryKey: ["report-info", ref?.reportId],
    enabled: !!ref,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const cached = readCache(ref!.reportId);
      if (cached) return cached;
      const datasetId = report?.datasetUrl ? parseDatasetUrl(report.datasetUrl).datasetId : undefined;
      const info = await extractReportInfo(ref!, datasetId, log);
      try {
        localStorage.setItem(cacheKey(ref!.reportId), JSON.stringify(info));
      } catch {
        // too big for localStorage: kept in memory for this session
      }
      return info;
    },
  });
  const refresh = async () => {
    if (!ref) return;
    localStorage.removeItem(cacheKey(ref.reportId));
    await client.invalidateQueries({ queryKey: ["report-info", ref.reportId] });
  };
  return { ...query, ref, refresh };
}
