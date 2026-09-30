import type { ToolSchema } from "@/lib/schemas";

export const answerTool: ToolSchema = {
  name: "answer",
  description: `Reply to the user and end your turn. Must be the ONLY tool call of the reply.
Use it once the requested changes succeeded (summarise what changed), to answer a question, or to ask for missing information.
Keep it short; Markdown (bold, lists, tables) is rendered.
Example: {"name":"answer","args":{"message":"Done — **2 tasks** closed."}}`,
  parameters: {
    message: "string — the reply shown to the user (Markdown)",
  },
  execute: (args: { message: string }) => args.message,
};
