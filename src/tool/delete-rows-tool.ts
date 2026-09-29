import type { ToolSchema } from "@/lib/schemas";
import { tableContent, writableTable } from "./table-access";

export const deleteRowsTool: ToolSchema = {
  name: "deleteRows",
  description: "Delete one or more rows by id. Returns the updated table.",
  parameters: {
    table: "string — table name",
    ids: "number[] — ids of the rows to delete",
  },
  execute: async (args: { table: string; ids: number[] }, ctx) => {
    const table = writableTable(ctx, args.table);
    await ctx.db.delete(table.name, args.ids.map(Number));
    return tableContent(ctx, table.name);
  },
};
