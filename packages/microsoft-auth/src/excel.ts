import type { DriveItem } from "./graph";
import { GraphError, graphFetch, resolveLink } from "./graph";

export type CellValue = string | number | boolean | null;
export type ExcelColumn = { name: string; formula?: string };
/** A table row as an object keyed by header. */
export type ExcelRecord = Record<string, CellValue>;

const column = (n: number): string => (n < 26 ? String.fromCharCode(65 + n) : column(Math.floor(n / 26) - 1) + column(n % 26));
const isBlank = (row: CellValue[]) => row.every((v) => v === null || v === "");
const isFormula = (value: CellValue) => typeof value === "string" && value.startsWith("=");
/** Graph rejects null cells when writing values (InvalidArgument): empty cells are "". */
const cells = (rows: CellValue[][]) => rows.map((row) => row.map((value) => value ?? ""));

/** "Sheet1!A1:L4" / "'My sheet'!$A$1:$L$4" → sheet, first column, first row, last column. */
function parseAddress(address: string) {
  const match = address.match(/^(?:'?(.+?)'?!)?\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?\d+$/);
  if (!match) throw new Error(`Unexpected table address "${address}"`);
  const [, sheet = "", firstColumn, firstRow, lastColumn] = match;
  return { sheet: sheet.replace(/''/g, "'"), firstColumn, firstRow: Number(firstRow), lastColumn };
}

type Range = { values: CellValue[][]; formulas: CellValue[][]; address: string };

/**
 * One Excel table of a OneDrive / SharePoint workbook, through the Graph Excel API
 * (row-level reads and writes, safe while the file is open in Excel).
 * Calls share a persistent workbook session (much faster than session-less calls).
 */
export class ExcelTable {
  private session: Promise<string | null> | null = null;
  /** Table address (header included) from the last read, to locate rows without an extra call. */
  private address: ReturnType<typeof parseAddress> | null = null;

  private constructor(
    readonly item: DriveItem,
    private readonly workbook: string,
    private readonly base: string,
    readonly tableName: string,
  ) {}

  /** Opens the first table of the workbook (creates it with `columns` when there is none). */
  static async open(url: string, { name, columns = [] }: { name?: string; columns?: ExcelColumn[] } = {}) {
    const item = await resolveLink(url);
    const workbook = `/drives/${item.parentReference.driveId}/items/${item.id}/workbook`;
    const { value: tables } = await graphFetch<{ value: { id: string; name: string }[] }>(`${workbook}/tables`);
    let table = tables[0];
    if (!table) {
      if (!columns.length) throw new Error(`"${item.name}" has no Excel table`);
      table = await createTable(workbook, name ?? "Table1", columns);
    }
    const excel = new ExcelTable(item, workbook, `${workbook}/tables/${encodeURIComponent(table.id)}`, table.name);
    if (columns.length) await excel.ensureColumns(columns);
    return excel;
  }

  /** Graph call inside the workbook session; a lost session is recreated once. */
  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    this.session ??= graphFetch<{ id: string }>(`${this.workbook}/createSession`, {
      method: "POST",
      body: JSON.stringify({ persistChanges: true }),
    }).then(
      (session) => session.id,
      () => null, // sessions unavailable: plain (slower) calls still work
    );
    const id = await this.session;
    try {
      return await graphFetch<T>(path, { ...init, headers: { ...init.headers, ...(id ? { "workbook-session-id": id } : {}) } });
    } catch (error) {
      if (!retry || !id || !(error instanceof GraphError) || !/session/i.test(error.code + error.message)) throw error;
      this.session = null;
      return this.request<T>(path, init, false);
    }
  }

  /** Header + data rows (computed values) + formulas. A single blank data row counts as no rows. */
  async read() {
    const range = await this.request<Range>(`${this.base}/range?$select=values,formulas,address`);
    this.address = parseAddress(range.address);
    const [headers = [], ...rows] = range.values;
    const blank = rows.length === 1 && isBlank(rows[0]);
    return {
      headers: headers.map(String),
      rows: blank ? [] : rows,
      formulas: blank ? [] : range.formulas.slice(1),
      /** The new-table placeholder row, filled instead of appending after it. */
      blank,
    };
  }

  /** Rows as objects. Cells holding a formula (e.g. =IMAGE()) are listed in `formulaColumns`. */
  async records() {
    const read = await this.read();
    const { headers, rows, formulas } = read;
    const formulaColumns = headers.filter((_, c) => formulas.some((row) => isFormula(row[c] ?? null)));
    const records = rows.map((row) => Object.fromEntries(headers.map((h, c) => [h, row[c] ?? null])) as ExcelRecord);
    return { ...read, records, formulaColumns };
  }

  /** Appends records; assigns ids (max + 1) when the table has an "id" column. */
  async insertRecords(inputs: ExcelRecord[], columnFormulas: Record<string, string> = {}) {
    const { headers, records, formulas, blank } = await this.records();
    let nextId = Math.max(0, ...records.map((r) => Number(r.id) || 0)) + 1;
    const created = inputs.map((input) => (headers.includes("id") ? { ...input, id: nextId++ } : input));
    // Formula columns reuse the formula of the first row (structured refs like [@x] are row-relative).
    const formulaOf = (c: number) =>
      columnFormulas[headers[c]] ?? (isFormula(formulas[0]?.[c] ?? null) ? String(formulas[0][c]) : undefined);
    await this.append(
      created.map((record) => headers.map((h, c) => formulaOf(c) ?? record[h] ?? null)),
      records.length,
      blank,
    );
    return created;
  }

  /** Merges fields into rows matched by id; formula cells are kept. */
  async updateRecords(inputs: ExcelRecord[]) {
    const { headers, records, formulas } = await this.records();
    for (const input of inputs) {
      const index = records.findIndex((r) => String(r.id) === String(input.id));
      if (index === -1) throw new Error(`Row id ${String(input.id)} not found`);
      const merged = { ...records[index], ...input };
      await this.update(
        index,
        headers.map((h, c) => (isFormula(formulas[index]?.[c] ?? null) ? formulas[index][c] : merged[h])),
      );
    }
  }

  async deleteRecords(ids: (string | number)[]) {
    const { records } = await this.records();
    const indexes = ids.map((id) => {
      const index = records.findIndex((r) => String(r.id) === String(id));
      if (index === -1) throw new Error(`Row id ${String(id)} not found`);
      return index;
    });
    // Highest first so the remaining indexes stay valid.
    for (const index of indexes.sort((a, b) => b - a))
      await this.request(`${this.base}/rows/$/ItemAt(index=${index})`, { method: "DELETE" });
  }

  /** Adds missing columns, each right after the column that precedes it in `columns`. */
  async ensureColumns(columns: ExcelColumn[]) {
    let { headers, rows } = await this.read();
    for (const [index, { name, formula }] of columns.entries()) {
      if (headers.includes(name)) continue;
      const previous = columns.slice(0, index).reverse().find((c) => headers.includes(c.name));
      const at = previous ? headers.indexOf(previous.name) + 1 : 0;
      await this.request(`${this.base}/columns/add`, {
        method: "POST",
        body: JSON.stringify({ index: at, values: cells([[name], ...rows.map(() => [formula ?? null])]) }),
      });
      this.address = null; // the table got wider
      headers = [...headers.slice(0, at), name, ...headers.slice(at)];
      rows = rows.map((row) => [...row.slice(0, at), null, ...row.slice(at)]);
    }
  }

  /** Appends rows after `count` existing ones (filling the placeholder row of a new table first). */
  private async append(rows: CellValue[][], count: number, blank: boolean) {
    if (blank && rows.length) {
      await this.update(0, rows[0]);
      rows = rows.slice(1);
      count = 1;
    }
    if (!rows.length) return;
    // Rows are added without formulas (Graph rejects them in `values`), then formulas are set.
    await this.request(`${this.base}/rows`, {
      method: "POST",
      body: JSON.stringify({ values: cells(rows.map((row) => row.map((v) => (isFormula(v) ? "" : v)))) }),
    });
    for (const [offset, row] of rows.entries()) if (row.some(isFormula)) await this.update(count + offset, row);
  }

  /**
   * Writes a data row through its worksheet address — Graph rejects writes on the range of a
   * table row obtained with itemAt(). Uses `formulas` (constants + formulas, the documented way
   * to set formulas); if Graph still refuses a formula, the data is saved without it.
   */
  private async update(index: number, values: CellValue[]) {
    if (!this.address) await this.read();
    const { sheet, firstColumn, firstRow, lastColumn } = this.address!;
    const row = firstRow + 1 + index; // the table's first row is the header
    const range = `${this.workbook}/worksheets/${encodeURIComponent(sheet)}/range(address='${firstColumn}${row}:${lastColumn}${row}')`;
    try {
      await this.request(range, { method: "PATCH", body: JSON.stringify({ formulas: cells([values]) }) });
    } catch (error) {
      if (!values.some(isFormula)) throw error;
      console.warn("Formula rejected by Excel, row saved without it:", error);
      await this.request(range, {
        method: "PATCH",
        body: JSON.stringify({ values: cells([values.map((v) => (isFormula(v) ? "" : v))]) }),
      });
    }
  }
}

async function createTable(workbook: string, name: string, columns: ExcelColumn[]) {
  const { value: sheets } = await graphFetch<{ value: { name: string }[] }>(`${workbook}/worksheets?$select=name`);
  const sheet = sheets[0].name.replace(/'/g, "''");
  // Header only: Excel adds one blank data row itself.
  const address = `A1:${column(columns.length - 1)}1`;
  await graphFetch(`${workbook}/worksheets/${encodeURIComponent(sheets[0].name)}/range(address='${address}')`, {
    method: "PATCH",
    body: JSON.stringify({ values: [columns.map((c) => c.name)] }),
  });
  const table = await graphFetch<{ id: string; name: string }>(`${workbook}/tables/add`, {
    method: "POST",
    body: JSON.stringify({ address: `'${sheet}'!${address}`, hasHeaders: true }),
  });
  return graphFetch<{ id: string; name: string }>(`${workbook}/tables/${encodeURIComponent(table.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name: name.replace(/\W/g, "_") }),
  }).catch(() => table);
}
