import type { ToolContext } from "@/lib/schemas";

/** Resolves a table the agent may write to. */
export function writableTable({ agent }: ToolContext, name: string) {
  const access = agent.tables.find(({ table }) => table.name === name);
  if (!access) throw new Error(`Table "${name}" is not available to this agent`);
  if (access.accessLevel !== "write") throw new Error(`Table "${name}" is read-only`);
  return access.table;
}

/** Tool response after a write: the whole up-to-date table. */
export const tableContent = ({ db }: ToolContext, name: string) => ({
  table: name,
  rows: db.rows(name),
});
