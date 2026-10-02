import { AI } from "@repo/config";
import { executeQuery, parseDatasetUrl } from "@repo/microsoft-auth/powerbi";
import type { ChatParams } from "@repo/ui/components/chat-frame";
import type { OpenExcel } from "./excels";
import { findExcel } from "./excels";
import { ANSWER } from "./prompts";

export type ToolContext = { excels: OpenExcel[]; params: ChatParams; onWrite: (url: string) => void };

export type Tool = {
  name: string;
  description: string;
  parameters: Record<string, string>;
  execute: (args: any, ctx: ToolContext) => unknown;
};

type Row = Record<string, string | number | boolean | null>;

/** After a write: notify the host app. The refreshed rows come with the next message (<excels>). */
function written(ctx: ToolContext, excel: OpenExcel, change: Record<string, unknown>) {
  ctx.onWrite(excel.url);
  return { excel: excel.name, ...change };
}

const insertRows: Tool = {
  name: "insertRows",
  description: `Add rows to a writable excel. Never send "id" (generated). Returns the new ids; the refreshed rows come with the next message.
Example: {"name":"insertRows","args":{"excel":"task","rows":[{"name":"Check KPI","status":"To do"}]}}`,
  parameters: { excel: "string — excel name", rows: "object[] — rows without id" },
  execute: async (args: { excel: string; rows: Row[] }, ctx) => {
    const excel = findExcel(ctx.excels, args.excel, "write");
    const created = await excel.table.insertRecords(args.rows);
    return written(ctx, excel, { insertedIds: created.map((row) => row.id) });
  },
};

const updateRows: Tool = {
  name: "updateRows",
  description: `Change fields of existing rows (matched by id). Only the given fields change; the refreshed rows come with the next message.
Example: {"name":"updateRows","args":{"excel":"task","rows":[{"id":4,"status":"Done"}]}}`,
  parameters: { excel: "string — excel name", rows: "object[] — {id, ...fields to change}" },
  execute: async (args: { excel: string; rows: Row[] }, ctx) => {
    const excel = findExcel(ctx.excels, args.excel, "write");
    await excel.table.updateRecords(args.rows);
    return written(ctx, excel, { updatedIds: args.rows.map((row) => row.id) });
  },
};

const deleteRows: Tool = {
  name: "deleteRows",
  description: `Delete rows by id — only when the user clearly asked for it.
Example: {"name":"deleteRows","args":{"excel":"task","ids":[4,9]}}`,
  parameters: { excel: "string — excel name", ids: "number[] — row ids" },
  execute: async (args: { excel: string; ids: number[] }, ctx) => {
    const excel = findExcel(ctx.excels, args.excel, "write");
    await excel.table.deleteRecords(args.ids);
    return written(ctx, excel, { deletedIds: args.ids });
  },
};

const MAX_DAX_ROWS = AI.maxDaxRows;

const runDax: Tool = {
  name: "runDax",
  description: `Run a read-only DAX query on the report's dataset to get exact numbers. Must start with EVALUATE and return a table.
Aggregate (SUMMARIZECOLUMNS, TOPN): results are capped at ${MAX_DAX_ROWS} rows.
Example: {"name":"runDax","args":{"query":"EVALUATE SUMMARIZECOLUMNS('Date'[Year], \\"Sales\\", [Total Sales])"}}`,
  parameters: { query: "string — DAX query starting with EVALUATE" },
  execute: async (args: { query: string }, ctx) => {
    const rows = await executeQuery(parseDatasetUrl(ctx.params.datasetUrl!), args.query);
    return { rowCount: rows.length, rows: rows.slice(0, MAX_DAX_ROWS) };
  },
};

const answer: Tool = {
  name: ANSWER,
  description: `Reply to the user and end your turn. Must be the ONLY tool call of the reply. Markdown is rendered.
Example: {"name":"${ANSWER}","args":{"message":"Done — **2 rows** updated."}}`,
  parameters: { message: "string — the reply (Markdown)" },
  execute: (args: { message: string }) => args.message,
};

/** Tools available for these params: write tools only with a writable excel, DAX only with a dataset. */
export function toolsFor(params: ChatParams): Tool[] {
  const canWrite = params.excels.some((e) => e.access === "write");
  return [
    ...(canWrite ? [insertRows, updateRows, deleteRows] : []),
    ...(params.datasetUrl ? [runDax] : []),
    answer,
  ];
}
