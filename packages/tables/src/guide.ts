import { tableSchema } from "./schema";
import { REPORT_FIELDS, VISUALS_FIELD } from "./options";

export const guideTable = tableSchema.parse({
  name: "guide",
  label: "Guide",
  description: "Help texts shown in the Power BI viewer when the user clicks one of the linked visuals",
  columns: [
    ...REPORT_FIELDS,
    VISUALS_FIELD,
    { name: "name", label: "Title", dataType: "string", required: true },
    { name: "text", description: "Explanation (line breaks, **bold**)", dataType: "text" },
    { name: "image", dataType: "image" },
  ],
});
