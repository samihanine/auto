import type { Row, ToolContext } from "@/lib/schemas";

/** Resolves a table the agent may write to. */
export function writableTable({ agent }: ToolContext, name: string) {
  const access = agent.tables.find(({ table }) => table.name === name);
  if (!access) throw new Error(`Table "${name}" is not available to this agent`);
  if (access.accessLevel !== "write") throw new Error(`Table "${name}" is read-only`);
  return access.table;
}

/** Runs the agent's afterWrite hook, then returns the shared rows of the up-to-date table. */
export async function afterWrite(ctx: ToolContext, name: string, changed: Row[]) {
  await ctx.agent.afterWrite?.(name, changed, ctx);
  return {
    table: name,
    rows: ctx.db.rows(name).filter((row) => ctx.isShared(name, row.id)),
  };
}
