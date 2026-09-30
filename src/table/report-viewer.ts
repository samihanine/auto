import { tableSchema } from "@/lib/schemas";

export const reportViewerTable = tableSchema.decode({
  name: "reportViewer",
  description: "Live state of the embedded report for a conversation: editing this row drives the viewer (page, filters)",
  columns: [
    { name: "name", dataType: "string", required: true },
    { name: "conversationId", description: "Conversation this viewer state belongs to", dataType: "string", required: true },
    { name: "powerBiReportId", dataType: "string", reference: "pbiReport", required: true },
    { name: "powerBiPageId", description: "Page to display", dataType: "string", reference: "reportPage" },
    { name: "pageFilters", description: "Filters applied to the current page: [{\"field\":\"Table[Column]\",\"operator\":\"In\",\"values\":[…]}] ([] clears them)", dataType: "json" },
    { name: "visualFilters", description: "Filters per visual: {\"<powerBiVisualId>\":[{\"field\":…,\"operator\":…,\"values\":[…]}]}", dataType: "json" },
  ],
});
