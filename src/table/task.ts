import { tableSchema } from "@/lib/schemas";

export const taskTable = tableSchema.decode({
  name: "task",
  description: "A table for tasks",
  columns: [
    {
      name: "name",
      description: "The name of the task",
      dataType: "string",
      required: true,
    },
    {
      name: "status",
      dataType: "option",
      options: [
        {
          name: "To Be Done",
          color: "red",
        },
        {
          name: "Done",
          color: "green",
        },
        {
          name: "In Be Validated",
          color: "yellow",
        },
        {
          name: "In Be Studied",
          color: "orange",
        },
        {
          name: "In Progress",
          color: "blue",
        },
        {
          name: "Canceled",
          color: "gray",
        },
      ],
    },
    {
      name: "scope",
      dataType: "option",
      options: [
        {
          name: "Private",
          color: "violet",
        },
        {
          name: "Public",
          color: "teal",
        },
      ],
    },
    {
      name: "image",
      dataType: "image",
    },
    {
      name: "createdAt",
      dataType: "date",
    },
    {
      name: "completedAt",
      dataType: "date",
    },
    {
      name: "description",
      description: "The description of the task",
      dataType: "text",
    },
    {
      name: "comment",
      dataType: "text",
    },
  ],
  config: [],
});
