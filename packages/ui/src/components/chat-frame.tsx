import { useEffect, useMemo } from "react";

/** An Excel file the chat may read, or read and write. */
export type ChatExcel = { url: string; access: "read" | "write"; name?: string };

/** Everything a host app passes to the embedded chat (through the URL hash). */
export type ChatParams = {
  /** Conversations are stored per scope (e.g. "cms", "powerbi-viewer"). */
  scope: string;
  title?: string;
  initialContext?: string;
  prompt?: string;
  /** Enables the DAX tool on this dataset. */
  datasetUrl?: string;
  excels: ChatExcel[];
};

/** Message the chat posts to its host after writing an Excel file. */
export type ChatMessage = { type: "chat:excel-changed"; url: string };

declare global {
  /** Inlined chat app (single-file exports only), injected by the build. */
  var __CHAT_HTML__: string | undefined;
}

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (value: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
  );

export const encodeChatParams = (params: ChatParams) => `p=${toBase64Url(JSON.stringify(params))}`;

/** Reads the params from `location.hash` ("#p=…"). */
export function decodeChatParams(hash: string): ChatParams | null {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get("p");
  if (!value) return null;
  try {
    return JSON.parse(fromBase64Url(value)) as ChatParams;
  } catch {
    return null;
  }
}

let inlinedChatUrl: string | undefined;

/** Chat app URL: the inlined copy in single-file exports, the dev server otherwise. */
function chatBaseUrl() {
  if (typeof __CHAT_HTML__ === "string" && __CHAT_HTML__) {
    inlinedChatUrl ??= URL.createObjectURL(new Blob([__CHAT_HTML__], { type: "text/html" }));
    return inlinedChatUrl;
  }
  return (import.meta.env.VITE_CHAT_URL as string | undefined) ?? "http://localhost:3003/";
}

/** Embedded chat. The iframe reloads when params change (conversations persist in its storage). */
export function ChatFrame({
  params,
  onExcelChanged,
  className,
}: {
  params: ChatParams;
  onExcelChanged?: (url: string) => void;
  className?: string;
}) {
  const src = useMemo(() => `${chatBaseUrl()}#${encodeChatParams(params)}`, [params]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<ChatMessage>) => {
      if (event.data?.type === "chat:excel-changed") onExcelChanged?.(event.data.url);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onExcelChanged]);

  return <iframe title="Assistant" src={src} className={className ?? "size-full border-0"} />;
}
