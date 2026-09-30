import { slugify } from "./utils";

export const IMAGES_DIR = "images";

const urls = new Map<string, Promise<string | null>>();

export const isRemoteImage = (value: string) => /^(https?:|data:|blob:)/.test(value);

/**
 * Writes the image to `<workspace>/images/` and returns the path stored in Excel.
 * `basePath` is the absolute workspace path (browsers can't read it, so it comes from settings).
 */
export async function saveImage(
  dir: FileSystemDirectoryHandle,
  image: Blob,
  name: string,
  basePath = "",
) {
  const extension =
    { "image/jpeg": "jpg", "image/svg+xml": "svg" }[image.type] ?? image.type.split("/")[1] ?? "png";
  const fileName = `${Date.now()}-${slugify(name.replace(/\.\w+$/, ""))}.${extension}`;

  const folder = await dir.getDirectoryHandle(IMAGES_DIR, { create: true });
  const writable = await (await folder.getFileHandle(fileName, { create: true })).createWritable();
  await writable.write(image);
  await writable.close();

  urls.set(fileName, Promise.resolve(URL.createObjectURL(image)));
  const base = basePath.trim().replace(/[\\/]+$/, "");
  const separator = base.includes("\\") ? "\\" : "/";
  return base ? [base, IMAGES_DIR, fileName].join(separator) : `${IMAGES_DIR}/${fileName}`;
}

/** Turns a stored value (URL or path containing `images/…`) into a displayable URL. */
export function resolveImage(dir: FileSystemDirectoryHandle, value: string) {
  if (isRemoteImage(value)) return Promise.resolve(value);
  const parts = value.split(/[\\/]/);
  const index = parts.lastIndexOf(IMAGES_DIR);
  if (index === -1) return Promise.resolve(null);
  const path = parts.slice(index + 1);
  const key = path.join("/");

  if (!urls.has(key))
    urls.set(
      key,
      (async () => {
        let folder = await dir.getDirectoryHandle(IMAGES_DIR);
        for (const name of path.slice(0, -1)) folder = await folder.getDirectoryHandle(name);
        const file = await (await folder.getFileHandle(path.at(-1)!)).getFile();
        return URL.createObjectURL(file);
      })().catch(() => null),
    );
  return urls.get(key)!;
}

/** Data URL of a stored image (for PPTX / PDF exports). */
export async function imageDataUrl(dir: FileSystemDirectoryHandle, value: string) {
  const url = await resolveImage(dir, value);
  if (!url) return null;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // remote image blocked by CORS
  }
}
