import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpIcon, DownloadIcon, PanelLeftCloseIcon, SquarePenIcon, WrenchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Database } from "@/lib/crud-table";
import { useSettings } from "@/lib/hooks";
import { getConversations, getMessages } from "@/lib/llm";
import { displayMessage, runAgent } from "@/lib/run-agent";
import type { AgentSchema, ConversationSchema } from "@/lib/schemas";
import { MODELS } from "@/lib/schemas";
import { downloadJson, errorMessage } from "@/lib/utils";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Chat({ agent, db, onClose }: { agent: AgentSchema; db: Database; onClose: () => void }) {
  const client = useQueryClient();
  const [settings, updateSettings] = useSettings();
  const conversationId = settings.conversations[agent.name];
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<{ text: string; after: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", agent.name],
    queryFn: () => getConversations({ agent: agent.name }),
  });
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => getMessages({ conversationId: conversationId! }),
    enabled: !!conversationId,
  });
  const visible = conversationId ? messages : [];
  const items = visible.map((message) => ({ id: message.id, view: displayMessage(message) }));

  const selectConversation = (id?: string) => {
    setError(null);
    void updateSettings({ conversations: { ...settings.conversations, [agent.name]: id ?? "" } });
  };

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [items.length, pending]);

  const send = async () => {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    setError(null);
    setPending({ text, after: visible.length });
    try {
      await runAgent({
        agent,
        db,
        text,
        model: settings.model,
        conversationId: conversationId || undefined,
        onConversation: (id) => selectConversation(id),
        onStep: () => client.invalidateQueries({ queryKey: ["messages"] }),
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
      await client.invalidateQueries({ queryKey: ["messages"] });
      await client.invalidateQueries({ queryKey: ["conversations"] });
    }
  };

  const current = conversations.find((c) => c.id === conversationId) ?? null;

  /** Raw export: every stored message, including context prompts and tool calls/results. */
  const exportConversation = async () => {
    if (!current) return;
    const messages = await getMessages({ conversationId: current.id });
    downloadJson({ conversation: current, messages }, `conversation-${current.title}`);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
        <Combobox
          items={conversations}
          value={current}
          onValueChange={(value) => selectConversation((value as ConversationSchema | null)?.id)}
          itemToStringLabel={(item: ConversationSchema) => item.title}
          isItemEqualToValue={(a: ConversationSchema, b: ConversationSchema) => a.id === b.id}
        >
          <ComboboxTrigger
            render={<Button variant="ghost" size="sm" className="min-w-0 flex-1 justify-between font-medium" />}
          >
            <span className="truncate">{current?.title ?? "New conversation"}</span>
          </ComboboxTrigger>
          <ComboboxContent className="w-80">
            <ComboboxInput showTrigger={false} placeholder="Search conversations" />
            <ComboboxEmpty>No conversations</ComboboxEmpty>
            <ComboboxList>
              {(item: ConversationSchema) => (
                <ComboboxItem key={item.id} value={item}>
                  <span className="truncate">{item.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {item.updatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!current}
          onClick={() => void exportConversation()}
          aria-label="Download conversation (JSON)"
          title="Download conversation (JSON)"
        >
          <DownloadIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => selectConversation()} aria-label="New conversation">
          <SquarePenIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close chat">
          <PanelLeftCloseIcon />
        </Button>
      </header>

      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4">
        {!items.length && !pending && (
          <div className="m-auto max-w-60 text-center">
            <p className="text-sm font-medium">{agent.label} assistant</p>
            <p className="mt-1 text-xs text-muted-foreground">{agent.description}. Ask it to add, update or clean up rows.</p>
          </div>
        )}
        {items.map(({ id, view }) => {
          if (!view) return null;
          if (view.kind === "steps")
            return view.steps.map((step, index) => (
              <p key={`${id}-${index}`} className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                <WrenchIcon className="size-3" /> {step}
              </p>
            ));
          return <ChatBubble key={id} role={view.kind} text={view.text} />;
        })}
        {pending && visible.length <= pending.after && <ChatBubble role="user" text={pending.text} />}
        {pending && <TypingIndicator />}
        {error && (
          <Bubble variant="destructive">
            <BubbleContent className="rounded-2xl">{error}</BubbleContent>
          </Bubble>
        )}
      </div>

      <div className="p-3 pt-0">
        {!settings.openaiKey && (
          <p className="mb-2 px-1 text-xs text-muted-foreground">
            Add your OpenAI key in{" "}
            <Link to="/settings" className="text-primary underline-offset-2 hover:underline">
              Settings
            </Link>{" "}
            to start chatting.
          </p>
        )}
        <div className="rounded-2xl border bg-background shadow-[0_1px_3px_rgb(0_0_0/0.05)] transition-shadow focus-within:border-ring/60 focus-within:ring-3 focus-within:ring-ring/15">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={`Ask ${agent.label.toLowerCase()} assistant…`}
            className="field-sizing-content max-h-48 min-h-14 w-full resize-none bg-transparent px-3.5 pt-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <Select value={settings.model} onValueChange={(model) => updateSettings({ model: model as (typeof MODELS)[number] })}>
              <SelectTrigger size="sm" className="h-7 rounded-lg border-none bg-transparent px-2 text-xs text-muted-foreground hover:bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} side="top" align="start">
                {MODELS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon-sm"
              className="size-7 min-h-0 rounded-full"
              disabled={!input.trim() || !!pending}
              onClick={() => void send()}
              aria-label="Send"
            >
              <ArrowUpIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, text }: { role: "user" | "answer"; text: string }) {
  if (role === "user")
    return (
      <Bubble align="end">
        <BubbleContent className="rounded-2xl rounded-br-md whitespace-pre-wrap">{text}</BubbleContent>
      </Bubble>
    );
  return (
    <Bubble variant="muted" className="max-w-[92%]">
      <BubbleContent className="markdown rounded-2xl rounded-bl-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </BubbleContent>
    </Bubble>
  );
}

function TypingIndicator() {
  return (
    <Bubble variant="muted">
      <BubbleContent className="flex gap-1 rounded-2xl rounded-bl-md py-3.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </BubbleContent>
    </Bubble>
  );
}
