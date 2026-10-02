import { dataTable } from "./data";
import { evolutionTable } from "./evolution";
import { guideTable } from "./guide";
import { requestTable } from "./request";
import { taskTable } from "./task";

/** Structures a source Excel can follow. */
export const structures = [guideTable, requestTable, taskTable, evolutionTable, dataTable];

export const findStructure = (name: string) => structures.find((s) => s.name === name);

export { dataTable, evolutionTable, guideTable, requestTable, taskTable };
