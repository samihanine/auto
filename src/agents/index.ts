import { requestAgent } from "./request-agent";
import { taskAgent } from "./task-agent";

export const agents = [taskAgent, requestAgent];

/** Every table used by at least one agent, deduplicated by name. */
export const allTables = [
  ...new Map(
    agents.flatMap((agent) => agent.tables.map(({ table }) => [table.name, table] as const)),
  ).values(),
];

export const findAgent = (name?: string) =>
  agents.find((agent) => agent.name === name) ?? agents[0];
