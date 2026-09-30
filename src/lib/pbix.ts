import { strToU8, zipSync } from "fflate";
import type { DatasetModel } from "./pbi-dataset";
import { parseField, parseJson } from "./pbi-fields";
import type { Row } from "./schemas";

/**
 * Best-effort "thin report" PBIX: report layout (legacy Report/Layout JSON) live-connected to a
 * Power BI dataset — no embedded model. Format undocumented by Microsoft.
 */
const DESKTOP_CLIENT_ID = "929d0ec0-7a41-4b1e-bc7c-b754a28bddcc";

type Select = { Name: string; [kind: string]: unknown };

/** Power BI role names per visual type: [role, source list]. */
function projectionRoles(type: string): [string, "category" | "series" | "values" | "all"][] {
  switch (type) {
    case "card":
      return [["Values", "values"]];
    case "multiRowCard":
    case "tableEx":
      return [["Values", "all"]];
    case "pivotTable":
      return [["Rows", "category"], ["Columns", "series"], ["Values", "values"]];
    case "slicer":
      return [["Values", "category"]];
    case "kpi":
      return [["Indicator", "values"], ["TrendLine", "category"]];
    case "map":
    case "filledMap":
      return [["Category", "category"], ["Size", "values"]];
    case "textbox":
    case "image":
    case "shape":
    case "actionButton":
      return [];
    default:
      return [["Category", "category"], ["Series", "series"], ["Y", "values"]];
  }
}

const list = (value: unknown) => [value].flat().filter((v): v is string => typeof v === "string" && !!v);
const literal = (value: string) => ({ expr: { Literal: { Value: `'${value.replace(/'/g, "''")}'` } } });
const safeName = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) || "x";

/** Builds the prototype query (From/Select) and the query refs of each field; `summed` columns are aggregated. */
function query(fields: string[], summed: Set<string>, model?: DatasetModel) {
  const from: { Name: string; Entity: string; Type: 0 }[] = [];
  const select: Select[] = [];
  const refs = new Map<string, string>();

  const source = (entity: string) => {
    let alias = from.find((f) => f.Entity === entity)?.Name;
    if (!alias) from.push({ Name: (alias = `s${from.length}`), Entity: entity, Type: 0 });
    return { SourceRef: { Source: alias } };
  };

  for (const field of new Set(fields)) {
    const { table, name } = parseField(field);
    const home = model?.tables.find((t) => (table ? t.name === table : t.measures.some((m) => m.name === name)));
    const entity = table ?? home?.name;
    if (!entity) continue;
    const measure = !table || home?.measures.some((m) => m.name === name);
    const column = { Column: { Expression: source(entity), Property: name } };
    const queryRef = measure ? `${entity}.${name}` : summed.has(field) ? `Sum(${entity}.${name})` : `${entity}.${name}`;
    select.push(
      measure
        ? { Measure: { Expression: source(entity), Property: name }, Name: queryRef }
        : summed.has(field)
          ? { Aggregation: { Expression: column, Function: 0 }, Name: queryRef }
          : { ...column, Name: queryRef },
    );
    refs.set(field, queryRef);
  }
  return { prototypeQuery: { Version: 2, From: from, Select: select }, refs };
}

function visualContainer(visual: Row, model?: DatasetModel) {
  const type = String(visual.type ?? "tableEx");
  const sources = {
    category: list(visual.category),
    series: list(visual.series),
    values: list(visual.values),
    all: [...list(visual.category), ...list(visual.values)],
  };
  const roles = projectionRoles(type);
  const { prototypeQuery, refs } = query(roles.flatMap(([, from]) => sources[from]), new Set(sources.values), model);
  const projections = Object.fromEntries(
    roles
      .map(([role, from]) => [role, sources[from].filter((f) => refs.has(f)).map((f) => ({ queryRef: refs.get(f) }))] as const)
      .filter(([, items]) => items.length),
  );
  const format = parseJson<Record<string, unknown>>(visual.format, {});
  const position = {
    x: Number(visual.x ?? 0),
    y: Number(visual.y ?? 0),
    z: Number(visual.z ?? 0),
    width: Number(visual.width ?? 300),
    height: Number(visual.height ?? 200),
  };

  const config = {
    name: safeName(String(visual.powerBiVisualId)),
    layouts: [{ id: 0, position: { ...position, tabOrder: position.z } }],
    singleVisual: {
      visualType: type,
      projections,
      prototypeQuery,
      drillFilterOtherVisuals: true,
      ...(format.color
        ? { objects: { dataPoint: [{ properties: { defaultColor: { solid: { color: literal(String(format.color)) } } } }] } }
        : {}),
      vcObjects: {
        title: [{ properties: { show: { expr: { Literal: { Value: "true" } } }, text: literal(String(visual.title ?? visual.name)) } }],
        ...(format.background
          ? { background: [{ properties: { show: { expr: { Literal: { Value: "true" } } }, color: { solid: { color: literal(String(format.background)) } } } }] }
          : {}),
      },
    },
  };
  return { ...position, config: JSON.stringify(config), filters: "[]" };
}

/** UTF-16LE without BOM, as Power BI Desktop writes its JSON parts. */
function utf16(text: string) {
  const bytes = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = code >> 8;
  }
  return bytes;
}

export function buildPbix({
  pages,
  visuals,
  datasetId,
  model,
}: {
  pages: Row[];
  visuals: Row[];
  datasetId: string;
  model?: DatasetModel;
}) {
  const sections = [...pages]
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map((page, ordinal) => ({
      name: safeName(String(page.powerBiPageId)),
      displayName: String(page.displayName || page.name),
      filters: "[]",
      ordinal,
      visualContainers: visuals.filter((v) => v.powerBiPageId === page.powerBiPageId).map((v) => visualContainer(v, model)),
      config: "{}",
      displayOption: 1,
      width: Number(page.width ?? 1280),
      height: Number(page.height ?? 720),
    }));

  const layout = {
    id: 0,
    resourcePackages: [],
    sections,
    config: JSON.stringify({ version: "5.37", themeCollection: {}, activeSectionIndex: 0, defaultDrillFilterOtherVisuals: true }),
    layoutOptimization: 0,
  };
  const connections = {
    Version: 3,
    Connections: [
      {
        Name: "EntityDataSource",
        ConnectionString: `Data Source=pbiazure://api.powerbi.com/;Identity Provider="https://login.microsoftonline.com/common, https://analysis.windows.net/powerbi/api, ${DESKTOP_CLIENT_ID}";Initial Catalog=sobe_wowvirtualserver-${datasetId};Integrated Security=ClaimsToken`,
        ConnectionType: "pbiServiceLive",
        PbiServiceModelId: 0,
        PbiModelVirtualServerName: "sobe_wowvirtualserver",
        PbiModelDatabaseName: datasetId,
      },
    ],
  };
  const parts = ["Version", "Report/Layout", "Settings", "Metadata", "Connections"];
  const contentTypes = `<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="" />${parts
    .map((part) => `<Override PartName="/${part}" ContentType="" />`)
    .join("")}</Types>`;

  return zipSync({
    "[Content_Types].xml": strToU8(contentTypes),
    Version: utf16("1.28"),
    "Report/Layout": utf16(JSON.stringify(layout)),
    Settings: utf16(JSON.stringify({ Version: 4, ReportSettings: {}, QueriesSettings: { TypeDetectionEnabled: true, RelationshipImportEnabled: true } })),
    Metadata: utf16(JSON.stringify({ Version: 5, AutoCreatedRelationships: [], CreatedFrom: "Cloud", CreatedFromRelease: "2024.06" })),
    Connections: strToU8(JSON.stringify(connections)),
  });
}
