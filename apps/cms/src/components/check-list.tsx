import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

export type CheckItem = { value: string; label: React.ReactNode; text: string };

/** Popover with a searchable checkbox list (option slicers, visible columns). */
export function CheckList({
  label,
  items,
  selected,
  onChange,
  highlight = selected.length > 0,
  clearable = true,
}: {
  label: string;
  items: CheckItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  highlight?: boolean;
  clearable?: boolean;
}) {
  const [search, setSearch] = useState("");
  const shown = items.filter((item) => item.text.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((s) => s !== value) : [...selected, value]);

  return (
    <Popover onOpenChange={(open) => !open && setSearch("")}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-[13px] capitalize transition-colors hover:bg-muted",
          highlight && "border-solid border-primary/40 bg-primary/5",
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground tabular-nums">{selected.length}</span>
        )}
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 gap-0 p-1">
        <label className="relative m-1 flex items-center">
          <SearchIcon className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-8 w-full rounded-md bg-muted pr-2 pl-7 text-[13px] outline-none"
          />
        </label>
        <div className="max-h-72 overflow-y-auto">
          {shown.map((item) => (
            <label key={item.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted">
              <Checkbox checked={selected.includes(item.value)} onCheckedChange={() => toggle(item.value)} />
              {item.label}
            </label>
          ))}
          {!shown.length && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No results</p>}
        </div>
        {clearable && selected.length > 0 && (
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
