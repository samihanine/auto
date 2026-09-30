import type { Row } from "@/lib/schemas";
import { selection, useExcluded } from "@/lib/selection";
import { Checkbox } from "@/components/ui/checkbox";

/** Whether a row is shared with the assistant (checked by default). */
export function ShareCheckbox({ table, id }: { table: string; id: number }) {
  const excluded = useExcluded(table);
  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex" title="Share with the assistant">
      <Checkbox checked={!excluded.has(id)} onCheckedChange={() => selection.toggle(table, id)} />
    </span>
  );
}

/** Header checkbox state for a list of rows. */
export function useShareAll(table: string, rows: Row[]) {
  const excluded = useExcluded(table);
  const count = rows.filter((row) => !excluded.has(row.id)).length;
  return {
    checked: rows.length > 0 && count === rows.length,
    indeterminate: count > 0 && count < rows.length,
    toggle: () =>
      selection.setMany(
        table,
        rows.map((row) => row.id),
        count < rows.length,
      ),
  };
}
