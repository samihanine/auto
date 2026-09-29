import { tableSchema } from "@/lib/schemas";

export const reportPageTable = tableSchema.decode({
  name: "reportPage",
  description: "A table for report pages",
  columns: [
    {
      name: "powerBiPageId",
      description: "The ID of the page",
      dataType: "string",
      required: true,
    },
    {
      name: "powerBiReportId",
      description: "The ID of the report",
      dataType: "string",
      required: true,
    },
    {
      name: "name",
      description: "The name of the page",
      dataType: "string",
      required: true,
    },
  ],
  config: [],
});
