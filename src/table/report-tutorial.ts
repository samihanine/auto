import { tableSchema } from "@/lib/schemas";

export const reportTutorialTable = tableSchema.decode({
  name: "reportTutorial",
  description: "Help texts shown in the viewer when the user clicks one of the linked visuals",
  columns: [
    { name: "name", description: "Tutorial title", dataType: "string", required: true },
    { name: "powerBiReportId", dataType: "string", reference: "pbiReport", required: true },
    { name: "visuals", description: "Visuals that open this tutorial", dataType: "string", reference: "reportVisual", multiple: true },
    { name: "content", description: "Explanation (\\n line breaks, **bold**)", dataType: "text" },
  ],
});
