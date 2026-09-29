declare module "html-to-pdfmake" {
  import type { Content } from "pdfmake/interfaces";
  export default function htmlToPdfmake(html: string, options?: { window?: Window; defaultStyles?: Record<string, unknown> }): Content;
}

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker(options?: { id?: string; mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker(options?: {
    startIn?: FileSystemHandle;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }): Promise<FileSystemFileHandle[]>;
}
