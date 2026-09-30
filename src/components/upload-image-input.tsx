import { ImagePlusIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useDatabase, useSettings } from "@/lib/hooks";
import { saveImage } from "@/lib/images";
import { cn, errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { ImagePreview } from "@/components/image-preview";

/** Image field: pick a file, drop it, or paste it (⌘V) — saved into `<workspace>/images/`. */
export function UploadImageInput({
  value,
  onChange,
  readOnly = false,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  readOnly?: boolean;
}) {
  const db = useDatabase();
  const [settings] = useSettings();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const upload = async (image: Blob, name: string) => {
    setBusy(true);
    try {
      onChange(await saveImage(db.dir, image, name, settings.workspacePath));
    } catch (error) {
      toast.add({ title: "Could not save image", description: errorMessage(error), type: "error" });
    } finally {
      setBusy(false);
    }
  };

  /** Image copied from a page: file data when available, otherwise its URL (downloaded if CORS allows). */
  const onPaste = async (e: React.ClipboardEvent) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain").trim();
    const url = html.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? (/^https?:\/\//.test(text) ? text : null);
    if (!file && !url) return;
    e.preventDefault();
    if (file) return upload(file, file.name || "pasted");
    try {
      const blob = await (await fetch(url!)).blob();
      if (!blob.type.startsWith("image/")) throw new Error("Not an image");
      await upload(blob, url!.split(/[/?#]/).filter(Boolean).at(-1) ?? "pasted");
    } catch {
      onChange(url);
    }
  };

  const browse = () => fileInput.current?.click();

  if (readOnly)
    return value ? (
      <ImagePreview value={value} className="aspect-video w-full rounded-xl" />
    ) : (
      <p className="text-sm text-muted-foreground">—</p>
    );

  return (
    <div className="flex flex-col gap-1.5">
      <div
        tabIndex={0}
        onPaste={(e) => void onPaste(e)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
          if (file) void upload(file, file.name);
        }}
        className={cn(
          "group relative aspect-video overflow-hidden rounded-xl border border-dashed border-input bg-input/20 outline-none transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
          dragging && "border-primary bg-primary/5",
          value && "border-solid",
        )}
      >
        {value ? (
          <>
            <ImagePreview value={value} className="size-full rounded-none ring-0" />
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <Button type="button" variant="secondary" size="icon-xs" onClick={browse} aria-label="Replace image">
                <RefreshCwIcon />
              </Button>
              <Button type="button" variant="secondary" size="icon-xs" onClick={() => onChange(null)} aria-label="Remove image">
                <XIcon />
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={browse}
            className="flex size-full flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ImagePlusIcon className="size-5" />
            <span>Click, drop or paste an image</span>
            <span className="text-[11px] text-muted-foreground/70">⌘V after clicking here</span>
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
            <Spinner />
          </div>
        )}
      </div>
      {value && <p className="truncate font-mono text-[11px] text-muted-foreground" title={value}>{value}</p>}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file, file.name);
          e.target.value = "";
        }}
      />
    </div>
  );
}
