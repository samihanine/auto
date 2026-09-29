import { tableSchema } from "@/lib/schemas";

export const reportViewerTable = tableSchema.decode({
  name: "reportVisual",
  description: "A table for report visuals",
  columns: [
    {
      name: "powerBiPageId",
      description: "The ID of the page",
      dataType: "string",
      required: true,
    },
    {
      name: "powerBiVisualId",
      description: "The ID of the visual",
      dataType: "string",
      required: false,
    },
    {
      name: "filters",
      description: "The filters of the visual",
      dataType: "text",
      multiple: true,
    },
  ],
  config: [
    {
      name: "Current Power BI Page ID",
    },
  ],
});
