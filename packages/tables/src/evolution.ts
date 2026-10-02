import { tableSchema } from "./schema";
import { PRIORITY, REPORT_FIELDS, STATUS, VISUALS_FIELD } from "./options";

export const evolutionTable = tableSchema.parse({
  name: "evolution",
  label: "Evolution",
  description: "Planned or delivered evolutions of the reports",
  columns: [
    { name: "name", dataType: "string", required: true },
    { name: "status", dataType: "option", options: STATUS },
    { name: "priority", dataType: "option", options: PRIORITY },
    { name: "description", dataType: "text" },
    { name: "requestor", dataType: "string", multiple: true },
    { name: "date", dataType: "date" },
    ...REPORT_FIELDS,
    VISUALS_FIELD,
    { name: "image", dataType: "image" },
  ],
});
