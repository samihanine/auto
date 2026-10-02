import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ChatParams } from "@repo/ui/components/chat-frame";
import { decodeChatParams } from "@repo/ui/components/chat-frame";
import { Chat } from "@/components/chat";

export const Route = createFileRoute("/")({ component: ChatPage });

const STANDALONE: ChatParams = { scope: "standalone", excels: [] };

/** Params come from the URL hash (#p=…) set by the host app; hash changes don't reload the iframe. */
function ChatPage() {
  const [params, setParams] = useState(() => decodeChatParams(location.hash) ?? STANDALONE);
  useEffect(() => {
    const onHash = () => setParams(decodeChatParams(location.hash) ?? STANDALONE);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return (
    <div className="h-dvh">
      <Chat key={params.scope} params={params} />
    </div>
  );
}
