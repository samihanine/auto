import { pbiBuilderAgent } from "./pbi-builder-agent";
import { pbiViewerAgent } from "./pbi-viewer-agent";
import { requestAgent } from "./request-agent";
import { slidesAgent } from "./slides-agent";
import { taskAgent } from "./task-agent";
import { datasetTable } from "@/table/dataset";

export const agents = [taskAgent, requestAgent, slidesAgent, pbiBuilderAgent, pbiViewerAgent];

/** Every table used by an agent or an import page, deduplicated by name. */
export const allTables = [
  ...new Map(
    [...agents.flatMap((agent) => agent.tables.map(({ table }) => table)), datasetTable].map(
      (table) => [table.name, table] as const,
    ),
  ).values(),
];

export const findAgent = (name?: string) =>
  agents.find((agent) => agent.name === name) ?? agents[0];
