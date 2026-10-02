import { ImageOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { authenticatedImage } from "./sharepoint";

/** Image from a public URL, falling back to an authenticated Graph download for SharePoint links. */
export function ImageView({ url, className, alt = "" }: { url: string; className?: string; alt?: string }) {
  const [src, setSrc] = useState(url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(url);
    setFailed(false);
  }, [url]);

  const fallback = async () => {
    const authenticated = src === url ? await authenticatedImage(url).catch(() => null) : null;
    if (authenticated) setSrc(authenticated);
    else setFailed(true);
  };

  if (failed)
    return (
      <div className={cn("grid place-items-center bg-muted text-muted-foreground", className)}>
        <ImageOffIcon className="size-4" />
      </div>
    );
  return <img src={src} alt={alt} onError={() => void fallback()} className={cn("object-cover", className)} />;
}
