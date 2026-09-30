import { useMemo, useState } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import type { Database } from "@/lib/crud-table";
import { useRows } from "@/lib/hooks";
import type { TableSchema } from "@/lib/schemas";
import { download, errorMessage } from "@/lib/utils";
import { fileName } from "@/lib/xlsx";
import type { Filters, ViewMode } from "@/components/filter-bar";
import { FilterBar, applyFilters, emptyFilters } from "@/components/filter-bar";
import { RowCards } from "@/components/row-card";
import { RowForm } from "@/components/row-form";
import { RowList } from "@/components/row-list";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { toast } from "@/components/ui/toast";

export const Handle = () => (
  <ResizableHandle className="transition-colors hover:bg-ring/60 data-[separator=active]:bg-ring" />
);

const notify = (title: string) => (error: unknown) => {
  toast.add({ title, description: errorMessage(error), type: "error" });
};

/** Filters + table/cards + row form for one table, with the agent's access level. */
export function TableView({
  db,
  table,
  view,
  onViewChange,
  readOnly,
}: {
  db: Database;
  table: TableSchema;
  readOnly: boolean;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}) {
  const rows = useRows(db, table.name);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const row = selected === "new" ? null : (filtered.find((r) => r.id === selected) ?? filtered[0] ?? null);
  const List = view === "table" ? RowList : RowCards;
  const layout = useDefaultLayout({ id: "table-view" });

  return (
    <ResizablePanelGroup className="min-h-0 flex-1" {...layout}>
      <ResizablePanel id="list" minSize={320} className="flex min-w-0 flex-col">
        <FilterBar
          table={table}
          filters={filters}
          onFiltersChange={setFilters}
          view={view}
          onViewChange={onViewChange}
          count={filtered.length}
          onAdd={readOnly ? undefined : () => setSelected("new")}
          onDownload={() =>
            db.dir
              .getFileHandle(fileName(table))
              .then((handle) => handle.getFile())
              .then((file) => download(file, fileName(table)))
              .catch(notify("Could not download"))
          }
        />
        <div className="min-h-0 flex-1 overflow-auto">
          {filtered.length ? (
            <List table={table} rows={filtered} selectedId={row?.id} onSelect={setSelected} />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              {rows.length ? "No matching rows" : readOnly ? "No rows yet" : "No rows yet — add one or ask the assistant"}
            </div>
          )}
        </div>
      </ResizablePanel>
      <Handle />

      <ResizablePanel id="form" defaultSize={420} minSize={320} maxSize="70%">
        {row || selected === "new" ? (
          <RowForm
            key={selected === "new" ? "new" : row!.id}
            table={table}
            row={row}
            readOnly={readOnly}
            onCancel={() => setSelected(null)}
            onSave={async (values) => {
              if (row) return db.update(table.name, [{ ...values, id: row.id }]);
              const [created] = await db.insert(table.name, [values]);
              setSelected(created.id);
            }}
            onDelete={() =>
              db
                .delete(table.name, [row!.id])
                .then(() => setSelected(null))
                .catch(notify("Could not delete"))
            }
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">Select a row</div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
