import { getToken } from "./client";
import type { DriveItem } from "./graph";
import { graphFetch, resolveLink, shareId } from "./graph";

/**
 * Uploads an image into a OneDrive / SharePoint folder (given by its link) and returns a URL
 * usable everywhere: an anonymous link when the tenant allows it (works with Excel =IMAGE()),
 * the file's SharePoint URL otherwise.
 */
export async function uploadImage(folderUrl: string, file: Blob, name: string) {
  const folder = await resolveLink(folderUrl);
  if (!folder.folder) throw new Error("The images link must point to a folder");
  const extension = file.type.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "png";
  const fileName = `${Date.now()}-${name.replace(/\.\w+$/, "").replace(/[^\w-]+/g, "-").slice(0, 40) || "image"}.${extension}`;
  const drive = folder.parentReference.driveId;

  const item = await graphFetch<DriveItem>(`/drives/${drive}/items/${folder.id}:/${encodeURIComponent(fileName)}:/content`, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  try {
    const { link } = await graphFetch<{ link: { webUrl: string } }>(`/drives/${drive}/items/${item.id}/createLink`, {
      method: "POST",
      body: JSON.stringify({ type: "view", scope: "anonymous" }),
    });
    return `${link.webUrl}${link.webUrl.includes("?") ? "&" : "?"}download=1`;
  } catch {
    return item.webUrl; // anonymous links disabled: visible in the apps, not in Excel
  }
}

const isMicrosoftUrl = (url: string) => /sharepoint\.com|onedrive\.live\.com|1drv\.ms/i.test(url);

/** Object URL of an image only readable with the user's token (SharePoint / OneDrive). */
export async function authenticatedImage(url: string) {
  if (!isMicrosoftUrl(url)) return null;
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/shares/${shareId(url.replace(/[?&]download=1$/, ""))}/driveItem/content`,
    { headers: { Authorization: `Bearer ${await getToken("graph")}` } },
  );
  return response.ok ? URL.createObjectURL(await response.blob()) : null;
}
