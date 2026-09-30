import { refreshVisualData } from "@/lib/dax";
import { datasetOf } from "@/lib/pbi-dataset";
import type { AgentSchema } from "@/lib/schemas";
import { BuilderTab } from "@/components/pbi/builder-tab";
import { datasetTable } from "@/table/dataset";
import { reportTable } from "@/table/report";
import { reportPageTable } from "@/table/report-page";
import { reportVisualTable } from "@/table/report-visual";
import { answerTool } from "@/tool/answer-tool";
import { deleteRowsTool } from "@/tool/delete-rows-tool";
import { insertRowsTool } from "@/tool/insert-rows-tool";
import { runDaxTool } from "@/tool/run-dax-tool";
import { updateRowsTool } from "@/tool/update-rows-tool";

export const pbiBuilderAgent: AgentSchema = {
  name: "pbiBuilderAgent",
  label: "Power BI builder",
  description: "Designs Power BI reports on the selected dataset (exported as PBIX)",
  prompt: `You design report pages on the ACTIVE dataset (model given in <context>). You never write DAX for visuals:
you describe each visual with fields, the app generates and runs the query, and writes the result in the visual's "data" column (you receive it in the tool result).

Report structure:
- pbiReport (the active report) → reportPage rows (powerBiReportId = report id) → reportVisual rows (powerBiPageId = page id, powerBiReportId = report id).
- Ids: invent readable unique ids — pages "<report id>-p2", visuals "v-<page>-<short-slug>". Names must be unique: "<report> · <page>" for pages, "<page> · <title>" for visuals.
- Canvas: 1280 × 720 px. Place visuals with x, y, width, height on a 16 px grid, 16 px margins, no overlap. Typical sizes: card 200×110, chart 600×320, table 600×320, slicer 240×220.

Fields:
- category / series: columns "Table[Column]"; values: measures "[Measure]" (preferred) or numeric columns "Table[Column]" (summed).
- Use only names that exist in the model. Prefer existing measures over summed columns.
- Types: card (1 value), kpi, tableEx (category + values), pivotTable (category = rows, series = columns, values), clusteredColumnChart / clusteredBarChart / stackedColumnChart / lineChart / areaChart (category + values, optional series), pieChart / donutChart (1 category + 1 value), slicer (1 category), textbox (title + description, no fields).
- filters: [{"field":"Table[Column]","operator":"In","values":["A","B"]}]; format: {"color":"#hex","background":"#hex","titleColor":"#hex","showLegend":true}.

Workflow:
1. Understand the need; if unsure which data exists, check the model or use runDax (small aggregated queries).
2. Create pages (if needed) and visuals in as few calls as possible.
3. Read the returned "data" of each visual: if it shows "Error: …" or makes no sense, fix the fields and retry.
4. Answer with a short summary of the page(s) you built. The user exports the PBIX from the tab.

Example visual row:
{"powerBiVisualId":"v-overview-sales-by-region","name":"Overview · Sales by region","powerBiPageId":"report-abc-p1","powerBiReportId":"report-abc","title":"Sales by region","type":"clusteredBarChart","x":16,"y":144,"width":608,"height":320,"z":1,"category":["Geography[Region]"],"values":["[Total Sales]"]}`,
  tables: [
    { table: datasetTable, accessLevel: "read" },
    { table: reportTable, accessLevel: "write" },
    { table: reportPageTable, accessLevel: "write" },
    { table: reportVisualTable, accessLevel: "write" },
  ],
  tools: [insertRowsTool, updateRowsTool, deleteRowsTool, runDaxTool, answerTool],
  tabs: [{ name: "builder", label: "Builder", component: BuilderTab }],
  context: ({ db, state }) => {
    if (!state.dataset) return "No dataset is selected: ask the user to select one in the Builder tab before designing.";
    const { row, model } = datasetOf(db, state.dataset);
    return [
      `Active dataset: ${row?.name ?? state.dataset} (powerBiDatasetId ${state.dataset}).`,
      state.report ? `Active report: powerBiReportId ${state.report}${state.page ? `, current page ${state.page}` : ""}.` : "No report selected: create one in pbiReport (source \"Built\", powerBiDatasetId = active dataset) with a first page.",
      `Dataset model: ${model ? JSON.stringify(model) : "unknown (re-import the dataset)"}`,
    ].join("\n");
  },
  afterWrite: async (table, rows, { db, state }) => {
    if (table === reportVisualTable.name && rows.length) await refreshVisualData(db, rows, state.dataset);
  },
};
