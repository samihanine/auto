import type { ToolSchema } from "@/lib/schemas";
import { tableContent, writableTable } from "./table-access";

export const updateRowsTool: ToolSchema = {
  name: "updateRows",
  description:
    "Update one or more rows by id. Each row fully replaces the existing one, so send every column. Returns the updated table.",
  parameters: {
    table: "string — table name",
    rows: "object[] — complete rows including their id",
  },
  execute: async (args: { table: string; rows: Record<string, unknown>[] }, ctx) => {
    const table = writableTable(ctx, args.table);
    await ctx.db.update(table.name, args.rows);
    return tableContent(ctx, table.name);
  },
};
