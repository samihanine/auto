import type { ToolSchema } from "@/lib/schemas";
import { afterWrite, writableTable } from "./table-access";

export const deleteRowsTool: ToolSchema = {
  name: "deleteRows",
  description: `Permanently delete rows by id. Only delete when the user clearly asked for it; when in doubt, ask with "answer" first.
Returns the table's shared rows after the deletion.
Example: {"name":"deleteRows","args":{"table":"task","ids":[4,9]}}`,
  parameters: {
    table: "string — table name",
    ids: "number[] — ids of the rows to delete",
  },
  execute: async (args: { table: string; ids: number[] }, ctx) => {
    const table = writableTable(ctx, args.table);
    await ctx.db.delete(table.name, args.ids.map(Number));
    return afterWrite(ctx, table.name, []);
  },
};
