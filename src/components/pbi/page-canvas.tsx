import type { Database } from "@/lib/crud-table";
import type { Row } from "@/lib/schemas";
import { VisualView } from "@/components/pbi/visual-view";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Page tabs + the page canvas scaled to the available width, visuals placed by x/y/width/height. */
export function PageCanvas({
  db,
  pages,
  page,
  visuals,
  datasetId,
  onPageChange,
}: {
  db: Database;
  pages: Row[];
  page?: Row;
  visuals: Row[];
  datasetId?: string;
  onPageChange: (id: string) => void;
}) {
  const width = Number(page?.width ?? 1280) || 1280;
  const height = Number(page?.height ?? 720) || 720;
  const percent = (value: unknown, total: number) => `${(Number(value ?? 0) / total) * 100}%`;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/40">
      {pages.length > 0 && (
        <Tabs value={page?.powerBiPageId ?? ""} onValueChange={(id) => onPageChange(String(id))} className="px-4 pt-3">
          <TabsList variant="line">
            {pages.map((p) => (
              <TabsTrigger key={p.id} value={String(p.powerBiPageId)} className="flex-none text-[13px]">
                {String(p.displayName || p.name)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {page ? (
          <div
            className="relative mx-auto w-full max-w-6xl rounded-xl bg-background shadow-lg ring-1 ring-black/5"
            style={{ aspectRatio: `${width} / ${height}` }}
          >
            {visuals
              .filter((v) => !v.hidden)
              .sort((a, b) => Number(a.z ?? 0) - Number(b.z ?? 0))
              .map((visual) => (
                <div
                  key={visual.id}
                  className="absolute p-1"
                  style={{
                    left: percent(visual.x, width),
                    top: percent(visual.y, height),
                    width: percent(visual.width ?? 300, width),
                    height: percent(visual.height ?? 200, height),
                  }}
                >
                  <VisualView db={db} visual={visual} datasetId={datasetId} />
                </div>
              ))}
            {!visuals.length && (
              <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                Empty page — ask the assistant to add visuals.
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">This report has no pages yet.</p>
        )}
      </div>
    </div>
  );
}
