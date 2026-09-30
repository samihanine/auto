import type { CellValue, FieldSchema, Row, TableSchema } from "./schemas";
import { getColumns } from "./schemas";
import type { SheetLayout } from "./xlsx";
import { fileExists, fileName, readTable, writeTable } from "./xlsx";

type RowInput = Record<string, unknown>;

/**
 * In-memory tables backed by one Excel file each.
 * Every mutation is validated, applied, then written to disk before resolving.
 */
export class Database {
  private data = new Map<string, Row[]>();
  private layouts = new Map<string, SheetLayout>();
  private listeners = new Set<() => void>();
  private writes = Promise.resolve();

  constructor(
    readonly dir: FileSystemDirectoryHandle,
    readonly tables: TableSchema[],
  ) {}

  /** Creates missing files, loads every table and rewrites files whose schema is outdated. */
  async load() {
    for (const table of this.tables) {
      if (!(await fileExists(this.dir, fileName(table))))
        await writeTable(this.dir, table, []);
      const { rows, layout, outdated } = await readTable(this.dir, table);
      this.data.set(table.name, rows);
      this.layouts.set(table.name, layout);
      if (outdated) await writeTable(this.dir, table, rows, layout);
    }
    this.emit();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  table(name: string) {
    const table = this.tables.find((t) => t.name === name);
    if (!table) throw new Error(`Unknown table "${name}"`);
    return table;
  }

  rows = (name: string): Row[] => this.data.get(name) ?? [];

  path = (name: string) => `${this.dir.name}/${fileName(this.table(name))}`;

  async insert(name: string, inputs: RowInput[]) {
    const table = this.table(name);
    let nextId = Math.max(0, ...this.rows(name).map((row) => row.id)) + 1;
    const created = inputs.map((input) => Object.assign({ id: nextId++ }, normalize(table, input)));
    await this.commit(table, [...this.rows(name), ...created]);
    return created;
  }

  /** Replaces whole rows, matched by id. */
  async update(name: string, inputs: RowInput[]) {
    const table = this.table(name);
    const updates = new Map(
      inputs.map((input) => [Number(input.id), normalize(table, input)]),
    );
    for (const id of updates.keys())
      if (!this.rows(name).some((row) => row.id === id))
        throw new Error(`Row id ${id} not found in "${name}"`);
    await this.commit(
      table,
      this.rows(name).map((row) => Object.assign({ id: row.id }, updates.get(row.id) ?? row)),
    );
  }

  /** Inserts or updates rows matched on the table key (e.g. a Power BI id). */
  async upsert(name: string, inputs: RowInput[]) {
    const { key } = this.table(name);
    const byKey = new Map(this.rows(name).map((row) => [String(row[key]), row]));
    const existing = inputs.filter((input) => byKey.has(String(input[key])));
    const created = inputs.filter((input) => !byKey.has(String(input[key])));
    if (existing.length)
      await this.update(name, existing.map((input) => ({ ...byKey.get(String(input[key])), ...input })));
    if (created.length) await this.insert(name, created);
  }

  async delete(name: string, ids: number[]) {
    const table = this.table(name);
    const missing = ids.filter((id) => !this.rows(name).some((row) => row.id === id));
    if (missing.length) throw new Error(`Row ids ${missing.join(", ")} not found`);
    await this.commit(table, this.rows(name).filter((row) => !ids.includes(row.id)));
    // Ids can be reused later: drop the preserved extra cells of deleted rows.
    for (const id of ids) this.layouts.get(name)?.extras.delete(id);
  }

  private async commit(table: TableSchema, rows: Row[]) {
    const names = new Set<string>();
    for (const row of rows) {
      const key = String(row.name ?? "").trim().toLowerCase();
      if (!key) continue; // rows typed in Excel without a name
      if (names.has(key)) throw new Error(`Duplicate name "${row.name}" in "${table.name}"`);
      names.add(key);
    }
    this.data.set(table.name, rows);
    this.emit();
    const write = this.writes.then(() =>
      writeTable(this.dir, table, rows, this.layouts.get(table.name)),
    );
    this.writes = write.catch(() => {});
    await write;
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}

/** Coerces raw input to column types and checks required / option values (id excluded). */
function normalize(table: TableSchema, input: RowInput): Row {
  const row = Object.fromEntries(
    getColumns(table)
      .filter((column) => column.name !== "id")
      .map((column) => [column.name, coerce(column, input[column.name])]),
  ) as Row;
  for (const column of table.columns)
    if (column.required && (row[column.name] === null || row[column.name] === ""))
      throw new Error(`"${column.name}" is required in "${table.name}"`);
  if (!row.name) throw new Error(`"name" is required in "${table.name}"`);
  return row;
}

function coerce(column: FieldSchema, value: unknown): CellValue {
  if (column.multiple) {
    const list = Array.isArray(value) ? value : value ? String(value).split(/\s*[;,]\s*/) : [];
    return list.map((item) => checkOption(column, String(item).trim())).filter(Boolean);
  }
  if (value === null || value === undefined || value === "")
    return column.dataType === "boolean" ? false : null;
  switch (column.dataType) {
    case "number": {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(`"${column.name}" must be a number`);
      return number;
    }
    case "boolean":
      return value === true || /^(true|yes|1)$/i.test(String(value));
    case "date": {
      const text = String(value).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
        throw new Error(`"${column.name}" must be a YYYY-MM-DD date`);
      return text;
    }
    case "json":
      return typeof value === "string" ? value : JSON.stringify(value);
    default:
      return checkOption(column, String(value));
  }
}

function checkOption(column: FieldSchema, value: string) {
  if (column.dataType !== "option" || !value) return value;
  const option = column.options.find((o) => o.name.toLowerCase() === value.toLowerCase());
  if (!option)
    throw new Error(
      `"${value}" is not a valid option for "${column.name}" (${column.options.map((o) => o.name).join(", ")})`,
    );
  return option.name;
}
