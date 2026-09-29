import type { ToolSchema } from "@/lib/schemas";

export const answerTool: ToolSchema = {
  name: "answer",
  description:
    "Reply to the user and end your turn. Must be the only tool in the response. Markdown is allowed.",
  parameters: {
    message: "string — the reply shown to the user",
  },
  execute: (args: { message: string }) => args.message,
};
