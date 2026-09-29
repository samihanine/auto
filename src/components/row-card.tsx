import type { Row, TableSchema } from "@/lib/schemas";
import { OptionValues } from "@/components/select-option";

export function RowCards({
  table,
  rows,
  selectedId,
  onSelect,
}: {
  table: TableSchema;
  rows: Row[];
  selectedId?: number;
  onSelect: (id: number) => void;
}) {
  const optionColumns = table.columns.filter((column) => column.dataType === "option");

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-4">
      {rows.map((row) => (
        <button
          key={row.id}
          onClick={() => onSelect(row.id)}
          data-selected={row.id === selectedId}
          className="flex min-h-24 flex-col items-start gap-3 rounded-xl border bg-card p-3.5 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all hover:-translate-y-px hover:shadow-md data-[selected=true]:border-primary/50 data-[selected=true]:ring-3 data-[selected=true]:ring-primary/15"
        >
          <span className="line-clamp-2 text-sm font-medium">{row.name}</span>
          <div className="mt-auto flex flex-wrap gap-1">
            {optionColumns.map((column) => (
              <OptionValues key={column.name} column={column} value={row[column.name]} />
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
