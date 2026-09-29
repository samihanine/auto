/**
 * Deliberately minimal LLM API: conversations of plain-text messages.
 * No streaming, no tool use, no JSON mode — agents are built on top (see run-agent.ts).
 */
import type { ConversationSchema, MessageSchema } from "./schemas";
import { storage } from "./storage";

const now = () => new Date();

export const createConversation = async (
  input: Pick<ConversationSchema, "title" | "agent" | "tables">,
): Promise<ConversationSchema> =>
  storage.conversations.put({
    ...input,
    id: crypto.randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  });

export const getConversations = async ({ agent }: { agent?: string } = {}) =>
  (await storage.conversations.list())
    .filter((conversation) => !agent || conversation.agent === agent)
    .sort((a, b) => +b.updatedAt - +a.updatedAt);

export const getMessages = async ({
  conversationId,
}: {
  conversationId: string;
}): Promise<MessageSchema[]> =>
  (await storage.messages(conversationId).list()).sort(
    (a, b) => +a.createdAt - +b.createdAt,
  );

/** Adds a user message, then waits for the model reply (readable via getMessages). */
export const createMessage = async ({
  conversationId,
  content,
  model,
}: {
  conversationId: string;
  content: string;
  model: string;
}): Promise<MessageSchema> => {
  const conversation = await storage.conversations.get(conversationId);
  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

  const messages = storage.messages(conversationId);
  const message = await messages.put(newMessage(conversationId, "user", content));
  const history = await getMessages({ conversationId });

  const reply = await complete(model, history);
  await messages.put({ ...newMessage(conversationId, "assistant", reply), model });
  await storage.conversations.put({ ...conversation, updatedAt: now() });
  return message;
};

const newMessage = (
  conversationId: string,
  role: MessageSchema["role"],
  content: string,
): MessageSchema => ({
  id: crypto.randomUUID(),
  conversationId,
  role,
  content,
  createdAt: now(),
  updatedAt: now(),
});

async function complete(model: string, history: MessageSchema[]) {
  const { openaiKey } = await storage.settings.get();
  if (!openaiKey) throw new Error("Missing OpenAI API key — add it in Settings.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: history.map(({ role, content }) => ({ role, content })),
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? response.statusText);
  return String(data.choices?.[0]?.message?.content ?? "");
}
