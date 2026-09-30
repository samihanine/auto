import { tableSchema } from "@/lib/schemas";

export const reportPageTable = tableSchema.decode({
  name: "reportPage",
  description: "Pages of the reports",
  key: "powerBiPageId",
  columns: [
    { name: "powerBiPageId", description: "Page id (Power BI section name, or a readable unique id like \"page-overview\" for built reports)", dataType: "string", required: true },
    { name: "name", description: "Unique label: \"<report> · <page>\"", dataType: "string", required: true },
    { name: "powerBiReportId", description: "Report of the page", dataType: "string", reference: "pbiReport", required: true },
    { name: "displayName", description: "Page title shown in the report tabs", dataType: "string" },
    { name: "order", description: "Tab order (0, 1, 2…)", dataType: "number" },
    { name: "width", description: "Canvas width in px (default 1280)", dataType: "number" },
    { name: "height", description: "Canvas height in px (default 720)", dataType: "number" },
    { name: "hidden", dataType: "boolean" },
    { name: "filters", description: "Page-level filters (JSON, see reportVisual.filters)", dataType: "json" },
  ],
});
