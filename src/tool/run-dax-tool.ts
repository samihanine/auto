import { executeQuery } from "@/lib/pbi-api";
import { datasetOf } from "@/lib/pbi-dataset";
import type { AgentRuntime, ToolSchema } from "@/lib/schemas";
import { reportTable } from "@/table/report";

const MAX_ROWS = 100;

/** Active dataset: chosen in the builder tab, or the dataset of the report open in the viewer. */
export function activeDatasetId({ db, state }: AgentRuntime) {
  if (state.dataset) return state.dataset;
  const report = db.rows(reportTable.name).find((r) => r.powerBiReportId === state.report);
  return report?.powerBiDatasetId ? String(report.powerBiDatasetId) : undefined;
}

export const runDaxTool: ToolSchema = {
  name: "runDax",
  description: `Run a DAX query on the ACTIVE dataset (selected in the tab) to explore data or check numbers. Read-only.
- The query must start with EVALUATE and return a table; use the column/measure names of the dataset model.
- Results are capped at ${MAX_ROWS} rows: aggregate (SUMMARIZECOLUMNS, TOPN) instead of dumping tables.
- Fails if no dataset is active: then ask the user to pick one in the tab.
Examples:
{"name":"runDax","args":{"query":"EVALUATE SUMMARIZECOLUMNS('Date'[Year], \\"Sales\\", [Total Sales])"}}
{"name":"runDax","args":{"query":"EVALUATE TOPN(5, VALUES('Product'[Category]))"}}`,
  parameters: {
    query: "string — DAX query starting with EVALUATE",
  },
  execute: async (args: { query: string }, ctx) => {
    const datasetId = activeDatasetId(ctx);
    if (!datasetId) throw new Error("No active dataset: ask the user to select one in the tab first.");
    const rows = await executeQuery(datasetOf(ctx.db, datasetId).ref, args.query);
    return { rowCount: rows.length, rows: rows.slice(0, MAX_ROWS) };
  },
};
