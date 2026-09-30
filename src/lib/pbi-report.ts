import type { Database } from "./crud-table";
import type { ReportRef } from "./pbi-api";
import { embedUrl, getReport, parseDatasetUrl, parseReportUrl } from "./pbi-api";
import { importDataset } from "./pbi-dataset";
import { embedReport, pbi, resetEmbed } from "./pbi-embed";
import { formatTarget, fromPbiFilter } from "./pbi-fields";
import { datasetTable } from "@/table/dataset";
import { reportTable } from "@/table/report";
import { reportPageTable } from "@/table/report-page";
import { reportVisualTable } from "@/table/report-visual";

type Visual = pbi.VisualDescriptor;

const SERIES_ROLES = ["Series", "Legend", "Columns", "ColorSaturation"];
/** Formatting read through the authoring API: [key, object, property]. */
const FORMAT_PROPS = [
  ["titleText", "title", "titleText"],
  ["titleColor", "title", "fontColor"],
  ["fontSize", "title", "fontSize"],
  ["background", "background", "color"],
  ["color", "dataPoint", "defaultColor"],
  ["showLegend", "legend", "visible"],
  ["showDataLabels", "labels", "visible"],
] as const;

const json = (value: unknown) => JSON.stringify(value ?? null);
const colorOf = (value: unknown) =>
  (value as { solid?: { color?: string } })?.solid?.color ?? value;

/**
 * Imports a report from its link: pages, visuals (type, position, fields by role, filters,
 * formatting, summarized data), then its dataset when it is not known yet.
 */
export async function importReport(
  db: Database,
  { url, name, datasetUrl }: { url: string; name?: string; datasetUrl?: string },
  log: (message: string) => void,
) {
  const ref = parseReportUrl(url);
  log("Reading report metadata…");
  const meta = await getReport(ref).catch(() => null);
  const datasetId = datasetUrl ? parseDatasetUrl(datasetUrl).datasetId : meta?.datasetId;
  const reportName = name?.trim() || meta?.name || `Report ${ref.reportId.slice(0, 8)}`;

  if (datasetId && !db.rows(datasetTable.name).some((row) => row.powerBiDatasetId === datasetId)) {
    log("Importing the dataset…");
    const link = datasetUrl || `https://app.powerbi.com/groups/${ref.groupId ?? "me"}/datasets/${datasetId}`;
    await importDataset(db, link).catch((error) => log(`Dataset skipped: ${error.message}`));
  }

  const element = document.createElement("div");
  element.style.cssText = "position:fixed;left:-10000px;top:0;width:1280px;height:720px;";
  document.body.append(element);
  try {
    log("Loading the report…");
    const report = await load(element, ref);
    const editable = await report.switchMode(pbi.models.ViewMode.Edit).then(() => true, () => false);
    log(editable ? "Edit mode: reading fields and formatting." : "View mode: fields/formatting may be partial.");

    await db.upsert(reportTable.name, [
      {
        powerBiReportId: ref.reportId,
        name: reportName,
        powerBiDatasetId: datasetId ?? null,
        powerBiGroupId: ref.groupId ?? null,
        source: "Imported",
        embedUrl: embedUrl(ref),
        filters: json((await report.getFilters().catch(() => [])).map(fromPbiFilter)),
      },
    ]);

    const pages = await report.getPages();
    for (const [order, page] of pages.entries()) {
      log(`Page ${order + 1}/${pages.length}: ${page.displayName}`);
      await page.setActive().catch(() => undefined);
      await db.upsert(reportPageTable.name, [
        {
          powerBiPageId: page.name,
          name: `${reportName} · ${page.displayName}`,
          powerBiReportId: ref.reportId,
          displayName: page.displayName,
          order,
          width: page.defaultSize?.width ?? 1280,
          height: page.defaultSize?.height ?? 720,
          hidden: page.visibility === 1,
          filters: json((await page.getFilters().catch(() => [])).map(fromPbiFilter)),
        },
      ]);
      const visuals = await page.getVisuals();
      const rows = [];
      for (const visual of visuals) rows.push(await readVisual(visual, page.displayName, ref));
      if (rows.length) await db.upsert(reportVisualTable.name, rows);
    }
    log(`Done: ${pages.length} pages imported.`);
  } finally {
    resetEmbed(element);
    element.remove();
  }
}

/** Tries an editable embed first (authoring API), falls back to read-only. */
const load = (element: HTMLElement, ref: ReportRef) =>
  embedReport(element, ref, { editable: true }).catch(() => embedReport(element, ref));

async function readVisual(visual: Visual, pageName: string, ref: ReportRef) {
  const { layout } = visual;
  const fields: Record<string, string[]> = {};
  const category: string[] = [];
  const series: string[] = [];
  const values: string[] = [];

  const capabilities = await visual.getCapabilities().catch(() => null);
  for (const role of capabilities?.dataRoles ?? []) {
    const targets = await visual.getDataFields(role.name).catch(() => []);
    fields[role.name] = targets.map(formatTarget);
    for (const target of targets as unknown as Record<string, unknown>[]) {
      const field = formatTarget(target);
      if (target.measure || target.aggregationFunction) values.push(field);
      else if (SERIES_ROLES.includes(role.name)) series.push(field);
      else category.push(field);
    }
  }

  const format: Record<string, unknown> = {};
  for (const [key, objectName, propertyName] of FORMAT_PROPS) {
    const property = await visual.getProperty({ objectName, propertyName }).catch(() => null);
    if (property?.value !== undefined && property.value !== null) format[key] = colorOf(property.value);
  }

  const data = await visual
    .exportData(pbi.models.ExportDataType.Summarized, 30)
    .then((result) => result.data.slice(0, 4000))
    .catch(() => null);

  return {
    powerBiVisualId: visual.name,
    name: `${pageName} · ${visual.title || visual.type} · ${visual.name.slice(0, 6)}`,
    powerBiPageId: visual.page.name,
    powerBiReportId: ref.reportId,
    title: visual.title ?? null,
    type: visual.type,
    x: Math.round(layout?.x ?? 0),
    y: Math.round(layout?.y ?? 0),
    z: layout?.z ?? 0,
    width: Math.round(layout?.width ?? 0),
    height: Math.round(layout?.height ?? 0),
    hidden: layout?.displayState?.mode === 1,
    category: [...new Set(category)],
    series: [...new Set(series)],
    values: [...new Set(values)],
    fields: json(fields),
    filters: json((await visual.getFilters().catch(() => [])).map(fromPbiFilter)),
    format: json(format),
    data,
  };
}
