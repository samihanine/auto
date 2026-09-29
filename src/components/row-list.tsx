import type { FieldSchema, Row, TableSchema } from "@/lib/schemas";
import { getColumns } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { ImagePreview } from "@/components/image-preview";
import { OptionValues } from "@/components/select-option";

const VISIBLE = ["string", "option", "image"];

export function RowList({
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
  const columns = getColumns(table).filter(
    (column) => column.name === "id" || VISIBLE.includes(column.dataType),
  );

  return (
    <table className="w-full border-separate border-spacing-0 text-[13px]">
      <thead className="sticky top-0 z-10 bg-background/85 backdrop-blur">
        <tr>
          {columns.map((column) => (
            <th
              key={column.name}
              className="border-b px-4 py-2 text-left text-[11px] font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase"
            >
              {column.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onSelect(row.id)}
            data-selected={row.id === selectedId}
            className="group cursor-default transition-colors hover:bg-muted/60 data-[selected=true]:bg-primary/8"
          >
            {columns.map((column) => (
              <td
                key={column.name}
                className={cn(
                  "max-w-72 truncate border-b border-border/60 px-4 py-2.5",
                  column.name === "id" && "w-12 pr-0 text-muted-foreground tabular-nums",
                  column.name === "name" && "font-medium",
                )}
              >
                <Cell column={column} value={row[column.name]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Cell({ column, value }: { column: FieldSchema; value: unknown }) {
  if (column.dataType === "option") return <OptionValues column={column} value={value} />;
  if (column.dataType === "image")
    return value ? <ImagePreview value={String(value)} className="size-7" /> : null;
  return <>{[value].flat().filter(Boolean).join(", ")}</>;
}
