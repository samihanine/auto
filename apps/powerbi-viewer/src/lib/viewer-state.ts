import { TIMING } from "@repo/config";
import { useQuery } from "@tanstack/react-query";
import type { ExcelRecord } from "@repo/microsoft-auth/excel";
import { ExcelTable } from "@repo/microsoft-auth/excel";
import type { pbi } from "./embed";
import type { SimpleFilter } from "./filters";
import { parseFilters, parseJson, toPbiFilter } from "./filters";

/** report_viewer Excel: one row per report, written by the assistant to drive the viewer. */
export const VIEWER_COLUMNS = ["id", "name", "report_id", "page_name", "page_filters", "visual_filters", "updated_at"].map(
  (name) => ({ name }),
);

const tables = new Map<string, Promise<ExcelTable>>();
export const viewerTable = (url: string) => {
  if (!tables.has(url))
    tables.set(
      url,
      ExcelTable.open(url, { name: "report_viewer", columns: VIEWER_COLUMNS }).catch((error: unknown) => {
        tables.delete(url);
        throw error;
      }),
    );
  return tables.get(url)!;
};

/** The report's viewer row (created when missing), polled to follow the assistant's changes. */
export function useViewerRow(url: string, reportId: string, reportName: string) {
  return useQuery({
    queryKey: ["viewer-row", url, reportId],
    enabled: !!url && !!reportId,
    refetchInterval: TIMING.viewerStateRefresh,
    queryFn: async () => {
      const excel = await viewerTable(url);
      const find = async () => (await excel.records()).records.find((r) => r.report_id === reportId);
      const row = await find();
      if (row) return row;
      await excel.insertRecords([{ name: reportName, report_id: reportId, updated_at: new Date().toISOString() }]);
      return (await find()) ?? null;
    },
  });
}

/** Page changed by the user: store it (and drop page filters meant for the previous page). */
export async function savePage(url: string, row: ExcelRecord, pageName: string) {
  if (row.page_name === pageName) return;
  await (await viewerTable(url)).updateRecords([
    { id: row.id, page_name: pageName, page_filters: null, updated_at: new Date().toISOString() },
  ]);
}

/** Applies a viewer row to the embedded report: page, page filters (null = untouched), visual filters. */
export async function applyViewerState(report: pbi.Report, row: ExcelRecord) {
  const pages = await report.getPages();
  let page = pages.find((p) => p.isActive);
  const target = pages.find((p) => p.name === row.page_name);
  if (target && target.name !== page?.name) {
    await target.setActive();
    page = target;
  }
  if (!page) return;
  if (row.page_filters !== null && row.page_filters !== "")
    await page.setFilters(parseFilters(row.page_filters).map(toPbiFilter));

  const byVisual = parseJson<Record<string, SimpleFilter[]>>(row.visual_filters, {});
  if (!Object.keys(byVisual).length) return;
  const visuals = await page.getVisuals();
  for (const [id, filters] of Object.entries(byVisual)) {
    const visual = visuals.find((v) => v.name === id);
    if (visual) await visual.setFilters(parseFilters(filters).map(toPbiFilter));
  }
}
