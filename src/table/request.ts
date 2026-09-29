import { tableSchema } from "@/lib/schemas";

export const requestTable = tableSchema.decode({
  name: "request",
  description: "A table for requests",
  columns: [
    {
      name: "name",
      description: "The name of the request",
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
      name: "requestor",
      multiple: true,
    },
    {
      name: "sources",
      dataType: "option",
      options: [
        {
          name: "Private",
        },
        {
          name: "Public",
        },
      ],
      multiple: true,
    },
    {
      name: "request date",
      dataType: "date",
    },
    {
      name: "description",
      description: "The description of the request",
      dataType: "text",
    },
    {
      name: "report",
    },
    {
      name: "page",
    },
    {
      name: "scope",
    },
    {
      name: "request image",
      description: "The image of the request",
      dataType: "image",
    },
    {
      name: "request description",
      description: "The description of the request",
      dataType: "text",
    },
    {
      name: "solution description",
      description: "The description of the solution",
      dataType: "text",
    },
    {
      name: "solution image",
      description: "The image of the solution",
      dataType: "image",
    },
    {
      name: "solution date",
      dataType: "date",
    },
    {
      name: "comment",
      dataType: "text",
    },
  ],
  config: [],
});
