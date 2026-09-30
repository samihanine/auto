import { XIcon } from "lucide-react";
import type { OptionColor } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { OptionBadge } from "@/components/option-badge";

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
}: {
  items: SelectItem[];
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
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
            "flex min-h-9 w-full items-center gap-1.5 rounded-xl border border-input bg-input/30 py-1.5 pr-2 pl-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-70",
          )}
        >
          <span className={cn("flex min-w-0 flex-1 flex-wrap gap-1", !disabled && values.length > 0 && "mr-6")}>
            {selected.length ? (
              selected.map((item) => <ItemLabel key={item.value} item={item} />)
            ) : (
              <span className="text-muted-foreground">{disabled ? "—" : placeholder}</span>
            )}
          </span>
        </ComboboxTrigger>
        {!disabled && values.length > 0 && (
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
  if (item.color) return <OptionBadge option={{ name: item.label, color: item.color }} />;
  return <span className="max-w-full truncate rounded-full bg-muted px-2 text-xs leading-5">{item.label}</span>;
}
