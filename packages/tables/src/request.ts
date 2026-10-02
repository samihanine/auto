import { tableSchema } from "./schema";
import { REPORT_FIELDS, SCOPE, STATUS } from "./options";

export const requestTable = tableSchema.parse({
  name: "request",
  label: "Request",
  description: "Change requests on the reports",
  columns: [
    { name: "name", description: "Short summary", dataType: "string", required: true },
    { name: "status", dataType: "option", options: STATUS },
    { name: "requestor", description: "People asking", dataType: "string", multiple: true },
    { name: "sources", dataType: "option", options: SCOPE, multiple: true },
    { name: "request_date", dataType: "date" },
    ...REPORT_FIELDS,
    { name: "scope", dataType: "string" },
    { name: "request_description", dataType: "text" },
    { name: "request_image", dataType: "image" },
    { name: "solution_description", dataType: "text" },
    { name: "solution_image", dataType: "image" },
    { name: "solution_date", dataType: "date" },
    { name: "comment", dataType: "text" },
  ],
});
