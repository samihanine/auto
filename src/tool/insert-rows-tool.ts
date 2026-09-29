import type { ToolSchema } from "@/lib/schemas";
import { tableContent, writableTable } from "./table-access";

export const insertRowsTool: ToolSchema = {
  name: "insertRows",
  description:
    "Insert one or more rows. Do not provide ids, they are generated. Returns the updated table.",
  parameters: {
    table: "string — table name",
    rows: "object[] — complete rows (every column except id)",
  },
  execute: async (args: { table: string; rows: Record<string, unknown>[] }, ctx) => {
    const table = writableTable(ctx, args.table);
    await ctx.db.insert(table.name, args.rows);
    return tableContent(ctx, table.name);
  },
};
