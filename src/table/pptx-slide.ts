import { tableSchema } from "@/lib/schemas";

export const SLIDE_LAYOUTS = [
  "Title",
  "Section header",
  "Title + content",
  "Two columns",
  "Image + text",
  "Full image",
  "KPIs",
] as const;

export const pptxSlideTable = tableSchema.decode({
  name: "pptxSlide",
  description: "Slides of the deck, in `order`. Their content lives in pptxSection rows.",
  columns: [
    { name: "name", description: "Slide title (unique, shown on the slide)", dataType: "string", required: true },
    { name: "order", description: "Position in the deck (1, 2, 3…)", dataType: "number", required: true },
    {
      name: "layout",
      description: "Title/Section header: big centered title; Title + content: one main zone; Two columns: left + right zones; Image + text: left image zone + right text zone; Full image: main image with title overlay; KPIs: main zone with KPI sections side by side",
      dataType: "option",
      required: true,
      options: [
        { name: "Title", color: "violet" },
        { name: "Section header", color: "indigo" },
        { name: "Title + content", color: "blue" },
        { name: "Two columns", color: "teal" },
        { name: "Image + text", color: "green" },
        { name: "Full image", color: "lime" },
        { name: "KPIs", color: "orange" },
      ],
    },
    { name: "subtitle", description: "Optional subtitle under the title", dataType: "string" },
    {
      name: "theme",
      dataType: "option",
      options: [
        { name: "Light", color: "white" },
        { name: "Dark", color: "black" },
        { name: "Accent", color: "brown" },
      ],
    },
    { name: "notes", description: "Speaker notes", dataType: "text" },
  ],
});
