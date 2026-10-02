import { createFileRoute } from "@tanstack/react-router";
import { PanelLeftCloseIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import { FEATURES } from "@repo/config";
import { AuthGate } from "@repo/microsoft-auth/auth-gate";
import { parseDatasetUrl } from "@repo/microsoft-auth/powerbi";
import { useLocalState } from "@repo/storage/react";
import { Button } from "@repo/ui/components/button";
import { ChatFrame } from "@repo/ui/components/chat-frame";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/ui/components/resizable";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/tabs";
import { chatParams } from "@/lib/chat-context";
import { rowsOfReport, useLinkedRows } from "@/lib/linked";
import { useReportInfo } from "@/lib/report-cache";
import { useSettings } from "@/lib/store";
import { savePage, useViewerRow } from "@/lib/viewer-state";
import { DaxPanel } from "@/components/dax-panel";
import { LinkedPanel } from "@/components/linked-panel";
import { ReportPanel } from "@/components/report-panel";
import { Setup } from "@/components/setup";

export const Route = createFileRoute("/")({
  component: () => (
    <AuthGate resources={["graph", "powerbi"]}>
      <Viewer />
    </AuthGate>
  ),
});

type SidebarTab = "assistant" | "guide" | "data" | "dax";

/** Sidebar tabs enabled in @repo/config. */
const TABS = (
  [
    ["assistant", "Assistant", FEATURES.aiChat],
    ["guide", "Guide", FEATURES.guideTab],
    ["data", "Data", FEATURES.dataTab],
    ["dax", "DAX", FEATURES.daxTab],
  ] as const
).filter(([, , enabled]) => enabled);

function Viewer() {
  const [settings, updateSettings] = useSettings();
  const report =
    settings.reports.find((r) => r.id === settings.activeReport) ??
    settings.reports[0];
  const [savedTab, setTab] = useLocalState<SidebarTab>(
    "viewer:tab",
    TABS[0]?.[0] ?? "assistant",
  );
  // A tab disabled in the config falls back to the first enabled one.
  const tab = TABS.some(([name]) => name === savedTab)
    ? savedTab
    : (TABS[0]?.[0] ?? "assistant");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebar = usePanelRef();
  const [pageName, setPageName] = useState<string>();
  const [clickedVisual, setClickedVisual] = useState<string>();
  const [step, setStep] = useState<string>();

  const info = useReportInfo(report, setStep);
  const viewerRow = useViewerRow(
    settings.viewerExcel,
    info.ref?.reportId ?? "",
    report?.name ?? "",
  );

  // Dataset: from the report metadata, or the dataset link given with the report.
  const dataset = useMemo(() => {
    if (report?.datasetUrl) return parseDatasetUrl(report.datasetUrl);
    if (info.data?.datasetId)
      return { datasetId: info.data.datasetId, groupId: info.ref?.groupId };
    return undefined;
  }, [report?.datasetUrl, info.data?.datasetId, info.ref?.groupId]);
  const datasetUrl =
    dataset &&
    `https://app.powerbi.com/groups/${dataset.groupId ?? "me"}/datasets/${dataset.datasetId}`;

  // Guide / data entries of this report, given to the assistant (only these rows).
  const guideRows = useLinkedRows(
    "guide",
    FEATURES.guideTab ? settings.guideExcel : "",
  );
  const dataRows = useLinkedRows(
    "data",
    FEATURES.dataTab ? settings.dataExcel : "",
  );
  const guide = useMemo(
    () => rowsOfReport(guideRows.data ?? [], info.ref?.reportId),
    [guideRows.data, info.ref?.reportId],
  );
  const data = useMemo(
    () => rowsOfReport(dataRows.data ?? [], info.ref?.reportId),
    [dataRows.data, info.ref?.reportId],
  );

  const params = useMemo(
    () =>
      chatParams({
        info: info.data,
        settings,
        viewerRow: viewerRow.data,
        pageName,
        datasetUrl,
        guide,
        data,
      }),
    [info.data, settings, viewerRow.data, pageName, datasetUrl, guide, data],
  );

  // Show the real report name once Power BI gives it (reports added without a name).
  const realName = info.data?.name;
  useEffect(() => {
    if (
      !report ||
      !realName ||
      report.name === realName ||
      !/^Report [0-9a-f]{8}$/.test(report.name)
    )
      return;
    void updateSettings({
      reports: settings.reports.map((r) =>
        r.id === report.id ? { ...r, name: realName } : r,
      ),
    });
  }, [realName, report, settings.reports, updateSettings]);

  // Clicked visual with its title and page (from the extracted report structure).
  const clickedPage = info.data?.pages.find((p) =>
    p.visuals.some((v) => v.id === clickedVisual),
  );
  const visual = clickedVisual
    ? {
        id: clickedVisual,
        title: clickedPage?.visuals.find((v) => v.id === clickedVisual)?.title,
        pageName: clickedPage?.name ?? pageName,
      }
    : undefined;
  const pages = (info.data?.pages ?? [])
    .filter((p) => !p.hidden)
    .map((p) => ({ name: p.name, displayName: p.displayName }));

  // Every visual of the report, to link guide / data entries to them.
  const visuals = (info.data?.pages ?? []).flatMap((page) =>
    page.visuals.map((v) => ({
      id: v.id,
      title: v.title || v.type,
      pageName: page.name,
      pageTitle: page.displayName,
    })),
  );

  if (!report || !settings.viewerExcel) return <Setup />;

  return (
    <ResizablePanelGroup className="h-dvh!">
      <ResizablePanel
        panelRef={sidebar}
        collapsible
        defaultSize="33%"
        minSize={300}
        onResize={(size) => setSidebarOpen(size.inPixels > 0)}
        className="flex min-w-0 flex-col bg-muted/30"
      >
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as SidebarTab)}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="flex h-12 items-center border-b pr-2">
            <TabsList
              variant="line"
              className="h-full flex-1 justify-start px-3"
            >
              {TABS.map(([name, label]) => (
                <TabsTrigger key={name} value={name} className="flex-none">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => sidebar.current?.collapse()}
              aria-label="Close sidebar"
            >
              <PanelLeftCloseIcon />
            </Button>
          </div>
          {/* The chat stays mounted so switching tabs keeps its conversation on screen. */}
          {FEATURES.aiChat && (
            <TabsContent
              value="assistant"
              keepMounted
              className="min-h-0 data-hidden:hidden"
            >
              {info.isLoading ? (
                <p className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
                  Reading the report… {step}
                </p>
              ) : (
                <ChatFrame
                  params={params}
                  onExcelChanged={() => void viewerRow.refetch()}
                />
              )}
            </TabsContent>
          )}
          {FEATURES.guideTab && (
            <TabsContent value="guide" className="min-h-0 overflow-y-auto">
              <LinkedPanel
                kind="guide"
                excelUrl={settings.guideExcel}
                onExcelUrl={(url) => void updateSettings({ guideExcel: url })}
                reportUrl={report.url}
                reportName={report.name}
                pages={pages}
                pageName={pageName}
                visual={visual}
                visuals={visuals}
              />
            </TabsContent>
          )}
          {FEATURES.dataTab && (
            <TabsContent value="data" className="min-h-0 overflow-y-auto">
              <LinkedPanel
                kind="data"
                excelUrl={settings.dataExcel}
                onExcelUrl={(url) => void updateSettings({ dataExcel: url })}
                reportUrl={report.url}
                reportName={report.name}
                pages={pages}
                pageName={pageName}
                visual={visual}
                visuals={visuals}
              />
            </TabsContent>
          )}
          {FEATURES.daxTab && (
            <TabsContent value="dax" className="flex min-h-0 flex-col">
              <DaxPanel dataset={dataset} />
            </TabsContent>
          )}
        </Tabs>
      </ResizablePanel>
      <ResizableHandle className="transition-colors hover:bg-ring/60" />
      <ResizablePanel minSize={480} className="flex min-w-0">
        <ReportPanel
          key={report.id}
          report={report}
          viewerRow={viewerRow.data}
          extracting={info.isFetching}
          onRefreshInfo={() => void info.refresh()}
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => sidebar.current?.expand()}
          onPageChange={(name) => {
            setPageName(name);
            setClickedVisual(undefined);
            if (viewerRow.data)
              void savePage(settings.viewerExcel, viewerRow.data, name).then(
                () => viewerRow.refetch(),
              );
          }}
          onVisualClick={(id) => {
            setClickedVisual(id);
            if (FEATURES.guideTab && (tab === "assistant" || tab === "dax"))
              setTab("guide");
          }}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
