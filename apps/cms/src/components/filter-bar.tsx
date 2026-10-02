import { ExternalLinkIcon, PlusIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { OptionBadge } from "@repo/ui/components/option-badge";
import { cn } from "@repo/ui/lib/utils";
import { emptyFilters } from "@/lib/filters";
import type { TableSchema } from "@repo/tables/schema";
import { fieldLabel } from "@repo/tables/schema";
import type { View } from "@/lib/views";
import { defaultColumns } from "@/lib/views";
import { CheckList } from "@/components/check-list";

/** Search, option slicers and visible columns of the active view, plus source actions. */
export function FilterBar({
  table,
  view,
  onChange,
  count,
  excelUrl,
  refreshing,
  onRefresh,
  onAdd,
}: {
  table: TableSchema;
  view: View;
  onChange: (patch: Partial<View>) => void;
  count: number;
  excelUrl: string;
  refreshing: boolean;
  onRefresh: () => void;
  onAdd: () => void;
}) {
  const { filters } = view;
  const active = filters.search || Object.values(filters.options).some((s) => s.length);
  const columns = view.columns ?? defaultColumns(table);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
      <label className="relative flex h-8 w-52 items-center">
        <SearchIcon className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
        <input
          value={filters.search}
          onChange={(e) => onChange({ filters: { ...filters, search: e.target.value } })}
          placeholder="Search"
          className="h-full w-full rounded-lg bg-muted pr-2 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
        />
      </label>
      {table.columns
        .filter((field) => field.dataType === "option")
        .map((field) => (
          <CheckList
            key={field.name}
            label={fieldLabel(field)}
            items={field.options.map((option) => ({
              value: option.value,
              text: option.label ?? option.value,
              label: <OptionBadge option={option} />,
            }))}
            selected={filters.options[field.name] ?? []}
            onChange={(selected) => onChange({ filters: { ...filters, options: { ...filters.options, [field.name]: selected } } })}
          />
        ))}
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ filters: emptyFilters })}>
          <XIcon /> Clear
        </Button>
      )}
      <div className="ml-auto flex items-center gap-1">
        <span className="mr-1 text-xs text-muted-foreground tabular-nums">
          {count} {count === 1 ? "row" : "rows"}
        </span>
        <CheckList
          label="Columns"
          highlight={false}
          clearable={false}
          items={table.columns.map((field) => ({
            value: field.name,
            text: fieldLabel(field),
            label: (
              <span className="flex flex-1 items-center justify-between gap-2 text-[13px] capitalize">
                {fieldLabel(field)}
                <span className="text-[11px] text-muted-foreground normal-case">{field.dataType}</span>
              </span>
            ),
          }))}
          selected={columns}
          onChange={(selected) => onChange({ columns: table.columns.map((f) => f.name).filter((name) => selected.includes(name)) })}
        />
        <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Refresh" title="Refresh">
          <RefreshCwIcon className={cn(refreshing && "animate-spin")} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<a href={excelUrl} target="_blank" rel="noreferrer" />}
          aria-label="Open in Excel"
          title="Open in Excel"
        >
          <ExternalLinkIcon />
        </Button>
        <Button size="icon-sm" onClick={onAdd} aria-label="New row">
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}
