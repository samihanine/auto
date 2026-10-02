import { PanelLeftOpenIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ExcelRecord } from "@repo/microsoft-auth/excel";
import { parseReportUrl } from "@repo/microsoft-auth/powerbi";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { SearchSelect } from "@repo/ui/components/search-select";
import { Spinner } from "@repo/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { cn, errorMessage } from "@repo/ui/lib/utils";
import { embedReport, resetEmbed } from "@/lib/embed";
import type { pbi } from "@/lib/embed";
import type { SavedReport } from "@/lib/store";
import { useSettings } from "@/lib/store";
import { applyViewerState } from "@/lib/viewer-state";
import { AddReportForm } from "@/components/setup";

/** Header (report + pages) and the embedded report, driven by the viewer row. */
export function ReportPanel({
  report,
  viewerRow,
  extracting,
  onRefreshInfo,
  onPageChange,
  onVisualClick,
  sidebarOpen,
  onOpenSidebar,
}: {
  report: SavedReport;
  viewerRow: ExcelRecord | null | undefined;
  extracting: boolean;
  onRefreshInfo: () => void;
  onPageChange: (pageName: string) => void;
  onVisualClick: (visualId: string) => void;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
}) {
  const [settings, updateSettings] = useSettings();
  const container = useRef<HTMLDivElement>(null);
  const embedded = useRef<pbi.Report | null>(null);
  const [pages, setPages] = useState<{ name: string; displayName: string }[]>([]);
  const [activePage, setActivePage] = useState<string>();
  const [loaded, setLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const callbacks = useRef({ onPageChange, onVisualClick });
  callbacks.current = { onPageChange, onVisualClick };

  // Embed the selected report; page changes and visual clicks are reported to the parent.
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    setError(null);
    setLoaded(0);
    const ref = parseReportUrl(report.url);
    embedReport(element, ref, { pageName: ref.pageName })
      .then(async (embeddedReport) => {
        embedded.current = embeddedReport;
        const all = await embeddedReport.getPages();
        setPages(all.filter((p) => p.visibility !== 1).map((p) => ({ name: p.name, displayName: p.displayName })));
        setActivePage(all.find((p) => p.isActive)?.name);
        embeddedReport.on("pageChanged", (event) => {
          const page = (event.detail as { newPage: pbi.Page }).newPage;
          setActivePage(page.name);
          callbacks.current.onPageChange(page.name);
        });
        embeddedReport.on("visualClicked", (event) =>
          callbacks.current.onVisualClick((event.detail as { visual: { name: string } }).visual.name),
        );
        setLoaded((n) => n + 1);
      })
      .catch((e) => setError(errorMessage(e)));
    return () => {
      embedded.current = null;
      resetEmbed(element);
    };
  }, [report.url]);

  // Apply the page / filters the assistant wrote in the report_viewer Excel.
  const appliedAt = viewerRow?.updated_at;
  useEffect(() => {
    if (embedded.current && viewerRow && loaded)
      applyViewerState(embedded.current, viewerRow).catch((e) => setError(errorMessage(e)));
    // Keyed on updated_at: polling returns a new object every time, only real changes re-apply.
  }, [loaded, appliedAt]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        {!sidebarOpen && (
          <Button variant="ghost" size="icon-sm" onClick={onOpenSidebar} aria-label="Open sidebar">
            <PanelLeftOpenIcon />
          </Button>
        )}
        <SearchSelect
          className="w-60"
          items={settings.reports.map((r) => ({ value: r.id, label: r.name }))}
          value={report.id}
          onChange={(id) => id && void updateSettings({ activeReport: String(id) })}
        />
        <Popover>
          <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Add a report" />}>
            <PlusIcon />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-96">
            <AddReportForm />
          </PopoverContent>
        </Popover>
        {pages.length > 0 && (
          <Tabs
            value={activePage ?? ""}
            onValueChange={(name) => void embedded.current?.setPage(String(name))}
            className="min-w-0 flex-1"
          >
            <TabsList variant="line" className="max-w-full justify-start overflow-x-auto">
              {pages.map((page) => (
                <TabsTrigger key={page.name} value={page.name} className="flex-none text-[13px]">
                  {page.displayName}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={onRefreshInfo}
          disabled={extracting}
          title="Re-read the report structure and dataset"
          aria-label="Refresh report info"
        >
          <RefreshCwIcon className={cn(extracting && "animate-spin")} />
        </Button>
      </header>
      {error && <p className="border-b bg-destructive/5 px-4 py-2 text-xs text-destructive">{error}</p>}
      <div className="relative min-h-0 flex-1 bg-muted/40">
        <div ref={container} className="absolute inset-0 [&_iframe]:border-0" />
        {!loaded && !error && (
          <div className="absolute inset-0 grid place-items-center">
            <Spinner />
          </div>
        )}
      </div>
    </div>
  );
}
