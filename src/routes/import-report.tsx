import { createFileRoute } from "@tanstack/react-router";
import type { Database } from "@/lib/crud-table";
import { DatabaseContext, useRows } from "@/lib/hooks";
import { importReport } from "@/lib/pbi-report";
import { reportTable } from "@/table/report";
import { FolderGate } from "@/components/folder-gate";
import { ImportForm } from "@/components/import-form";
import { PageShell, Section } from "@/components/page-shell";

export const Route = createFileRoute("/import-report")({
  ssr: false,
  component: () => (
    <FolderGate>
      {(db) => (
        <DatabaseContext value={db}>
          <ImportReport db={db} />
        </DatabaseContext>
      )}
    </FolderGate>
  ),
});

function ImportReport({ db }: { db: Database }) {
  const reports = useRows(db, reportTable.name).filter((r) => r.source !== "Built");
  return (
    <PageShell
      back="/settings"
      title="Import a Power BI report"
      description="Embeds the report to read its pages, visuals (type, position, fields, formatting, filters, data) and imports its dataset if it is not known yet."
    >
      <ImportForm
        action="Import report"
        fields={[
          { name: "url", label: "Report or embed link", placeholder: "https://app.powerbi.com/reportEmbed?reportId=…", required: true },
          { name: "name", label: "Name (optional, read from Power BI when allowed)", placeholder: "Sales report" },
          { name: "datasetUrl", label: "Dataset link (optional, when the report metadata is not accessible)", placeholder: "https://app.powerbi.com/groups/…/datasets/…" },
        ]}
        run={(values, log) => importReport(db, { url: values.url, name: values.name, datasetUrl: values.datasetUrl }, log)}
      />
      {reports.length > 0 && (
        <Section title="Imported reports">
          <ul className="divide-y rounded-xl border text-sm">
            {reports.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{String(r.powerBiReportId).slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </PageShell>
  );
}
