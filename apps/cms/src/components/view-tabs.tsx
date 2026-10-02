import { PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import type { useViews } from "@/lib/views";

/** One tab per saved view: click to open, pencil (or double-click) to rename, × to delete, + to add. */
export function ViewTabs({ views, children }: { views: ReturnType<typeof useViews>; children?: React.ReactNode }) {
  const [editing, setEditing] = useState<string | null>(null);
  const cancelled = useRef(false);
  const startEditing = (id: string) => {
    cancelled.current = false;
    setEditing(id);
  };
  const iconButton =
    "ml-1 hidden size-4 place-items-center rounded text-muted-foreground group-hover:grid hover:bg-background hover:text-foreground";

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b px-2">
      {children}
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
        {views.views.map((view) => {
          const active = view.id === views.view.id;
          return (
            <div
              key={view.id}
              className={cn(
                "group relative flex h-8 shrink-0 items-center rounded-lg px-3 text-[13px] transition-colors",
                active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {editing === view.id ? (
                <input
                  autoFocus
                  defaultValue={view.name}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => {
                    if (!cancelled.current) views.rename(view.id, e.target.value);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      cancelled.current = true;
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-28 rounded bg-background px-1 outline-none ring-2 ring-ring/40"
                />
              ) : (
                <button
                  onClick={() => views.select(view.id)}
                  onDoubleClick={() => views.editable && startEditing(view.id)}
                  title={views.editable ? "Double-click to rename" : undefined}
                >
                  {view.name}
                </button>
              )}
              {active && views.editable && editing !== view.id && (
                <button onClick={() => startEditing(view.id)} aria-label={`Rename ${view.name}`} title="Rename" className={cn(iconButton, "ml-1.5")}>
                  <PencilIcon className="size-3" />
                </button>
              )}
              {active && views.editable && views.views.length > 1 && editing !== view.id && (
                <button onClick={() => views.remove(view.id)} aria-label={`Delete ${view.name}`} title="Delete view" className={iconButton}>
                  <XIcon className="size-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {views.editable && (
        <Button variant="ghost" size="icon-sm" onClick={views.add} aria-label="New view" title="New view (copy of this one)">
          <PlusIcon />
        </Button>
      )}
    </div>
  );
}
