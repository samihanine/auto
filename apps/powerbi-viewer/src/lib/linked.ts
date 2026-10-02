import { TIMING } from "@repo/config";
import { useQuery } from "@tanstack/react-query";
import type { ExcelRecord } from "@repo/microsoft-auth/excel";
import { ExcelTable } from "@repo/microsoft-auth/excel";
import { parseReportUrl } from "@repo/microsoft-auth/powerbi";
import { dataTable, guideTable } from "@repo/tables";
import { excelColumns } from "@repo/tables/schema";

/** Guide and Data Excels follow the CMS structures. */
export const KINDS = {
  guide: { table: guideTable, text: "text", label: "Guide" },
  data: { table: dataTable, text: "description", label: "Data" },
} as const;
export type LinkedKind = keyof typeof KINDS;

const tables = new Map<string, Promise<ExcelTable>>();
/** Opens the Excel, creating its table / missing columns with the CMS structure. */
export function openLinkedExcel(url: string, kind: LinkedKind) {
  if (!tables.has(url)) {
    const { table } = KINDS[kind];
    tables.set(
      url,
      ExcelTable.open(url, { name: table.name, columns: excelColumns(table) }).catch((error: unknown) => {
        tables.delete(url);
        throw error;
      }),
    );
  }
  return tables.get(url)!;
}

export const linkedKey = (url: string) => ["linked", url];

/** Rows of a guide / data Excel (shared by the panels and the assistant context). */
export const useLinkedRows = (kind: LinkedKind, url: string) =>
  useQuery({
    queryKey: linkedKey(url),
    enabled: !!url,
    retry: 1,
    refetchInterval: TIMING.linkedRefresh,
    queryFn: async () => (await (await openLinkedExcel(url, kind)).records()).records,
  });

export const splitUrls = (cell: unknown) =>
  String(cell ?? "")
    .split(/\s*;\s*|\n/)
    .filter(Boolean);

export const parsed = (url: unknown) => {
  try {
    return parseReportUrl(String(url ?? ""));
  } catch {
    return undefined;
  }
};

const urlsOf = (row: ExcelRecord) => [row.report_url, row.page_url, ...splitUrls(row.visual_urls)].map(parsed);

/** Rows linked to a report (through their report, page or visual links). */
export const rowsOfReport = (rows: ExcelRecord[], reportId?: string) =>
  rows.filter((row) => reportId && urlsOf(row).some((ref) => ref?.reportId === reportId));

/** Pages a row belongs to: its page link and the pages of its visual links. */
export const pagesOfRow = (row: ExcelRecord) =>
  [...new Set(urlsOf(row).map((ref) => ref?.pageName).filter((name): name is string => !!name))];

export const visualIdsOfRow = (row: ExcelRecord) => splitUrls(row.visual_urls).map((url) => parsed(url)?.visualId);
