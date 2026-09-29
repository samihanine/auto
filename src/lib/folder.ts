import { get, set } from "idb-keyval";

// Directory handles can't be serialized to localStorage, IndexedDB keeps them.
const KEY = "atelier:folder";

export const getSavedFolder = () => get<FileSystemDirectoryHandle>(KEY);

export async function pickFolder() {
  const handle = await window.showDirectoryPicker({ id: "atelier", mode: "readwrite" });
  if (!(await requestAccess(handle))) throw new Error("Write access was denied");
  await set(KEY, handle);
  return handle;
}

export const hasAccess = async (handle: FileSystemDirectoryHandle) =>
  (await handle.queryPermission({ mode: "readwrite" })) === "granted";

export const requestAccess = async (handle: FileSystemDirectoryHandle) =>
  (await handle.requestPermission({ mode: "readwrite" })) === "granted";
