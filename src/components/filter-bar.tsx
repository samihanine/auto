import { ChevronDownIcon, DownloadIcon, LayoutGridIcon, PlusIcon, SearchIcon, TableIcon, XIcon } from "lucide-react";
import type { FieldSchema, Row, TableSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OptionBadge } from "@/components/option-badge";

export type ViewMode = "table" | "cards";
export type Filters = { search: string; options: Record<string, string[]> };

export const emptyFilters: Filters = { search: "", options: {} };

export function applyFilters(rows: Row[], filters: Filters) {
  const search = filters.search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      Object.entries(filters.options).every(([column, selected]) => {
        if (!selected.length) return true;
        const values = [row[column]].flat().map(String);
        return selected.some((option) => values.includes(option));
      }) &&
      (!search ||
        Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(search))),
  );
}

export function FilterBar({
  table,
  filters,
  onFiltersChange,
  view,
  onViewChange,
  count,
  onAdd,
  onDownload,
}: {
  table: TableSchema;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  count: number;
  /** Omitted for read-only tables. */
  onAdd?: () => void;
  onDownload: () => void;
}) {
  const optionColumns = table.columns.filter((column) => column.dataType === "option");
  const active = filters.search || Object.values(filters.options).some((s) => s.length);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
      <label className="relative flex h-8 w-56 items-center">
        <SearchIcon className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
        <input
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="Search"
          className="h-full w-full rounded-lg bg-muted pr-2 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
        />
      </label>
      {optionColumns.map((column) => (
        <Slicer
          key={column.name}
          column={column}
          selected={filters.options[column.name] ?? []}
          onChange={(selected) =>
            onFiltersChange({ ...filters, options: { ...filters.options, [column.name]: selected } })
          }
        />
      ))}
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onFiltersChange(emptyFilters)}>
          <XIcon /> Clear
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {count} {count === 1 ? "row" : "rows"}
        </span>
        <ToggleGroup
          value={[view]}
          onValueChange={(value) => value[0] && onViewChange(value[0] as ViewMode)}
          size="sm"
          spacing={0}
          className="rounded-lg bg-muted p-0.5"
        >
          <ToggleGroupItem value="table" aria-label="Table view" className="h-7 rounded-md! data-pressed:bg-background data-pressed:shadow-sm">
            <TableIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="cards" aria-label="Card view" className="h-7 rounded-md! data-pressed:bg-background data-pressed:shadow-sm">
            <LayoutGridIcon />
          </ToggleGroupItem>
        </ToggleGroup>
        <Button variant="ghost" size="icon-sm" onClick={onDownload} aria-label="Download xlsx" title="Download .xlsx">
          <DownloadIcon />
        </Button>
        {onAdd && (
          <Button size="icon-sm" onClick={onAdd} aria-label="New row">
            <PlusIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Power BI–like slicer: pick the option values to keep. */
function Slicer({
  column,
  selected,
  onChange,
}: {
  column: FieldSchema;
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-[13px] capitalize transition-colors hover:bg-muted",
          selected.length && "border-solid border-primary/40 bg-primary/5",
        )}
      >
        {column.name}
        {selected.length > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground tabular-nums">
            {selected.length}
          </span>
        )}
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-0 p-1">
        {column.options.map((option) => (
          <label
            key={option.name}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted"
          >
            <Checkbox
              checked={selected.includes(option.name)}
              onCheckedChange={() => toggle(option.name)}
            />
            <OptionBadge option={option} className="bg-transparent px-0" />
          </label>
        ))}
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="mt-1 border-t px-2 pt-2 pb-1 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
