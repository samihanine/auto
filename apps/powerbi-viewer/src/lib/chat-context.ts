import type { ExcelRecord } from "@repo/microsoft-auth/excel";
import type { ChatParams } from "@repo/ui/components/chat-frame";
import { pagesOfRow, visualIdsOfRow } from "./linked";
import type { ReportInfo } from "./report-info";
import type { Settings } from "./store";

const PROMPT = `You guide the user through the Power BI report shown next to you.
You control the report ONLY through the report_viewer excel, with updateRows on the row given in <context> (send its id + the fields to change, and set "updated_at" to the current ISO time):
- Change page: "page_name" = the page name (id) of a page of the report.
- Filter the page: "page_filters" = JSON text [{"field":"Table[Column]","operator":"In","values":["France"]}]; "[]" clears them.
- Filter visuals: "visual_filters" = JSON text {"<visual id>":[{"field":…,"operator":"In","values":[…]}]}.
Use real fields of the report (visual fields, filters) or of the dataset model. Explain visuals from their type, fields and data, and from the guide entries and data definitions given in <context> (matched by page name and visual id).
For exact numbers use runDax (aggregated queries) rather than guessing. When you change the view, say what you changed in one sentence.`;

/** Report structure without the noisy parts, for the assistant's context. */
const compactInfo = (info: ReportInfo, pageName?: string) => ({
  report: { id: info.reportId, name: info.name, datasetId: info.datasetId, filters: info.filters },
  currentPage: pageName,
  pages: info.pages.map((page) => ({
    ...page,
    visuals: page.visuals.map(({ data, ...visual }) => ({ ...visual, data: page.name === pageName ? data : undefined })),
  })),
  datasetModel: info.model,
});

/** Entry for the context: title, text, page and visual ids it is linked to. */
const entry = (textColumn: string) => (row: ExcelRecord) => ({
  title: row.name,
  text: row[textColumn],
  pages: pagesOfRow(row),
  visuals: visualIdsOfRow(row),
  ...(row.datagalaxy_url ? { datagalaxy: row.datagalaxy_url } : {}),
});

export function chatParams({
  info,
  settings,
  viewerRow,
  pageName,
  datasetUrl,
  guide = [],
  data = [],
}: {
  /** Guide / data entries linked to this report. */
  guide?: ExcelRecord[];
  data?: ExcelRecord[];
  info?: ReportInfo;
  settings: Settings;
  viewerRow?: ExcelRecord | null;
  pageName?: string;
  datasetUrl?: string;
}): ChatParams {
  return {
    scope: "powerbi-viewer",
    title: "Report assistant",
    prompt: PROMPT,
    datasetUrl,
    initialContext: [
      viewerRow && `Your report_viewer row: ${JSON.stringify(viewerRow)}`,
      info ? `Report (JSON): ${JSON.stringify(compactInfo(info, pageName))}` : "The report structure is still being read.",
      guide.length > 0 && `Guide entries of this report (help texts linked to pages / visuals, JSON): ${JSON.stringify(guide.map(entry("text")))}`,
      data.length > 0 && `Data definitions of this report (DataGalaxy, JSON): ${JSON.stringify(data.map(entry("description")))}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    // Guide / data are given in the context (this report's rows only), not as whole excels.
    excels: [{ url: settings.viewerExcel, access: "write", name: "report_viewer" }],
  };
}
