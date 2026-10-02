import { ImagePlusIcon, XIcon } from "lucide-react";
import { FEATURES } from "@repo/config";
import { useRef, useState } from "react";
import { ImageView } from "@repo/microsoft-auth/image-view";
import { uploadImage } from "@repo/microsoft-auth/sharepoint";
import { Button } from "@repo/ui/components/button";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@repo/ui/components/drawer";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { errorMessage } from "@repo/ui/lib/utils";
import { useSettings } from "@/lib/store";

/**
 * Image URL field. With an images folder configured (settings), files can be picked, dropped or
 * pasted: they are uploaded to SharePoint / OneDrive and shared with an anonymous link.
 */
export function ImageInput({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const [settings] = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const canUpload = FEATURES.imageUpload && !!settings.imagesFolder;

  const upload = async (file: Blob, name: string) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(settings.imagesFolder, file, name));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const imageFile = (files: FileList) => [...files].find((f) => f.type.startsWith("image/"));

  return (
    <div className="flex flex-col gap-2">
      <div
        tabIndex={canUpload ? 0 : undefined}
        onPaste={(e) => {
          const file = canUpload && imageFile(e.clipboardData.files);
          if (file) {
            e.preventDefault();
            void upload(file, file.name || "pasted");
          }
        }}
        onDragOver={(e) => canUpload && e.preventDefault()}
        onDrop={(e) => {
          const file = canUpload && imageFile(e.dataTransfer.files);
          if (!file) return;
          e.preventDefault();
          void upload(file, file.name);
        }}
        className="relative grid aspect-video place-items-center overflow-hidden rounded-xl border border-dashed border-input bg-input/20 outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
      >
        {value ? (
          <Drawer>
            <DrawerTrigger className="size-full cursor-zoom-in">
              <ImageView url={value} className="size-full" />
            </DrawerTrigger>
            <DrawerContent>
              <DrawerTitle className="px-4 pt-4">Image</DrawerTitle>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                <ImageView url={value} className="mx-auto max-w-none rounded-lg object-contain" />
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <button
            type="button"
            disabled={!canUpload}
            onClick={() => fileInput.current?.click()}
            className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground enabled:hover:text-foreground"
          >
            <ImagePlusIcon className="size-5" />
            {canUpload ? "Click, drop or paste (⌘V) an image" : "Paste an image link below"}
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
            <Spinner />
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          type="url"
          placeholder="https://…"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="rounded-xl font-mono text-xs"
        />
        {value && (
          <Button variant="ghost" size="icon-sm" onClick={() => onChange(null)} aria-label="Remove image">
            <XIcon />
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
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
