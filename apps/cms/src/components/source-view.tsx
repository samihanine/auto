import { useQueryClient } from "@tanstack/react-query";
import { FEATURES } from "@repo/config";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import type { ChatParams } from "@repo/ui/components/chat-frame";
import { ChatFrame } from "@repo/ui/components/chat-frame";
import { Button } from "@repo/ui/components/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@repo/ui/components/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { toast } from "@repo/ui/components/toast";
import { errorMessage } from "@repo/ui/lib/utils";
import { applyFilters, applySort } from "@/lib/filters";
import type { FieldSchema, Row, Value } from "@repo/tables/schema";
import { describeTable, validate } from "@repo/tables/schema";
import type { Source } from "@/lib/store";
import { useRows } from "@/lib/use-rows";
import { useViews, visibleColumns } from "@/lib/views";
import { findStructure } from "@repo/tables";
import { FilterBar } from "@/components/filter-bar";
import { RowForm } from "@/components/row-form";
import { RowTable } from "@/components/row-table";
import { ViewTabs } from "@/components/view-tabs";

const PROMPT = `You manage the content of a CMS whose tables are Excel files (one excel per source, see <context> for their structure).
- Use the option VALUES (not labels) of option columns; image columns are written through "<name>_url" (the "<name>" column is an Excel formula).
- Every row needs a unique "name". Keep texts concise; "text" columns accept line breaks and **bold**.
- When the user talks about "this row" / "the selected row", use the selected row given in <context>.`;

type SideTab = "assistant" | "edit";

/** Left (collapsible): assistant / row editor. Right: saved views of the source rows. */
export function SourceView({ source, sources }: { source: Source; sources: Source[] }) {
  const client = useQueryClient();
  const { table, rows, isLoading, error, insert, update, remove } = useRows(source);
  const views = useViews(source.id);
  const { view } = views;
  const [sideTab, setSideTab] = useState<SideTab>("edit");
  const [sideOpen, setSideOpen] = useState(true);
  const side = usePanelRef();
  const [selected, setSelected] = useState<number | "new" | null>(null);

  const visible = useMemo(() => applySort(applyFilters(rows, view.filters), view.sort), [rows, view.filters, view.sort]);
  const row = selected === "new" ? null : (rows.find((r) => r.id === selected) ?? visible[0] ?? null);
  const select = (id: number | "new") => {
    setSelected(id);
    setSideTab("edit");
  };

  /** Saves an inline cell edit after the same checks as the form. */
  const saveCell = (target: Row, field: FieldSchema, value: Value) => {
    const next = { ...target, [field.name]: value };
    const problem = validate(table, next, rows);
    if (problem) return toast.add({ title: "Not saved", description: problem, type: "error" });
    update({ id: target.id, [field.name]: value }).catch((e) =>
      toast.add({ title: "Could not save", description: errorMessage(e), type: "error" }),
    );
  };

  const chatParams = useMemo<ChatParams>(
    () => ({
      scope: "cms",
      title: "CMS assistant",
      prompt: PROMPT,
      initialContext: [
        ...sources.map((s) => `Excel "${s.name}" follows the structure:\n${describeTable(findStructure(s.structure)!)}`),
        `The user is viewing "${source.name}"${row ? `, selected row id ${row.id} ("${row.name}")` : ""}.`,
      ].join("\n\n"),
      excels: sources.map((s) => ({ url: s.url, access: "write" as const, name: s.name })),
    }),
    [sources, source.name, row],
  );
  const refresh = useCallback(() => void client.invalidateQueries({ queryKey: ["rows"] }), [client]);

  return (
    <ResizablePanelGroup className="min-h-0 flex-1">
      <ResizablePanel
        panelRef={side}
        collapsible
        defaultSize="33%"
        minSize={320}
        onResize={(size) => setSideOpen(size.inPixels > 0)}
        className="flex min-w-0 flex-col bg-muted/30"
      >
        <Tabs value={sideTab} onValueChange={(v) => setSideTab(v as SideTab)} className="min-h-0 flex-1 gap-0">
          <div className="flex h-11 shrink-0 items-center border-b pr-2">
            <TabsList variant="line" className="h-full flex-1 justify-start px-3">
              {FEATURES.aiChat && <TabsTrigger value="assistant" className="flex-none">Assistant</TabsTrigger>}
              <TabsTrigger value="edit" className="flex-none">Edit</TabsTrigger>
            </TabsList>
            <Button variant="ghost" size="icon-sm" onClick={() => side.current?.collapse()} aria-label="Close panel">
              <PanelLeftCloseIcon />
            </Button>
          </div>
          {/* The chat stays mounted so switching tabs keeps its state. */}
          {FEATURES.aiChat && (
            <TabsContent value="assistant" keepMounted className="min-h-0 data-hidden:hidden">
              <ChatFrame params={chatParams} onExcelChanged={refresh} />
            </TabsContent>
          )}
          <TabsContent value="edit" className="min-h-0 bg-background">
            {row || selected === "new" ? (
              <RowForm
                key={selected === "new" ? "new" : row!.id}
                table={table}
                row={row}
                rows={rows}
                onCreate={async (values) => {
                  const id = await insert(values);
                  setSelected(id);
                  return id;
                }}
                onUpdate={update}
                onDelete={() => remove(row!.id).then(() => setSelected(null))}
              />
            ) : (
              <p className="grid h-full place-items-center text-sm text-muted-foreground">Select a row</p>
            )}
          </TabsContent>
        </Tabs>
      </ResizablePanel>
      <ResizableHandle className="transition-colors hover:bg-ring/60" />
      <ResizablePanel minSize={480} className="flex min-w-0 flex-col">
        <ViewTabs views={views}>
          {!sideOpen && (
            <Button variant="ghost" size="icon-sm" onClick={() => side.current?.expand()} aria-label="Open panel">
              <PanelLeftOpenIcon />
            </Button>
          )}
        </ViewTabs>
        <FilterBar
          table={table}
          view={view}
          onChange={views.change}
          count={visible.length}
          excelUrl={source.url}
          refreshing={isLoading}
          onRefresh={refresh}
          onAdd={() => {
            select("new");
            side.current?.expand();
          }}
        />
        <div className="min-h-0 flex-1 overflow-auto">
          {error ? (
            <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
          ) : !visible.length ? (
            <p className="grid h-full place-items-center text-sm text-muted-foreground">
              {isLoading ? "Loading…" : rows.length ? "No matching rows" : "No rows yet"}
            </p>
          ) : (
            <RowTable
              tableName={table.name}
              fields={visibleColumns(table, view)}
              rows={visible}
              selectedId={row?.id}
              onSelect={select}
              sort={view.sort}
              onSortChange={(sort) => views.change({ sort })}
              onCellChange={FEATURES.inlineEdit ? saveCell : undefined}
            />
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
