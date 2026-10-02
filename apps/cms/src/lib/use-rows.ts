import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TIMING } from "@repo/config";
import { ExcelTable } from "@repo/microsoft-auth/excel";
import { findStructure } from "@repo/tables";
import type { Row, TableSchema } from "@repo/tables/schema";
import { columnFormulas, excelColumns, fromRecord, toRecord } from "@repo/tables/schema";
import type { Source } from "./store";

const tables = new Map<string, Promise<ExcelTable>>();

/** Opens the source's Excel table, creating it / its missing columns from the structure. */
export function openSource(source: Source, table: TableSchema) {
  const key = `${source.url}|${table.name}`;
  if (!tables.has(key))
    tables.set(
      key,
      ExcelTable.open(source.url, { name: table.name, columns: excelColumns(table) }).catch((error: unknown) => {
        tables.delete(key);
        throw error;
      }),
    );
  return tables.get(key)!;
}

export const rowsKey = (source: Source) => ["rows", source.url] as const;

/** Rows of a source (polled, so changes made by the assistant or other apps show up) + mutations. */
export function useRows(source: Source) {
  const client = useQueryClient();
  const table = findStructure(source.structure)!;
  const query = useQuery({
    queryKey: rowsKey(source),
    queryFn: async () => {
      const { records } = await (await openSource(source, table)).records();
      return records.map((record) => fromRecord(table, record)).filter((row) => row.id || row.name);
    },
    refetchInterval: TIMING.cmsRefresh,
  });

  const mutation = useMutation({
    mutationFn: async (action: { insert?: Partial<Row>; update?: Partial<Row>; delete?: number }) => {
      const excel = await openSource(source, table);
      if (action.insert) {
        const [created] = await excel.insertRecords([toRecord(table, action.insert)], columnFormulas(table));
        return { ...action.insert, id: Number(created.id) } as Row;
      }
      if (action.update) await excel.updateRecords([toRecord(table, action.update)]);
      if (action.delete !== undefined) await excel.deleteRecords([action.delete]);
      return null;
    },
    // Show the change right away; the full re-read happens in the background.
    onSuccess: (created, action) => {
      client.setQueryData<Row[]>(rowsKey(source), (rows = []) => {
        if (created) return [...rows, created];
        if (action.update) return rows.map((row) => (row.id === action.update!.id ? ({ ...row, ...action.update } as Row) : row));
        return rows.filter((row) => row.id !== action.delete);
      });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: rowsKey(source) });
    },
  });

  return {
    table,
    rows: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    insert: async (row: Partial<Row>) => (await mutation.mutateAsync({ insert: row }))!.id,
    update: (row: Partial<Row>) => mutation.mutateAsync({ update: row }),
    remove: (id: number) => mutation.mutateAsync({ delete: id }),
  };
}
