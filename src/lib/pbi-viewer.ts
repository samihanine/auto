import type { pbi } from "./pbi-embed";
import type { SimpleFilter } from "./pbi-fields";
import { parseFilters, parseJson, toPbiFilter } from "./pbi-fields";
import type { Row } from "./schemas";

/**
 * Drives the embedded report from a reportViewer row: active page, page filters
 * (null = leave as is, [] = clear) and filters of given visuals.
 */
export async function applyViewerState(report: pbi.Report, row: Row) {
  const pages = await report.getPages();
  let page = pages.find((p) => p.isActive);
  const target = pages.find((p) => p.name === row.powerBiPageId);
  if (target && target.name !== page?.name) {
    await target.setActive();
    page = target;
  }
  if (!page) return;

  if (row.pageFilters !== null && row.pageFilters !== undefined && row.pageFilters !== "")
    await page.setFilters(parseFilters(row.pageFilters).map(toPbiFilter));

  const byVisual = parseJson<Record<string, SimpleFilter[]>>(row.visualFilters, {});
  if (!Object.keys(byVisual).length) return;
  const visuals = await page.getVisuals();
  for (const [id, filters] of Object.entries(byVisual)) {
    const visual = visuals.find((v) => v.name === id);
    if (visual) await visual.setFilters(parseFilters(filters).map(toPbiFilter));
  }
}
