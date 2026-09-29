import type { AgentSchema } from "@/lib/schemas";
import { requestTable } from "@/table/request";
import { taskTable } from "@/table/task";
import { answerTool } from "@/tool/answer-tool";
import { deleteRowsTool } from "@/tool/delete-rows-tool";
import { insertRowsTool } from "@/tool/insert-rows-tool";
import { updateRowsTool } from "@/tool/update-rows-tool";

export const requestAgent: AgentSchema = {
  name: "requestAgent",
  label: "Requests",
  description: "Handles incoming requests and turns them into tasks",
  prompt:
    "You help the user triage report requests: log new requests, keep their status up to date and create follow-up tasks when useful.",
  tables: [
    { table: requestTable, accessLevel: "write" },
    { table: taskTable, accessLevel: "write" },
  ],
  tools: [insertRowsTool, updateRowsTool, deleteRowsTool, answerTool],
};
