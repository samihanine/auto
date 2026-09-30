import type { AgentRuntime, AgentSchema } from "@/lib/schemas";
import { ViewerTab } from "@/components/pbi/viewer-tab";
import { reportTable } from "@/table/report";
import { reportPageTable } from "@/table/report-page";
import { reportTutorialTable } from "@/table/report-tutorial";
import { reportViewerTable } from "@/table/report-viewer";
import { reportVisualTable } from "@/table/report-visual";
import { answerTool } from "@/tool/answer-tool";
import { insertRowsTool } from "@/tool/insert-rows-tool";
import { activeDatasetId, runDaxTool } from "@/tool/run-dax-tool";
import { updateRowsTool } from "@/tool/update-rows-tool";

/** Makes sure the conversation has its reportViewer row for the open report. */
async function viewerRow({ db, conversationId, state }: AgentRuntime) {
  const existing = db
    .rows(reportViewerTable.name)
    .find((r) => r.conversationId === conversationId && r.powerBiReportId === state.report);
  if (existing) return existing;
  const [created] = await db.insert(reportViewerTable.name, [
    {
      name: `viewer-${conversationId.slice(0, 8)}-${state.report.slice(0, 8)}`,
      conversationId,
      powerBiReportId: state.report,
      powerBiPageId: state.page || null,
    },
  ]);
  return created;
}

export const pbiViewerAgent: AgentSchema = {
  name: "pbiViewerAgent",
  label: "Power BI viewer",
  description: "Guides the user through an embedded Power BI report: navigates pages, sets filters, explains visuals",
  prompt: `You help the user read the report open in the Viewer tab. The report structure (pages, visuals with their fields, filters, exported data) and tutorials are in the read-only tables.

You drive the viewer ONLY through your reportViewer row (id given in <context>), with updateRows (send every column):
- Change page: set "powerBiPageId" to a page id of the open report.
- Filter the page: "pageFilters" = [{"field":"Table[Column]","operator":"In","values":["France"]}]; "[]" clears them; null leaves the user's filters untouched.
- Filter one visual: "visualFilters" = {"<powerBiVisualId>":[{"field":…,"operator":"In","values":[…]}]}.
- Fields must be real columns of the report's dataset (see reportVisual.category/series/values and filters).

Answering questions:
- Explain visuals from their title, type, fields, filters, data and the tutorials; point the user to the page/visual.
- To get exact numbers, use runDax on the report's dataset (aggregated queries only) rather than guessing.
- When you change page or filters, say what you changed in one sentence.

Example — "show me France on the sales page":
{"tools":[{"name":"updateRows","args":{"table":"reportViewer","rows":[{"id":3,"name":"viewer-…","conversationId":"…","powerBiReportId":"…","powerBiPageId":"ReportSection2","pageFilters":"[{\\"field\\":\\"Geography[Country]\\",\\"operator\\":\\"In\\",\\"values\\":[\\"France\\"]}]","visualFilters":null}]}}]}`,
  tables: [
    { table: reportTable, accessLevel: "read" },
    { table: reportPageTable, accessLevel: "read" },
    { table: reportVisualTable, accessLevel: "read" },
    { table: reportTutorialTable, accessLevel: "read" },
    { table: reportViewerTable, accessLevel: "write" },
  ],
  tools: [updateRowsTool, insertRowsTool, runDaxTool, answerTool],
  tabs: [{ name: "viewer", label: "Viewer", component: ViewerTab }],
  context: async (runtime) => {
    const { db, state } = runtime;
    if (!state.report) return "No report is open: ask the user to select one in the Viewer tab.";
    const report = db.rows(reportTable.name).find((r) => r.powerBiReportId === state.report);
    const page = db.rows(reportPageTable.name).find((p) => p.powerBiPageId === state.page);
    const row = await viewerRow(runtime);
    return [
      `Open report: ${report?.name ?? state.report} (powerBiReportId ${state.report}).`,
      `Current page: ${page ? `${page.displayName} (powerBiPageId ${page.powerBiPageId})` : state.page || "default page"}.`,
      `Your reportViewer row: ${JSON.stringify(row)}`,
      `Dataset for runDax: ${activeDatasetId(runtime) ?? "unknown (runDax unavailable)"}.`,
    ].join("\n");
  },
};
