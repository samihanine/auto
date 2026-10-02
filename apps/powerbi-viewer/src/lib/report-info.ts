import type { DatasetModel, ReportRef } from "@repo/microsoft-auth/powerbi";
import { getReport, readModel } from "@repo/microsoft-auth/powerbi";
import type { SimpleFilter } from "./filters";
import { formatTarget, fromPbiFilter } from "./filters";
import { embedReport, pbi, resetEmbed } from "./embed";

export type VisualInfo = {
  id: string;
  title?: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hidden: boolean;
  /** Fields by Power BI data role ("Category": ["Geo[Region]"], "Y": ["[Total Sales]"]…). */
  fields: Record<string, string[]>;
  filters: SimpleFilter[];
  format: Record<string, unknown>;
  /** Summarized data exported from the visual (CSV, truncated). */
  data?: string;
};

export type PageInfo = {
  name: string;
  displayName: string;
  order: number;
  width: number;
  height: number;
  hidden: boolean;
  filters: SimpleFilter[];
  visuals: VisualInfo[];
};

export type ReportInfo = {
  reportId: string;
  name?: string;
  datasetId?: string;
  filters: SimpleFilter[];
  pages: PageInfo[];
  model?: DatasetModel;
  extractedAt: string;
};

/** Formatting read through the authoring API: [key, object, property]. */
const FORMAT_PROPS = [
  ["titleText", "title", "titleText"],
  ["titleColor", "title", "fontColor"],
  ["background", "background", "color"],
  ["color", "dataPoint", "defaultColor"],
  ["showLegend", "legend", "visible"],
  ["showDataLabels", "labels", "visible"],
] as const;

const DATA_LIMIT = 1500;

/**
 * Reads everything the APIs expose about a report: metadata (when allowed), pages, visuals
 * (type, position, fields by role, formatting, filters, summarized data) and the dataset model.
 * Uses a hidden editable embed so the authoring API (fields, formatting) works when permitted.
 */
export async function extractReportInfo(ref: ReportRef, datasetId?: string, log: (step: string) => void = () => {}) {
  log("Reading report metadata…");
  const meta = await getReport(ref).catch(() => null);
  datasetId ??= meta?.datasetId;

  const element = document.createElement("div");
  element.style.cssText = "position:fixed;left:-10000px;top:0;width:1280px;height:720px;";
  document.body.append(element);
  try {
    log("Loading the report…");
    const report = await embedReport(element, ref, { editable: true }).catch(() => embedReport(element, ref));
    await report.switchMode(pbi.models.ViewMode.Edit).catch(() => undefined);

    const pages: PageInfo[] = [];
    for (const [order, page] of (await report.getPages()).entries()) {
      log(`Page ${order + 1}: ${page.displayName}`);
      await page.setActive().catch(() => undefined);
      const visuals: VisualInfo[] = [];
      for (const visual of await page.getVisuals()) visuals.push(await readVisual(visual));
      pages.push({
        name: page.name,
        displayName: page.displayName,
        order,
        width: page.defaultSize?.width ?? 1280,
        height: page.defaultSize?.height ?? 720,
        hidden: page.visibility === 1,
        filters: (await page.getFilters().catch(() => [])).map(fromPbiFilter),
        visuals,
      });
    }

    log("Reading the dataset model…");
    const model = datasetId ? await readModel({ datasetId, groupId: ref.groupId }).catch(() => undefined) : undefined;
    return {
      reportId: ref.reportId,
      name: meta?.name,
      datasetId,
      filters: (await report.getFilters().catch(() => [])).map(fromPbiFilter),
      pages,
      model,
      extractedAt: new Date().toISOString(),
    } satisfies ReportInfo;
  } finally {
    resetEmbed(element);
    element.remove();
  }
}

async function readVisual(visual: pbi.VisualDescriptor): Promise<VisualInfo> {
  const fields: Record<string, string[]> = {};
  const capabilities = await visual.getCapabilities().catch(() => null);
  for (const role of capabilities?.dataRoles ?? [])
    fields[role.name] = (await visual.getDataFields(role.name).catch(() => [])).map((t) =>
      formatTarget(t as unknown as Record<string, unknown>),
    );

  const format: Record<string, unknown> = {};
  for (const [key, objectName, propertyName] of FORMAT_PROPS) {
    const property = await visual.getProperty({ objectName, propertyName }).catch(() => null);
    const value = (property?.value as { solid?: { color?: string } } | undefined)?.solid?.color ?? property?.value;
    if (value !== undefined && value !== null) format[key] = value;
  }

  const { layout } = visual;
  return {
    id: visual.name,
    title: visual.title,
    type: visual.type,
    x: Math.round(layout.x ?? 0),
    y: Math.round(layout.y ?? 0),
    width: Math.round(layout.width ?? 0),
    height: Math.round(layout.height ?? 0),
    hidden: layout.displayState?.mode === 1,
    fields,
    filters: (await visual.getFilters().catch(() => [])).map(fromPbiFilter),
    format,
    data: await visual
      .exportData(pbi.models.ExportDataType.Summarized, 30)
      .then((result) => result.data.slice(0, DATA_LIMIT))
      .catch(() => undefined),
  };
}
