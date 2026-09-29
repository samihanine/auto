import { Link, createFileRoute } from "@tanstack/react-router";
import { PanelLeftOpenIcon, SettingsIcon, TableIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { agents, findAgent } from "@/agents";
import type { Database } from "@/lib/crud-table";
import { DatabaseContext, useRows, useSettings } from "@/lib/hooks";
import type { TableSchema } from "@/lib/schemas";
import { useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { errorMessage } from "@/lib/utils";
import { Chat } from "@/components/chat";
import type { Filters, ViewMode } from "@/components/filter-bar";
import { FilterBar, applyFilters, emptyFilters } from "@/components/filter-bar";
import { FolderGate } from "@/components/folder-gate";
import { RowCards } from "@/components/row-card";
import { RowForm } from "@/components/row-form";
import { RowList } from "@/components/row-list";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";

export const Route = createFileRoute("/")({
  ssr: false,
  component: () => (
    <FolderGate>
      {(db) => (
        <DatabaseContext value={db}>
          <Workspace db={db} />
        </DatabaseContext>
      )}
    </FolderGate>
  ),
});

function Workspace({ db }: { db: Database }) {
  const [settings, updateSettings] = useSettings();
  const agent = findAgent(settings.agent);
  const [chatOpen, setChatOpen] = useState(true);
  const chatPanel = usePanelRef();
  const layout = useDefaultLayout({ id: "workspace" });
  const [view, setView] = useState<ViewMode>("table");
  const [tableName, setTableName] = useState<string>();
  const table = (agent.tables.find(({ table }) => table.name === tableName) ?? agent.tables[0]).table;

  return (
    <ResizablePanelGroup className="h-dvh!" {...layout}>
      <ResizablePanel
        id="chat"
        panelRef={chatPanel}
        collapsible
        defaultSize={360}
        minSize={280}
        maxSize={640}
        onResize={(size) => setChatOpen(size.inPixels > 0)}
        className="bg-muted/40"
      >
        <Chat key={agent.name} agent={agent} db={db} onClose={() => chatPanel.current?.collapse()} />
      </ResizablePanel>
      <Handle />

      <ResizablePanel id="main" minSize={480} className="flex min-w-0 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
          {!chatOpen && (
            <Button variant="ghost" size="icon-sm" onClick={() => chatPanel.current?.expand()} aria-label="Open chat">
              <PanelLeftOpenIcon />
            </Button>
          )}
          <Select
            value={agent.name}
            onValueChange={(name) => {
              setTableName(undefined);
              void updateSettings({ agent: name as string });
            }}
          >
            <SelectTrigger size="sm" className="h-8 rounded-lg border-none bg-transparent font-medium hover:bg-muted">
              <SelectValue>{() => agent.label}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start">
              {agents.map((a) => (
                <SelectItem key={a.name} value={a.name}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {agent.tables.length > 1 && (
            <Tabs value={table.name} onValueChange={(name) => setTableName(name as string)}>
              <TabsList className="h-8!">
                {agent.tables.map(({ table }) => (
                  <TabsTrigger key={table.name} value={table.name} className="px-3 text-[13px] capitalize">
                    <TableIcon className="size-3.5" /> {table.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <span className="ml-auto truncate text-xs text-muted-foreground">{db.path(table.name)}</span>
          <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link to="/settings" />} aria-label="Settings">
            <SettingsIcon />
          </Button>
        </header>
        <TableView key={table.name} db={db} table={table} view={view} onViewChange={setView} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

const Handle = () => (
  <ResizableHandle className="transition-colors hover:bg-ring/60 data-[separator=active]:bg-ring" />
);

function TableView({
  db,
  table,
  view,
  onViewChange,
}: {
  db: Database;
  table: TableSchema;
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
          onAdd={() => setSelected("new")}
        />
        <div className="min-h-0 flex-1 overflow-auto">
          {filtered.length ? (
            <List table={table} rows={filtered} selectedId={row?.id} onSelect={setSelected} />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              {rows.length ? "No matching rows" : "No rows yet — add one or ask the assistant"}
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
                .catch((e) => {
                  toast.add({ title: "Could not delete", description: errorMessage(e), type: "error" });
                })
            }
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">Select a row</div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
