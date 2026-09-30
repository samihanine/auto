import { Link, createFileRoute } from "@tanstack/react-router";
import { LayoutPanelTopIcon, PanelLeftOpenIcon, SettingsIcon, TableIcon } from "lucide-react";
import { useState } from "react";
import { useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { agents, findAgent } from "@/agents";
import type { Database } from "@/lib/crud-table";
import { DatabaseContext, useSettings } from "@/lib/hooks";
import { Chat } from "@/components/chat";
import type { ViewMode } from "@/components/filter-bar";
import { FolderGate } from "@/components/folder-gate";
import { Handle, TableView } from "@/components/table-view";
import { Button } from "@/components/ui/button";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [tabName, setTabName] = useState<string>();

  // One tab per agent table, then the agent's custom tabs.
  const tabs = [
    ...agent.tables.map(({ table, accessLevel }) => ({ name: table.name, label: table.name, table, accessLevel })),
    ...(agent.tabs ?? []).map((tab) => ({ ...tab, table: undefined, accessLevel: undefined })),
  ];
  const tab = tabs.find((t) => t.name === tabName) ?? tabs[0];
  const custom = agent.tabs?.find((t) => t.name === tab.name);

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
              setTabName(undefined);
              void updateSettings({ agent: name as string });
            }}
          >
            <SelectTrigger size="sm" className="h-8 shrink-0 rounded-lg border-none bg-transparent font-medium hover:bg-muted">
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
          {tabs.length > 1 && (
            <Tabs value={tab.name} onValueChange={(name) => setTabName(name as string)} className="min-w-0">
              <TabsList className="h-8! max-w-full justify-start overflow-x-auto">
                {tabs.map((t) => (
                  <TabsTrigger key={t.name} value={t.name} className="flex-none px-3 text-[13px]">
                    {t.table ? <TableIcon className="size-3.5" /> : <LayoutPanelTopIcon className="size-3.5" />}
                    {t.label}
                    {t.accessLevel === "read" && <span className="text-[10px] text-muted-foreground">read</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <span className="ml-auto truncate text-xs text-muted-foreground">{tab.table && db.path(tab.table.name)}</span>
          <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link to="/settings" />} aria-label="Settings">
            <SettingsIcon />
          </Button>
        </header>
        {custom ? (
          <custom.component key={`${agent.name}:${custom.name}`} agent={agent} db={db} />
        ) : (
          <TableView
            key={tab.name}
            db={db}
            table={tab.table!}
            readOnly={tab.accessLevel !== "write"}
            view={view}
            onViewChange={setView}
          />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
