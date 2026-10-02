import { XIcon } from "lucide-react";
import { cn } from "../lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "./combobox";
import type { OptionColor } from "./option-badge";
import { OptionBadge } from "./option-badge";

export type SelectItem = { value: string; label: string; color?: OptionColor; hint?: string };

/** Select with a search box, single or multiple. Values are item `value`s. */
export function SearchSelect({
  items,
  value,
  onChange,
  multiple = false,
  disabled = false,
  placeholder = "Select…",
  className,
  bare = false,
}: {
  items: SelectItem[];
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Borderless, compact trigger (inline editing in tables). */
  bare?: boolean;
}) {
  const values = [value].flat().filter((v): v is string => !!v);
  // Keep unknown stored values visible (soft references, removed options).
  const find = (v: string) => items.find((item) => item.value === v) ?? { value: v, label: v };
  const selected = values.map(find);

  return (
    <Combobox
      items={items}
      multiple={multiple}
      disabled={disabled}
      value={multiple ? selected : (selected[0] ?? null)}
      onValueChange={(next: SelectItem | SelectItem[] | null) =>
        onChange(Array.isArray(next) ? next.map((i) => i.value) : (next?.value ?? null))
      }
      itemToStringLabel={(item: SelectItem) => item.label}
      isItemEqualToValue={(a: SelectItem, b: SelectItem) => a.value === b.value}
    >
      <div className={cn("relative", className)}>
        <ComboboxTrigger
          className={cn(
            "flex w-full items-center gap-1.5 text-left text-sm outline-none disabled:cursor-default disabled:opacity-70",
            bare
              ? "min-h-7 rounded-md px-1 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 [&>svg]:opacity-0 hover:[&>svg]:opacity-100"
              : "min-h-9 rounded-xl border border-input bg-input/30 py-1.5 pr-2 pl-2.5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        >
          <span className={cn("flex min-w-0 flex-1 flex-wrap gap-1", !disabled && !bare && values.length > 0 && "mr-6")}>
            {selected.length ? (
              selected.map((item) => <ItemLabel key={item.value} item={item} />)
            ) : (
              <span className="text-muted-foreground">{disabled || bare ? "" : placeholder}</span>
            )}
          </span>
        </ComboboxTrigger>
        {!disabled && !bare && values.length > 0 && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => onChange(multiple ? [] : null)}
            className="absolute top-1/2 right-8 grid size-5 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>
      <ComboboxContent className="w-72">
        <ComboboxInput showTrigger={false} placeholder="Search…" />
        <ComboboxEmpty>No results</ComboboxEmpty>
        <ComboboxList>
          {(item: SelectItem) => (
            <ComboboxItem key={item.value} value={item}>
              <ItemLabel item={item} />
              {item.hint && <span className="ml-auto truncate text-xs text-muted-foreground">{item.hint}</span>}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function ItemLabel({ item }: { item: SelectItem }) {
  if (item.color) return <OptionBadge option={{ value: item.value, label: item.label, color: item.color }} />;
  return <span className="max-w-full truncate rounded-full bg-muted px-2 text-xs leading-5">{item.label}</span>;
}
