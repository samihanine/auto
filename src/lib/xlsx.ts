import ExcelJS from "exceljs";
import type { CellValue, FieldSchema, Row, TableSchema } from "./schemas";
import { getColumns } from "./schemas";
import { boldRuns } from "./utils";
import { styleSheet } from "./xlsx-style";

export const fileName = (table: TableSchema) => `${table.name}.xlsx`;

/** Fingerprint of the schema, stored in the file properties to detect schema changes. */
function schemaSignature(table: TableSchema) {
  let hash = 5381;
  for (const char of JSON.stringify(getColumns(table))) hash = Math.imul(hash, 33) ^ char.charCodeAt(0);
  return `schema:${(hash >>> 0).toString(36)}`;
}

export async function fileExists(dir: FileSystemDirectoryHandle, name: string) {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Column order of the file plus values of columns unknown to the schema,
 * kept by row id so they survive rewrites untouched.
 */
export type SheetLayout = {
  headers: string[];
  extras: Map<number, Record<string, ExcelJS.CellValue>>;
};

/** Reads a table file; headers are matched by name, missing ids are assigned. */
export async function readTable(dir: FileSystemDirectoryHandle, table: TableSchema) {
  const file = await (await dir.getFileHandle(fileName(table))).getFile();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet(table.name) ?? workbook.worksheets[0];

  const headers = new Map<string, number>();
  sheet?.getRow(1).eachCell((cell, col) => {
    const header = cellText(cell.value).trim();
    if (header && !headers.has(header)) headers.set(header, col);
  });

  const columns = getColumns(table);
  const extraHeaders = [...headers.keys()].filter((h) => !columns.some((c) => c.name === h));
  const entries: { row: Row; extra: Record<string, ExcelJS.CellValue> }[] = [];
  for (let r = 2; sheet && r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    const raw = (header: string) => {
      const col = headers.get(header);
      return col ? excelRow.getCell(col).value : null;
    };
    const row = Object.fromEntries(
      columns.map((column) => [column.name, fromCell(raw(column.name), column)]),
    ) as Row;
    const extra = Object.fromEntries(extraHeaders.map((header) => [header, raw(header)]));
    // Booleans read as false when empty: they alone don't make a row (e.g. the placeholder row).
    const hasData =
      columns.some((column) => column.dataType !== "boolean" && !isEmpty(row[column.name])) ||
      extraHeaders.some((header) => cellText(extra[header]) !== "");
    if (hasData) entries.push({ row, extra });
  }

  let nextId = Math.max(0, ...entries.map(({ row }) => row.id ?? 0)) + 1;
  for (const { row } of entries) if (!row.id) row.id = nextId++;

  const layout: SheetLayout = {
    headers: mergeHeaders([...headers.keys()], columns),
    extras: new Map(entries.map(({ row, extra }) => [row.id, extra])),
  };
  // Rewrite when a column is missing or the schema changed (options, colors, types…).
  const outdated =
    columns.some((column) => !headers.has(column.name)) ||
    workbook.keywords !== schemaSignature(table);
  return { rows: entries.map(({ row }) => row), layout, outdated };
}

/** Rewrites the whole file as a single Excel table starting at A1. */
export async function writeTable(
  dir: FileSystemDirectoryHandle,
  table: TableSchema,
  rows: Row[],
  layout?: SheetLayout,
) {
  const columns = getColumns(table);
  const headers = mergeHeaders(layout?.headers ?? [], columns);
  const columnOf = (header: string) => columns.find((column) => column.name === header);
  const workbook = new ExcelJS.Workbook();
  workbook.keywords = schemaSignature(table);
  const sheet = workbook.addWorksheet(table.name);

  sheet.addTable({
    name: table.name.replace(/\W/g, "_"),
    ref: "A1",
    headerRow: true,
    // Light1 without stripes: no body fill; header fill and outer border come from styleSheet.
    style: { theme: "TableStyleLight1", showRowStripes: false },
    columns: headers.map((name) => ({ name, filterButton: true })),
    // An Excel table needs at least one data row to stay valid.
    rows: rows.length
      ? rows.map((row) =>
          headers.map((header) => {
            const column = columnOf(header);
            return column
              ? toCell(row[header], column)
              : (layout?.extras.get(row.id)?.[header] ?? null);
          }),
        )
      : [headers.map(() => null)],
  });

  styleSheet(sheet, headers, columnOf, rows.length);

  const buffer = await workbook.xlsx.writeBuffer();
  const handle = await dir.getFileHandle(fileName(table), { create: true });
  const writable = await handle.createWritable();
  await writable.write(buffer);
  await writable.close();
}

/** Keeps the file's column order and inserts missing schema columns right after their schema predecessor. */
function mergeHeaders(existing: string[], columns: FieldSchema[]) {
  const headers = [...existing];
  columns.forEach((column, index) => {
    if (headers.includes(column.name)) return;
    const previous = columns
      .slice(0, index)
      .reverse()
      .find((other) => headers.includes(other.name));
    headers.splice(previous ? headers.indexOf(previous.name) + 1 : 0, 0, column.name);
  });
  return headers;
}

const isEmpty = (value: CellValue) =>
  value === null || value === "" || (Array.isArray(value) && !value.length);

function cellText(value: ExcelJS.CellValue, keepBold = false): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "object") return String(value);
  if ("richText" in value)
    return value.richText
      .map((run) => (keepBold && run.font?.bold ? `**${run.text}**` : run.text))
      .join("");
  if ("text" in value) return String(value.text);
  if ("result" in value) return cellText(value.result);
  return "";
}

function fromCell(value: ExcelJS.CellValue, column: FieldSchema): CellValue {
  const text = cellText(value, column.dataType === "text").trim();
  if (column.multiple) return text ? text.split(/\s*[;,]\s*/).filter(Boolean) : [];
  if (!text) return column.dataType === "boolean" ? false : null;
  switch (column.dataType) {
    case "number": {
      const number = Number(text);
      return Number.isFinite(number) ? number : null;
    }
    case "boolean":
      return /^(true|yes|1|x)$/i.test(text);
    default:
      return text;
  }
}

function toCell(value: CellValue, column: FieldSchema): ExcelJS.CellValue {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.join("; ");
  if (column.dataType === "date" && typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(+date) ? value : date;
  }
  if (column.dataType === "text" && typeof value === "string" && value.includes("**"))
    return {
      richText: boldRuns(value).map(({ text, bold }) =>
        bold ? { text, font: { bold: true } } : { text },
      ),
    };
  return value;
}
