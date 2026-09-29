import { cn } from "@/lib/utils";
import type { FieldOption, FieldSchema, OptionColor } from "@/lib/schemas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const DOTS: Record<OptionColor, string> = {
  cyan: "bg-cyan-500",
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  gray: "bg-neutral-400",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  brown: "bg-amber-800",
  black: "bg-neutral-900",
  white: "bg-white ring-1 ring-border",
  lime: "bg-lime-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
};

export const findOption = (column: FieldSchema, name: string): FieldOption =>
  column.options.find((option) => option.name === name) ?? { name, color: "gray" };

export function OptionBadge({ option, className }: { option: FieldOption; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 text-xs whitespace-nowrap text-foreground/80",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOTS[option.color])} />
      {option.name}
    </span>
  );
}

/** Badges for an option cell (single or multiple). */
export function OptionValues({ column, value }: { column: FieldSchema; value: unknown }) {
  const names = Array.isArray(value) ? value : value ? [String(value)] : [];
  return (
    <span className="flex flex-wrap gap-1">
      {names.map((name) => (
        <OptionBadge key={name} option={findOption(column, name)} />
      ))}
    </span>
  );
}

export function OptionSelect({
  column,
  value,
  onChange,
}: {
  column: FieldSchema;
  value: unknown;
  onChange: (value: string | string[] | null) => void;
}) {
  const items = column.options.map((option) => (
    <SelectItem key={option.name} value={option.name}>
      <OptionBadge option={option} className="bg-transparent px-0" />
    </SelectItem>
  ));
  const trigger = (
    <SelectTrigger className="h-auto min-h-9 w-full rounded-xl bg-input/30 py-1.5">
      <span className="flex min-w-0 flex-1 flex-wrap gap-1">
        {(Array.isArray(value) ? value.length : value) ? (
          <OptionValues column={column} value={value} />
        ) : (
          <span className="text-muted-foreground">Select…</span>
        )}
      </span>
    </SelectTrigger>
  );

  if (column.multiple)
    return (
      <Select
        multiple
        value={Array.isArray(value) ? value.map(String) : []}
        onValueChange={(next) => onChange(next as string[])}
      >
        {trigger}
        <SelectContent alignItemWithTrigger={false}>{items}</SelectContent>
      </Select>
    );

  return (
    <Select
      value={value ? String(value) : null}
      onValueChange={(next) => onChange((next as string | null) ?? null)}
    >
      {trigger}
      <SelectContent alignItemWithTrigger={false}>
        <SelectItem value={null}>
          <span className="text-muted-foreground">None</span>
        </SelectItem>
        {items}
      </SelectContent>
    </Select>
  );
}
