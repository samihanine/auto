import type { ToolSchema } from "@/lib/schemas";
import { afterWrite, writableTable } from "./table-access";

export const updateRowsTool: ToolSchema = {
  name: "updateRows",
  description: `Update one or more existing rows, matched by "id".
IMPORTANT: each row REPLACES the stored row entirely — copy every column from the current row and change only what is needed, otherwise the missing columns are erased.
Returns the table's shared rows after the update.
Example: {"name":"updateRows","args":{"table":"task","rows":[{"id":3,"name":"Write brief","status":"Done","scope":"Public","createdAt":"2026-09-01","completedAt":"2026-09-30","description":null,"comment":null}]}}`,
  parameters: {
    table: "string — table name",
    rows: "object[] — complete rows including their id",
  },
  execute: async (args: { table: string; rows: Record<string, unknown>[] }, ctx) => {
    const table = writableTable(ctx, args.table);
    await ctx.db.update(table.name, args.rows);
    const ids = args.rows.map((row) => Number(row.id));
    return afterWrite(ctx, table.name, ctx.db.rows(table.name).filter((row) => ids.includes(row.id)));
  },
};
