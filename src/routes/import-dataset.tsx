import { createFileRoute } from "@tanstack/react-router";
import type { Database } from "@/lib/crud-table";
import { DatabaseContext, useRows } from "@/lib/hooks";
import { importDataset } from "@/lib/pbi-dataset";
import { datasetTable } from "@/table/dataset";
import { FolderGate } from "@/components/folder-gate";
import { ImportForm } from "@/components/import-form";
import { PageShell, Section } from "@/components/page-shell";

export const Route = createFileRoute("/import-dataset")({
  ssr: false,
  component: () => (
    <FolderGate>
      {(db) => (
        <DatabaseContext value={db}>
          <ImportDataset db={db} />
        </DatabaseContext>
      )}
    </FolderGate>
  ),
});

function ImportDataset({ db }: { db: Database }) {
  const datasets = useRows(db, datasetTable.name);
  return (
    <PageShell
      back="/settings"
      title="Import a Power BI dataset"
      description="Reads tables, columns, measures and relationships with DAX queries only (executeQueries), so Build or Read access to the dataset is enough — no workspace membership needed."
    >
      <ImportForm
        action="Import dataset"
        fields={[
          { name: "url", label: "Dataset link or id", placeholder: "https://app.powerbi.com/groups/…/datasets/…", required: true },
          { name: "name", label: "Name (optional — not readable with DAX)", placeholder: "Sales model" },
        ]}
        run={async ({ url, name }, log) => {
          log("Reading the model…");
          const { model } = await importDataset(db, url, name);
          const count = (key: "columns" | "measures") => model.tables.reduce((n, t) => n + t[key].length, 0);
          log(`Done: ${model.tables.length} tables, ${count("columns")} columns, ${count("measures")} measures, ${model.relationships.length} relationships.`);
        }}
      />
      {datasets.length > 0 && (
        <Section title="Imported datasets">
          <ul className="divide-y rounded-xl border text-sm">
            {datasets.map((d) => (
              <li key={d.id} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="truncate">{d.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{String(d.powerBiDatasetId).slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </PageShell>
  );
}
