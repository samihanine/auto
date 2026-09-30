import type { Database } from "@/lib/crud-table";
import { useRows } from "@/lib/hooks";
import type { FieldOption, FieldSchema, Row } from "@/lib/schemas";
import { OptionBadge } from "@/components/option-badge";
import { SearchSelect } from "@/components/search-select";

export { OptionBadge };

export const findOption = (column: FieldSchema, name: string): FieldOption =>
  column.options.find((option) => option.name === name) ?? { name, color: "gray" };

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

type FieldSelectProps = {
  column: FieldSchema;
  value: unknown;
  onChange: (value: string | string[] | null) => void;
  disabled?: boolean;
};

const asValue = (value: unknown) =>
  Array.isArray(value) ? value.map(String) : value ? String(value) : null;

export function OptionSelect({ column, value, onChange, disabled }: FieldSelectProps) {
  return (
    <SearchSelect
      items={column.options.map((o) => ({ value: o.name, label: o.name, color: o.color }))}
      value={asValue(value)}
      onChange={onChange}
      multiple={column.multiple}
      disabled={disabled}
    />
  );
}

/** Label of a referenced row: its name, or the raw key when not found (soft reference). */
export const referenceLabel = (rows: Row[], key: string, value: string) =>
  rows.find((row) => String(row[key] ?? "") === value)?.name ?? value;

/** Soft foreign key: pick rows of `column.reference`, storing their key. */
export function ReferenceSelect({ db, ...props }: FieldSelectProps & { db: Database }) {
  const target = db.table(props.column.reference!);
  const rows = useRows(db, target.name);
  return (
    <SearchSelect
      items={rows
        .filter((row) => row[target.key])
        .map((row) => ({ value: String(row[target.key]), label: row.name, hint: `#${row.id}` }))}
      value={asValue(props.value)}
      onChange={props.onChange}
      multiple={props.column.multiple}
      disabled={props.disabled}
      placeholder={`Select ${target.name}…`}
    />
  );
}
