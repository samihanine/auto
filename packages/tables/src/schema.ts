import { z } from "zod";
import type { CellValue, ExcelColumn, ExcelRecord } from "@repo/microsoft-auth/excel";
import { OPTION_COLORS } from "@repo/ui/components/option-badge";

export const fieldSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  description: z.string().default(""),
  dataType: z.enum(["string", "text", "number", "boolean", "option", "date", "url", "image"]).default("string"),
  options: z
    .array(z.object({ value: z.string(), label: z.string().optional(), color: z.enum(OPTION_COLORS).default("gray") }))
    .default([]),
  required: z.boolean().default(false),
  multiple: z.boolean().default(false),
});

export const tableSchema = z.object({
  name: z.string(),
  label: z.string(),
  description: z.string().default(""),
  columns: z.array(fieldSchema),
});

export type FieldSchema = z.infer<typeof fieldSchema>;
export type TableSchema = z.infer<typeof tableSchema>;
export type Value = string | number | boolean | string[] | null;
export type Row = { id: number; name: string; [field: string]: Value };

export const fieldLabel = (field: FieldSchema) => field.label ?? field.name.replace(/_/g, " ");
export const optionLabel = (field: FieldSchema, value: string) =>
  field.options.find((o) => o.value === value)?.label ?? value;

const urlColumn = (field: FieldSchema) => `${field.name}_url`;

/** Excel columns: id, then each field — an image field is `{name}` (=IMAGE formula) + `{name}_url`. */
export const excelColumns = (table: TableSchema): ExcelColumn[] => [
  { name: "id" },
  ...table.columns.flatMap((field) =>
    field.dataType === "image"
      ? [{ name: field.name, formula: `=IF([@${urlColumn(field)}]="","",IMAGE([@${urlColumn(field)}]))` }, { name: urlColumn(field) }]
      : [{ name: field.name }],
  ),
];

/** Formulas of the image columns, applied to new rows. */
export const columnFormulas = (table: TableSchema) =>
  Object.fromEntries(excelColumns(table).flatMap((c) => (c.formula ? [[c.name, c.formula]] : [])));

const splitList = (value: CellValue) =>
  value === null || value === "" ? [] : String(value).split(/\s*;\s*/).filter(Boolean);

/** Excel record → typed row. */
export function fromRecord(table: TableSchema, record: ExcelRecord): Row {
  const row: Row = { id: Number(record.id), name: String(record.name ?? "") };
  for (const field of table.columns) {
    const raw = field.dataType === "image" ? record[urlColumn(field)] : record[field.name];
    if (field.multiple) row[field.name] = splitList(raw ?? null);
    else if (raw === null || raw === undefined || raw === "") row[field.name] = field.dataType === "boolean" ? false : null;
    else if (field.dataType === "number") row[field.name] = Number(raw);
    else if (field.dataType === "boolean") row[field.name] = raw === true || /^(true|yes|1)$/i.test(String(raw));
    else if (field.dataType === "date" && typeof raw === "number") row[field.name] = excelDate(raw);
    else row[field.name] = String(raw);
  }
  return row;
}

/** Typed row → Excel record (image values go to `{name}_url`). */
export function toRecord(table: TableSchema, row: Partial<Row>): ExcelRecord {
  const record: ExcelRecord = {};
  for (const field of table.columns) {
    if (!(field.name in row)) continue;
    const value = row[field.name] ?? null;
    record[field.dataType === "image" ? urlColumn(field) : field.name] = Array.isArray(value) ? value.join("; ") : value;
  }
  if (row.id !== undefined) record.id = row.id;
  return record;
}

/** Excel serial date → YYYY-MM-DD. */
const excelDate = (serial: number) => new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10);

/** Checks required fields, option values and unique names; returns the first problem. */
export function validate(table: TableSchema, row: Partial<Row>, rows: Row[]): string | null {
  const name = String(row.name ?? "").trim();
  if (!name) return "Name is required";
  if (rows.some((other) => other.id !== row.id && other.name.trim().toLowerCase() === name.toLowerCase()))
    return `"${name}" already exists`;
  for (const field of table.columns) {
    const value = row[field.name];
    const empty = value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length);
    if (field.required && empty) return `${fieldLabel(field)} is required`;
    if (field.dataType === "option" && !empty)
      for (const v of [value].flat())
        if (!field.options.some((o) => o.value === v)) return `"${String(v)}" is not a valid ${fieldLabel(field)}`;
  }
  return null;
}

/** Short schema description for the assistant. */
export const describeTable = (table: TableSchema) =>
  [
    `${table.label}: ${table.description}`,
    ...table.columns.map((field) =>
      [
        `  - ${field.dataType === "image" ? `${field.name}_url` : field.name} (${field.dataType}${field.multiple ? ", multiple \"a; b\"" : ""}${field.required ? ", required" : ""})`,
        field.description,
        field.options.length && `options: ${field.options.map((o) => (o.label ? `${o.value} (${o.label})` : o.value)).join(" | ")}`,
      ]
        .filter(Boolean)
        .join(" — "),
    ),
  ].join("\n");
