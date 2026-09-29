import { ImageOffIcon } from "lucide-react";
import { useImageUrl } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

/** Thumbnail that opens the image at its real size in a drawer. */
export function ImagePreview({ value, className }: { value: string; className?: string }) {
  const url = useImageUrl(value);
  const name = value.split(/[\\/]/).at(-1);

  return (
    <Drawer>
      <DrawerTrigger
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "grid cursor-zoom-in place-items-center overflow-hidden rounded-md bg-muted ring-1 ring-border/60 transition-opacity hover:opacity-90",
          className,
        )}
      >
        {url ? (
          <img src={url} alt={name} className="size-full object-cover" />
        ) : (
          <ImageOffIcon className="size-3.5 text-muted-foreground/60" />
        )}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{name}</DrawerTitle>
          <DrawerDescription className="truncate font-mono text-xs">{value}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {url && <img src={url} alt={name} className="mx-auto max-w-none rounded-lg" />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
