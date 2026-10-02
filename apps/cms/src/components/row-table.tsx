import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { ImageView } from "@repo/microsoft-auth/image-view";
import { useLocalState } from "@repo/storage/react";
import { Checkbox } from "@repo/ui/components/checkbox";
import { OptionBadge } from "@repo/ui/components/option-badge";
import { SearchSelect } from "@repo/ui/components/search-select";
import { cn } from "@repo/ui/lib/utils";
import type { Sort } from "@/lib/filters";
import { nextSort } from "@/lib/filters";
import type { FieldSchema, Row, Value } from "@repo/tables/schema";
import { fieldLabel } from "@repo/tables/schema";

/** Option values as colored badges (labels). */
export function OptionValues({ field, value }: { field: FieldSchema; value: unknown }) {
  return (
    <span className="flex flex-wrap gap-1">
      {[value]
        .flat()
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => {
          const option = field.options.find((o) => o.value === String(v)) ?? { value: String(v) };
          return <OptionBadge key={option.value} option={option} />;
        })}
    </span>
  );
}

const MIN_WIDTH = 60;
const defaultWidth = (field: FieldSchema | "id") =>
  field === "id" ? 64 : field.dataType === "image" ? 90 : field.name === "name" ? 240 : field.dataType === "text" ? 260 : 170;

/**
 * Table of the view's columns: sortable and resizable headers, simple fields edited in place
 * (text and image fields are read-only here, edited in the side form).
 */
export function RowTable({
  tableName,
  fields,
  rows,
  selectedId,
  onSelect,
  sort,
  onSortChange,
  onCellChange,
}: {
  tableName: string;
  fields: FieldSchema[];
  rows: Row[];
  selectedId?: number;
  onSelect: (id: number) => void;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  /** Inline editing of simple fields; omitted = read-only cells. */
  onCellChange?: (row: Row, field: FieldSchema, value: Value) => void;
}) {
  const [widths, setWidths] = useLocalState<Record<string, number>>(`cms:widths:${tableName}`, {});
  const width = (key: string, field: FieldSchema | "id") => widths[key] ?? defaultWidth(field);
  const total = width("id", "id") + fields.reduce((sum, f) => sum + width(f.name, f), 0);

  const resize = (e: React.PointerEvent, key: string, startWidth: number) => {
    e.preventDefault();
    const startX = e.clientX;
    const move = (event: PointerEvent) =>
      setWidths((w) => ({ ...w, [key]: Math.max(MIN_WIDTH, startWidth + event.clientX - startX) }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const header = (key: string, label: string) => (
    <th key={key} className="group/th relative truncate border-b px-3 py-2 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      <button type="button" onClick={() => onSortChange(nextSort(sort, key))} className="inline-flex max-w-full items-center gap-1 uppercase hover:text-foreground">
        <span className="truncate">{label}</span>
        {sort?.column === key && (sort.direction === "asc" ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
      </button>
      <span
        onPointerDown={(e) => resize(e, key, e.currentTarget.parentElement!.offsetWidth)}
        className="absolute inset-y-1.5 right-0 w-1.5 cursor-col-resize rounded-full transition-colors group-hover/th:bg-border hover:bg-ring/60!"
      />
    </th>
  );

  return (
    <table className="table-fixed border-separate border-spacing-0 text-[13px]" style={{ width: total, minWidth: "100%" }}>
      <colgroup>
        <col style={{ width: width("id", "id") }} />
        {fields.map((f) => <col key={f.name} style={{ width: width(f.name, f) }} />)}
      </colgroup>
      <thead className="sticky top-0 z-10 bg-background/85 backdrop-blur">
        <tr>
          {header("id", "id")}
          {fields.map((f) => header(f.name, fieldLabel(f)))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onSelect(row.id)}
            data-selected={row.id === selectedId}
            className="cursor-default transition-colors hover:bg-muted/50 data-[selected=true]:bg-primary/8"
          >
            <td className="border-b border-border/60 px-3 py-1 text-muted-foreground tabular-nums">{row.id}</td>
            {fields.map((field) => (
              <td key={field.name} className={cn("truncate border-b border-border/60 px-2 py-1", field.name === "name" && "font-medium")}>
                <Cell
                  field={field}
                  value={row[field.name] ?? null}
                  onChange={onCellChange && ((value) => onCellChange(row, field, value))}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const inputClass =
  "h-7 w-full min-w-0 truncate rounded-md bg-transparent px-1 outline-none hover:bg-muted focus:bg-background focus:ring-2 focus:ring-ring/40";

/** One cell: an inline editor for simple fields (when editable), a read-only preview otherwise. */
function Cell({ field, value, onChange }: { field: FieldSchema; value: Value; onChange?: (value: Value) => void }) {
  if (field.dataType === "image")
    return value ? <ImageView url={String(value)} className="my-0.5 size-7 rounded-md ring-1 ring-border" /> : null;
  if (field.dataType === "text")
    return <span className="block truncate px-1 text-muted-foreground">{String(value ?? "").replace(/\*\*/g, "")}</span>;
  if (!onChange) {
    if (field.dataType === "option") return <OptionValues field={field} value={value} />;
    if (field.dataType === "boolean") return <Checkbox checked={value === true} disabled className="mx-1" />;
    return <span className="block truncate px-1">{[value].flat().filter((v) => v !== null && v !== "").join(", ")}</span>;
  }
  if (field.dataType === "option")
    return (
      <SearchSelect
        bare
        items={field.options.map((o) => ({ value: o.value, label: o.label ?? o.value, color: o.color }))}
        value={Array.isArray(value) ? value : value ? String(value) : null}
        onChange={onChange}
        multiple={field.multiple}
      />
    );
  if (field.dataType === "boolean")
    return (
      <span className="flex h-7 items-center px-1" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
      </span>
    );

  const text = Array.isArray(value) ? value.join("; ") : value === null ? "" : String(value);
  const parse = (input: string): Value =>
    field.multiple
      ? input.split(/\s*;\s*/).filter(Boolean)
      : field.dataType === "number"
        ? input === "" ? null : Number(input)
        : input || null;
  return (
    <input
      key={text}
      defaultValue={text}
      type={field.dataType === "number" ? "number" : field.dataType === "date" ? "date" : "text"}
      onBlur={(e) => e.target.value !== text && onChange(parse(e.target.value))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = text;
          e.currentTarget.blur();
        }
      }}
      className={inputClass}
    />
  );
}
