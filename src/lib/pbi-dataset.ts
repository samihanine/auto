import type { Database } from "./crud-table";
import type { DatasetRef } from "./pbi-api";
import { executeQuery, parseDatasetUrl } from "./pbi-api";
import { datasetTable } from "@/table/dataset";

export type DatasetModel = {
  tables: {
    name: string;
    description?: string;
    columns: { name: string; dataType: string; description?: string }[];
    measures: { name: string; expression: string; formatString?: string; description?: string }[];
  }[];
  relationships: { from: string; to: string; active: boolean }[];
};

type InfoRow = Record<string, unknown>;
const text = (row: InfoRow, key: string) => (row[key] === null || row[key] === undefined ? undefined : String(row[key]));
const visible = (row: InfoRow) => row.IsHidden !== true;

/**
 * Reads the model with INFO.VIEW.* DAX functions (executeQueries only): works with Build/Read
 * permission on the dataset, without workspace membership or metadata APIs.
 */
export async function readModel(ref: DatasetRef): Promise<DatasetModel> {
  const query = (fn: string) => executeQuery(ref, `EVALUATE ${fn}()`);
  const [tables, columns, measures, relationships] = await Promise.all([
    query("INFO.VIEW.TABLES"),
    query("INFO.VIEW.COLUMNS"),
    query("INFO.VIEW.MEASURES"),
    query("INFO.VIEW.RELATIONSHIPS").catch(() => [] as InfoRow[]),
  ]);

  return {
    tables: tables.filter(visible).map((table) => {
      const name = String(table.Name);
      return {
        name,
        description: text(table, "Description"),
        columns: columns
          .filter((c) => c.Table === name && visible(c) && !String(c.Name).startsWith("RowNumber-"))
          .map((c) => ({ name: String(c.Name), dataType: String(c.DataType ?? ""), description: text(c, "Description") })),
        measures: measures
          .filter((m) => m.Table === name && visible(m))
          .map((m) => ({
            name: String(m.Name),
            expression: String(m.Expression ?? ""),
            formatString: text(m, "FormatString"),
            description: text(m, "Description"),
          })),
      };
    }),
    relationships: relationships.map((r) => ({
      from: `${r.FromTable}[${r.FromColumn}]`,
      to: `${r.ToTable}[${r.ToColumn}]`,
      active: r.IsActive !== false,
    })),
  };
}

/** Imports (or refreshes) a dataset row from a link or an id. */
export async function importDataset(db: Database, url: string, name?: string) {
  const ref = parseDatasetUrl(url);
  const model = await readModel(ref);
  const existing = db.rows(datasetTable.name).find((row) => row.powerBiDatasetId === ref.datasetId);
  await db.upsert(datasetTable.name, [
    {
      powerBiDatasetId: ref.datasetId,
      powerBiGroupId: ref.groupId ?? null,
      name: name?.trim() || existing?.name || `Dataset ${ref.datasetId.slice(0, 8)}`,
      url,
      model: JSON.stringify(model),
      importedAt: new Date().toLocaleDateString("en-CA"),
    },
  ]);
  return { ref, model };
}

/** Dataset ref + model of a dataset row. */
export function datasetOf(db: Database, datasetId: string) {
  const row = db.rows(datasetTable.name).find((r) => r.powerBiDatasetId === datasetId);
  const ref: DatasetRef = { datasetId, groupId: row?.powerBiGroupId ? String(row.powerBiGroupId) : undefined };
  let model: DatasetModel | undefined;
  try {
    model = row?.model ? JSON.parse(String(row.model)) : undefined;
  } catch {
    model = undefined;
  }
  return { row, ref, model };
}
