import ExcelJS from "exceljs";
import type { CellValue, FieldSchema, Row, TableSchema } from "./schemas";
import { getColumns } from "./schemas";
import { boldRuns } from "./utils";

export const fileName = (table: TableSchema) => `${table.name}.xlsx`;

export async function fileExists(dir: FileSystemDirectoryHandle, name: string) {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/** Reads a table file; headers are matched by name, missing ids are assigned. */
export async function readTable(
  dir: FileSystemDirectoryHandle,
  table: TableSchema,
): Promise<Row[]> {
  const file = await (await dir.getFileHandle(fileName(table))).getFile();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet(table.name) ?? workbook.worksheets[0];
  if (!sheet) return [];

  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    headers.set(cellText(cell.value).trim(), col);
  });

  const columns = getColumns(table);
  const rows: Row[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    const row = Object.fromEntries(
      columns.map((column) => {
        const col = headers.get(column.name);
        const raw = col ? excelRow.getCell(col).value : null;
        return [column.name, fromCell(raw, column)];
      }),
    ) as Row;
    if (columns.some((column) => !isEmpty(row[column.name]))) rows.push(row);
  }

  let nextId = Math.max(0, ...rows.map((row) => row.id ?? 0)) + 1;
  for (const row of rows) if (!row.id) row.id = nextId++;
  return rows;
}

/** Rewrites the whole file as a single Excel table starting at A1. */
export async function writeTable(
  dir: FileSystemDirectoryHandle,
  table: TableSchema,
  rows: Row[],
) {
  const columns = getColumns(table);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(table.name);

  sheet.addTable({
    name: table.name.replace(/\W/g, "_"),
    ref: "A1",
    headerRow: true,
    style: { theme: "TableStyleLight1", showRowStripes: true },
    columns: columns.map((column) => ({ name: column.name, filterButton: true })),
    // An Excel table needs at least one data row to stay valid.
    rows: rows.length
      ? rows.map((row) => columns.map((column) => toCell(row[column.name], column)))
      : [columns.map(() => null)],
  });

  columns.forEach((column, index) => {
    const excelColumn = sheet.getColumn(index + 1);
    excelColumn.width = column.name === "id" ? 8 : column.dataType === "text" ? 60 : 24;
    excelColumn.alignment = { vertical: "top", wrapText: column.dataType === "text" };
    if (column.dataType === "date") excelColumn.numFmt = "yyyy-mm-dd";
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const handle = await dir.getFileHandle(fileName(table), { create: true });
  const writable = await handle.createWritable();
  await writable.write(buffer);
  await writable.close();
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
  if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
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
