import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DatabaseIcon, FileDownIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useAgentState, useRows } from "@/lib/hooks";
import { datasetOf } from "@/lib/pbi-dataset";
import { buildPbix } from "@/lib/pbix";
import type { CustomTabProps } from "@/lib/schemas";
import { download, errorMessage, slugify } from "@/lib/utils";
import { datasetTable } from "@/table/dataset";
import { reportTable } from "@/table/report";
import { reportPageTable } from "@/table/report-page";
import { reportVisualTable } from "@/table/report-visual";
import { PageCanvas } from "@/components/pbi/page-canvas";
import { SearchSelect } from "@/components/search-select";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** Designs reports on a dataset: the agent writes pages/visuals, the app runs the DAX and renders them. */
export function BuilderTab({ agent, db }: CustomTabProps) {
  const client = useQueryClient();
  const [state, setState] = useAgentState(agent.name);
  const datasets = useRows(db, datasetTable.name);
  const reports = useRows(db, reportTable.name).filter((r) => r.powerBiDatasetId === state.dataset);
  const report = reports.find((r) => r.powerBiReportId === state.report);
  const pages = useRows(db, reportPageTable.name)
    .filter((p) => report && p.powerBiReportId === report.powerBiReportId)
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  const page = pages.find((p) => p.powerBiPageId === state.page) ?? pages[0];
  const visuals = useRows(db, reportVisualTable.name);

  const createReport = async () => {
    const id = `report-${Date.now().toString(36)}`;
    const name = `New report ${reports.length + 1}`;
    try {
      await db.insert(reportTable.name, [{ powerBiReportId: id, name, powerBiDatasetId: state.dataset, source: "Built" }]);
      await db.insert(reportPageTable.name, [
        { powerBiPageId: `${id}-p1`, name: `${name} · Page 1`, powerBiReportId: id, displayName: "Page 1", order: 0, width: 1280, height: 720 },
      ]);
      await setState({ report: id, page: `${id}-p1` });
    } catch (error) {
      toast.add({ title: "Could not create the report", description: errorMessage(error), type: "error" });
    }
  };

  const exportPbix = () => {
    if (!report) return;
    const ids = new Set(pages.map((p) => p.powerBiPageId));
    const bytes = buildPbix({
      pages,
      visuals: visuals.filter((v) => ids.has(v.powerBiPageId)),
      datasetId: String(report.powerBiDatasetId),
      model: datasetOf(db, String(report.powerBiDatasetId)).model,
    });
    download(new Blob([bytes]), `${slugify(report.name)}.pbix`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <SearchSelect
          className="w-60"
          placeholder="Select a dataset…"
          items={datasets.map((d) => ({ value: String(d.powerBiDatasetId), label: d.name }))}
          value={state.dataset ?? null}
          onChange={(value) => void setState({ dataset: String(value ?? ""), report: "", page: "" })}
        />
        {state.dataset && (
          <>
            <SearchSelect
              className="w-60"
              placeholder="Select a report…"
              items={reports.map((r) => ({ value: String(r.powerBiReportId), label: r.name, hint: String(r.source ?? "") }))}
              value={state.report || null}
              onChange={(value) => void setState({ report: String(value ?? ""), page: "" })}
            />
            <Button variant="outline" size="sm" onClick={() => void createReport()}>
              <PlusIcon /> New report
            </Button>
          </>
        )}
        {report && (
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => void client.invalidateQueries({ queryKey: ["dax"] })}>
              <RefreshCwIcon /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportPbix}>
              <FileDownIcon /> PBIX
            </Button>
          </div>
        )}
      </div>

      {!state.dataset ? (
        <Start>
          Select a dataset to start building.{" "}
          <Link to="/import-dataset" className="text-primary hover:underline">Import a dataset</Link>
        </Start>
      ) : !report ? (
        <Start>Select a report or create a new one, then ask the assistant to design it.</Start>
      ) : (
        <PageCanvas
          db={db}
          pages={pages}
          page={page}
          visuals={visuals.filter((v) => page && v.powerBiPageId === page.powerBiPageId)}
          datasetId={state.dataset}
          onPageChange={(id) => void setState({ page: id })}
        />
      )}
    </div>
  );
}

const Start = ({ children }: { children: React.ReactNode }) => (
  <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
    <div>
      <DatabaseIcon className="mx-auto mb-2 size-6" />
      {children}
    </div>
  </div>
);
