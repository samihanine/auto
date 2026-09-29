import { tableSchema } from "@/lib/schemas";

export const pptxSlideTable = tableSchema.decode({
  name: "pptxSlide",
  description: "A table for PPTX slides",
  columns: [
    {
      name: "order",
      description: "The order of the slide",
      dataType: "string",
      required: true,
    },
    {
      name: "name",
      description: "The name of the slide",
      dataType: "string",
      required: true,
    },
    {
      name: "content",
      description: "The content of the slide",
      dataType: "string",
      required: true,
    },
  ],
  config: [],
});
