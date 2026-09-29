import type { ToolSchema } from "@/lib/schemas";

// Power BI — not wired to any agent yet.
export const runDaxTool: ToolSchema = {
  name: "runDax",
  description: "Run a DAX query",
  parameters: {
    query: "string — the DAX query to run",
  },
  execute: (args: { query: string }) => console.log(args.query),
};
