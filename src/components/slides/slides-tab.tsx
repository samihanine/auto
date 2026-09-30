import { FileDownIcon, PresentationIcon } from "lucide-react";
import { useState } from "react";
import { useRows } from "@/lib/hooks";
import type { CustomTabProps } from "@/lib/schemas";
import { deck } from "@/lib/slides/layout";
import { errorMessage } from "@/lib/utils";
import { pptxSectionTable } from "@/table/pptx-section";
import { pptxSlideTable } from "@/table/pptx-slide";
import { SlideView } from "@/components/slides/slide-view";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

/** Deck preview built from pptxSlide + pptxSection, with PPTX / PDF export. */
export function SlidesTab({ db }: CustomTabProps) {
  const slides = useRows(db, pptxSlideTable.name);
  const sections = useRows(db, pptxSectionTable.name);
  const items = deck(slides, sections);
  const [selectedId, setSelectedId] = useState<number>();
  const current = items.find(({ slide }) => slide.id === selectedId) ?? items[0];
  const [busy, setBusy] = useState<string | null>(null);

  const exportAs = async (format: "pptx" | "pdf") => {
    setBusy(format);
    try {
      const run = format === "pptx"
        ? (await import("@/lib/slides/export-pptx")).exportPptx
        : (await import("@/lib/slides/export-pdf")).exportPdf;
      await run(db.dir, slides, sections, "deck");
    } catch (error) {
      toast.add({ title: `Could not export ${format.toUpperCase()}`, description: errorMessage(error), type: "error" });
    } finally {
      setBusy(null);
    }
  };

  if (!items.length)
    return (
      <div className="grid flex-1 place-items-center text-center text-sm text-muted-foreground">
        <div>
          <PresentationIcon className="mx-auto mb-2 size-6" />
          No slides yet — ask the assistant to draft a deck.
        </div>
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r p-3">
        {items.map(({ slide, sections }, index) => (
          <button
            key={slide.id}
            onClick={() => setSelectedId(slide.id)}
            data-selected={slide.id === current?.slide.id}
            className="group flex gap-2 text-left"
          >
            <span className="w-4 pt-0.5 text-right text-[11px] text-muted-foreground tabular-nums">{index + 1}</span>
            <SlideView
              slide={slide}
              sections={sections}
              className="rounded-md ring-1 ring-border transition-shadow group-data-[selected=true]:ring-2 group-data-[selected=true]:ring-primary"
            />
          </button>
        ))}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <span className="text-xs text-muted-foreground tabular-nums">{items.length} slides</span>
          <div className="ml-auto flex gap-2">
            {(["pptx", "pdf"] as const).map((format) => (
              <Button key={format} variant="outline" size="sm" disabled={!!busy} onClick={() => void exportAs(format)}>
                {busy === format ? <Spinner /> : <FileDownIcon />} {format.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-muted/40 p-8">
          {current && (
            <div className="w-full max-w-5xl">
              <SlideView slide={current.slide} sections={current.sections} className="rounded-lg shadow-xl ring-1 ring-black/5" />
              {current.slide.notes && (
                <p className="mt-4 text-sm whitespace-pre-line text-muted-foreground">{String(current.slide.notes)}</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
