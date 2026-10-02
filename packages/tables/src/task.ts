import { tableSchema } from "./schema";
import { REPORT_FIELDS, SCOPE, STATUS } from "./options";

export const taskTable = tableSchema.parse({
  name: "task",
  label: "Task",
  description: "Tasks to do",
  columns: [
    { name: "name", description: "Short, actionable", dataType: "string", required: true },
    { name: "status", dataType: "option", options: STATUS },
    { name: "scope", dataType: "option", options: SCOPE },
    ...REPORT_FIELDS,
    { name: "created_at", dataType: "date" },
    { name: "completed_at", dataType: "date" },
    { name: "description", dataType: "text" },
    { name: "comment", dataType: "text" },
    { name: "image", dataType: "image" },
  ],
});
