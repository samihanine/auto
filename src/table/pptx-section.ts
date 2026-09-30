import { tableSchema } from "@/lib/schemas";

export const pptxSectionTable = tableSchema.decode({
  name: "pptxSection",
  description: "Content blocks of a slide, placed in one of the slide layout zones and stacked by `order`.",
  columns: [
    { name: "name", description: "Unique label, e.g. \"Intro · bullets\"", dataType: "string", required: true },
    { name: "slide", description: "Slide this block belongs to", dataType: "string", reference: "pptxSlide", required: true },
    {
      name: "zone",
      description: "main (Title + content, Full image, KPIs, Title), left/right (Two columns, Image + text)",
      dataType: "option",
      options: [
        { name: "main", color: "blue" },
        { name: "left", color: "teal" },
        { name: "right", color: "green" },
      ],
    },
    { name: "order", description: "Stacking order inside the zone", dataType: "number" },
    {
      name: "type",
      description: "Text: paragraph · Bullets: one bullet per line · Quote · Image · Table: `data` · KPI: big `value` + `content` label",
      dataType: "option",
      required: true,
      options: [
        { name: "Text", color: "gray" },
        { name: "Bullets", color: "blue" },
        { name: "Quote", color: "purple" },
        { name: "Image", color: "green" },
        { name: "Table", color: "orange" },
        { name: "KPI", color: "red" },
      ],
    },
    { name: "value", description: "KPI value, e.g. \"+12 %\"", dataType: "string" },
    { name: "image", description: "Image of an Image block", dataType: "image" },
    { name: "data", description: "Table block: JSON array of rows, first row = header, e.g. [[\"Q\",\"Sales\"],[\"Q1\",\"12\"]]", dataType: "json" },
    { name: "content", description: "Text of the block (\\n = new line / bullet, **bold**)", dataType: "text" },
  ],
});
