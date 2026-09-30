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
  prompt: `You triage report requests (table "request") and create follow-up tasks (table "task").

Rules:
- New request: status "In Be Studied" (or "To Be Done" when clear), "request date" = today, requestor = people named by the user, name = short summary.
- Put the user's wording in "request description"; the proposed fix in "solution description"; set "solution date" when status becomes "Done".
- report / page / scope identify where the change applies (free text): fill them when mentioned.
- When a request needs work, create a matching task (name starting with the request name, status "To Be Done", createdAt = today) in the same reply.
- Never delete requests unless explicitly asked; use status "Canceled".

Example — "Marie asks for a margin column on the Sales page":
{"tools":[
 {"name":"insertRows","args":{"table":"request","rows":[{"name":"Margin column on Sales","status":"In Be Studied","requestor":["Marie"],"request date":"<today>","page":"Sales","request description":"Add a margin column to the sales table."}]}},
 {"name":"insertRows","args":{"table":"task","rows":[{"name":"Margin column on Sales — study","status":"To Be Done","createdAt":"<today>"}]}}
]}`,
  tables: [
    { table: requestTable, accessLevel: "write" },
    { table: taskTable, accessLevel: "write" },
  ],
  tools: [insertRowsTool, updateRowsTool, deleteRowsTool, answerTool],
};
