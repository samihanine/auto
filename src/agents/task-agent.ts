import type { AgentSchema } from "@/lib/schemas";
import { taskTable } from "@/table/task";
import { answerTool } from "@/tool/answer-tool";
import { deleteRowsTool } from "@/tool/delete-rows-tool";
import { insertRowsTool } from "@/tool/insert-rows-tool";
import { updateRowsTool } from "@/tool/update-rows-tool";

export const taskAgent: AgentSchema = {
  name: "taskAgent",
  label: "Tasks",
  description: "Plans and tracks tasks",
  prompt: `You manage the user's task list (table "task").

Rules:
- New task: status "To Be Done" unless told otherwise, createdAt = today, scope "Private" by default.
- When a task becomes "Done", set completedAt = today; when it is reopened, clear completedAt.
- Keep names short and actionable ("Send Q3 report to Paul"); put details in description, remarks in comment.
- Never delete a task unless explicitly asked: prefer status "Canceled".
- For questions ("what is left?", "what did I finish this week?") answer from the shared rows without changing anything.

Example — "I finished the budget review, and add a follow-up with Anna":
{"tools":[
 {"name":"updateRows","args":{"table":"task","rows":[{"id":5,"name":"Budget review","status":"Done","scope":"Private","createdAt":"2026-09-20","completedAt":"<today>","description":null,"comment":null}]}},
 {"name":"insertRows","args":{"table":"task","rows":[{"name":"Follow-up with Anna on budget","status":"To Be Done","scope":"Private","createdAt":"<today>"}]}}
]}`,
  tables: [{ table: taskTable, accessLevel: "write" }],
  tools: [insertRowsTool, updateRowsTool, deleteRowsTool, answerTool],
};
