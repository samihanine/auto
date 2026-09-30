import type { Row, TableSchema } from "@/lib/schemas";
import { OptionValues } from "@/components/select-option";
import { ShareCheckbox } from "@/components/share-checkbox";

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
        <div
          key={row.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(row.id)}
          onKeyDown={(e) => e.key === "Enter" && onSelect(row.id)}
          data-selected={row.id === selectedId}
          className="relative flex min-h-24 cursor-default flex-col items-start gap-3 rounded-xl border bg-card p-3.5 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all hover:-translate-y-px hover:shadow-md data-[selected=true]:border-primary/50 data-[selected=true]:ring-3 data-[selected=true]:ring-primary/15"
        >
          <span className="absolute top-3 right-3">
            <ShareCheckbox table={table.name} id={row.id} />
          </span>
          <span className="line-clamp-2 pr-6 text-sm font-medium">{row.name}</span>
          <div className="mt-auto flex flex-wrap gap-1">
            {optionColumns.map((column) => (
              <OptionValues key={column.name} column={column} value={row[column.name]} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
