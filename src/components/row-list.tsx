import { useState } from "react";
import { useDatabase, useRows } from "@/lib/hooks";
import type { FieldSchema, Row, TableSchema } from "@/lib/schemas";
import { getColumns } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ImagePreview } from "@/components/image-preview";
import { OptionValues, referenceLabel } from "@/components/select-option";
import { ShareCheckbox, useShareAll } from "@/components/share-checkbox";

const VISIBLE = ["string", "option", "image"];
const MIN_WIDTH = 60;

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
  const [widths, resize] = useColumnWidths(table.name);
  const shareAll = useShareAll(table.name, rows);
  // A fixed-layout table only honours <col> widths when it has an explicit width.
  const width = 40 + columns.reduce((sum, column) => sum + (widths[column.name] ?? defaultWidth(column)), 0);

  return (
    <table
      className="table-fixed border-separate border-spacing-0 text-[13px]"
      style={{ width, minWidth: "100%" }}
    >
      <colgroup>
        <col style={{ width: 40 }} />
        {columns.map((column) => (
          <col key={column.name} style={{ width: widths[column.name] ?? defaultWidth(column) }} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-10 bg-background/85 backdrop-blur">
        <tr>
          <th className="border-b pl-4 text-left" title="Rows shared with the assistant">
            <Checkbox
              checked={shareAll.checked}
              indeterminate={shareAll.indeterminate}
              onCheckedChange={shareAll.toggle}
            />
          </th>
          {columns.map((column) => (
            <th
              key={column.name}
              className="group/th relative truncate border-b px-3 py-2 text-left text-[11px] font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase"
            >
              {column.name}
              <span
                onPointerDown={(e) => resize(e, column.name, e.currentTarget.parentElement!.offsetWidth)}
                className="absolute inset-y-1.5 right-0 w-1.5 cursor-col-resize rounded-full transition-colors group-hover/th:bg-border hover:bg-ring/60!"
              />
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
            className="cursor-default transition-colors hover:bg-muted/60 data-[selected=true]:bg-primary/8"
          >
            <td className="border-b border-border/60 pl-4">
              <ShareCheckbox table={table.name} id={row.id} />
            </td>
            {columns.map((column) => (
              <td
                key={column.name}
                className={cn(
                  "truncate border-b border-border/60 px-3 py-2.5",
                  column.name === "id" && "text-muted-foreground tabular-nums",
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

const defaultWidth = (column: FieldSchema) =>
  column.name === "id" ? 64 : column.dataType === "image" ? 90 : column.name === "name" ? 240 : 170;

/** Column widths per table, resized by dragging header edges; kept in localStorage. */
function useColumnWidths(table: string) {
  const key = `atelier:widths:${table}`;
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}");
    } catch {
      return {};
    }
  });

  const resize = (e: React.PointerEvent, column: string, startWidth: number) => {
    e.preventDefault();
    const startX = e.clientX;
    let latest = widths;
    const move = (event: PointerEvent) => {
      latest = { ...latest, [column]: Math.max(MIN_WIDTH, startWidth + event.clientX - startX) };
      setWidths(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem(key, JSON.stringify(latest));
      } catch {
        // storage unavailable: widths only last for this session
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return [widths, resize] as const;
}

function Cell({ column, value }: { column: FieldSchema; value: unknown }) {
  if (column.reference && value) return <ReferenceCell column={column} value={value} />;
  if (column.dataType === "option") return <OptionValues column={column} value={value} />;
  if (column.dataType === "image")
    return value ? <ImagePreview value={String(value)} className="size-7" /> : null;
  return <>{[value].flat().filter((v) => v !== null && v !== "").join(", ")}</>;
}

function ReferenceCell({ column, value }: { column: FieldSchema; value: unknown }) {
  const db = useDatabase();
  const target = db.table(column.reference!);
  const rows = useRows(db, target.name);
  return (
    <>
      {[value]
        .flat()
        .map((v) => referenceLabel(rows, target.key, String(v)))
        .join(", ")}
    </>
  );
}
