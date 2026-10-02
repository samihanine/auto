import { tableSchema } from "./schema";
import { REPORT_FIELDS, VISUALS_FIELD } from "./options";

export const dataTable = tableSchema.parse({
  name: "data",
  label: "Data",
  description: "DataGalaxy definitions shown in the Power BI viewer for the linked visuals",
  columns: [
    { name: "datagalaxy_url", label: "DataGalaxy", description: "DataGalaxy object link", dataType: "url" },
    { name: "name", label: "Title", dataType: "string", required: true },
    { name: "description", dataType: "text" },
    ...REPORT_FIELDS,
    VISUALS_FIELD,
  ],
});
