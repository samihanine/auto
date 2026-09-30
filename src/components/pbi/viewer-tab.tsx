import { Link } from "@tanstack/react-router";
import { BookOpenIcon, PanelRightCloseIcon, PanelRightOpenIcon, PresentationIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAgentState, useRows, useSettings } from "@/lib/hooks";
import type { pbi } from "@/lib/pbi-embed";
import { embedReport, resetEmbed } from "@/lib/pbi-embed";
import { applyViewerState } from "@/lib/pbi-viewer";
import type { CustomTabProps } from "@/lib/schemas";
import { errorMessage } from "@/lib/utils";
import { reportTable } from "@/table/report";
import { reportTutorialTable } from "@/table/report-tutorial";
import { reportViewerTable } from "@/table/report-viewer";
import { RichTextView } from "@/components/rich-text";
import { SearchSelect } from "@/components/search-select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Embedded Power BI report driven by the conversation's reportViewer row, with visual tutorials. */
export function ViewerTab({ agent, db }: CustomTabProps) {
  const [state, setState] = useAgentState(agent.name);
  const [settings] = useSettings();
  const conversationId = settings.conversations[agent.name];
  const reports = useRows(db, reportTable.name).filter((r) => r.source !== "Built");
  const reportRow = reports.find((r) => r.powerBiReportId === state.report);
  const viewerRow = useRows(db, reportViewerTable.name).find(
    (r) => r.conversationId === conversationId && r.powerBiReportId === state.report,
  );
  const tutorials = useRows(db, reportTutorialTable.name).filter((t) => t.powerBiReportId === state.report);

  const container = useRef<HTMLDivElement>(null);
  const embedded = useRef<pbi.Report | null>(null);
  const viewerRef = useRef(viewerRow);
  viewerRef.current = viewerRow;
  const [loaded, setLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [clicked, setClicked] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Embed the selected report; keep the agent state (and viewer row) in sync with page changes.
  useEffect(() => {
    const element = container.current;
    if (!element || !reportRow) return;
    setError(null);
    setLoaded(0);
    const ref = { reportId: String(reportRow.powerBiReportId), groupId: reportRow.powerBiGroupId ? String(reportRow.powerBiGroupId) : undefined };
    embedReport(element, ref, { pageName: state.page || undefined })
      .then((report) => {
        embedded.current = report;
        report.on("pageChanged", (event) => {
          const page = (event.detail as { newPage: pbi.Page }).newPage;
          void setState({ page: page.name });
          const row = viewerRef.current;
          if (row && row.powerBiPageId !== page.name)
            void db.update(reportViewerTable.name, [{ ...row, powerBiPageId: page.name, pageFilters: null }]);
        });
        report.on("visualClicked", (event) => {
          setClicked((event.detail as { visual: { name: string } }).visual.name);
          setPanelOpen(true);
        });
        setLoaded((n) => n + 1);
      })
      .catch((e) => setError(errorMessage(e)));
    return () => {
      embedded.current = null;
      resetEmbed(element);
    };
    // Re-embed only when the report changes (page changes come from the embed itself).
  }, [reportRow?.powerBiReportId]);

  // Apply the page / filters the agent wrote in the viewer row.
  useEffect(() => {
    if (embedded.current && viewerRow && loaded)
      applyViewerState(embedded.current, viewerRow).catch((e) => setError(errorMessage(e)));
  }, [loaded, viewerRow]);

  const tutorial = clicked ? tutorials.find((t) => [t.visuals].flat().includes(clicked)) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <SearchSelect
          className="w-72"
          placeholder="Select a report…"
          items={reports.map((r) => ({ value: String(r.powerBiReportId), label: r.name }))}
          value={state.report || null}
          onChange={(value) => void setState({ report: String(value ?? ""), page: "" })}
        />
        <Link to="/import-report" className="text-xs text-primary hover:underline">Import a report</Link>
        {error && <span className="truncate text-xs text-destructive">{error}</span>}
        {reportRow && (
          <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setPanelOpen((o) => !o)} aria-label="Toggle tutorials">
            {panelOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
          </Button>
        )}
      </div>

      {!reportRow ? (
        <div className="grid flex-1 place-items-center text-center text-sm text-muted-foreground">
          <div>
            <PresentationIcon className="mx-auto mb-2 size-6" />
            Select a report to open it.
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1 bg-muted/40">
            <div ref={container} className="absolute inset-0 [&_iframe]:border-0" />
            {!loaded && !error && (
              <div className="absolute inset-0 grid place-items-center">
                <Spinner />
              </div>
            )}
          </div>
          {panelOpen && (
            <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l p-4 animate-in fade-in slide-in-from-right-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <BookOpenIcon className="size-3.5" /> Tutorial
              </p>
              {tutorial ? (
                <>
                  <h3 className="text-base font-semibold tracking-tight">{tutorial.name}</h3>
                  <RichTextView value={String(tutorial.content ?? "")} className="text-sm leading-relaxed" />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {clicked ? "No tutorial for this visual yet." : "Click a visual to see its tutorial."}
                  {tutorials.length > 0 && ` ${tutorials.length} tutorial${tutorials.length > 1 ? "s" : ""} available.`}
                </p>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
