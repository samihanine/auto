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
  prompt:
    "You help the user organise their tasks: create, update, prioritise and close them. Set createdAt to today when creating a task and completedAt when it becomes Done.",
  tables: [{ table: taskTable, accessLevel: "write" }],
  tools: [insertRowsTool, updateRowsTool, deleteRowsTool, answerTool],
};
