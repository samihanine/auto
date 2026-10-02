import { ExcelTable } from "@repo/microsoft-auth/excel";
import type { ChatExcel } from "@repo/ui/components/chat-frame";

export type OpenExcel = ChatExcel & { name: string; table: ExcelTable };

const opened = new Map<string, Promise<ExcelTable>>();

/** Opens the Excel tables given to the chat (cached per URL). Names default to the file name. */
export async function openExcels(excels: ChatExcel[]): Promise<OpenExcel[]> {
  return Promise.all(
    excels.map(async (excel) => {
      if (!opened.has(excel.url)) opened.set(excel.url, ExcelTable.open(excel.url));
      const table = await opened.get(excel.url)!.catch((error: unknown) => {
        opened.delete(excel.url);
        throw error;
      });
      return { ...excel, table, name: excel.name ?? table.item.name.replace(/\.xlsx?$/i, "") };
    }),
  );
}

export function findExcel(excels: OpenExcel[], name: string, access?: "write") {
  const excel = excels.find((e) => e.name === name);
  if (!excel) throw new Error(`Unknown excel "${name}" (available: ${excels.map((e) => e.name).join(", ")})`);
  if (access === "write" && excel.access !== "write") throw new Error(`Excel "${name}" is read-only`);
  return excel;
}
