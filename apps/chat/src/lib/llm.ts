/**
 * Deliberately minimal LLM API: conversations of plain-text messages.
 * No tool use, no JSON mode — the agent is built on top (see agent.ts).
 */
import type { Conversation, Message } from "./store";
import { store } from "./store";

/* -------------------------------------------------------------------------- */
/* Provider settings — change these to target another compatible chat API.    */
/* -------------------------------------------------------------------------- */

/** Base URL of the API. */
const AI_BASE_URL = "https://api.openai.com/v1";

/**
 * Remote conversations: path that creates one (POST, body `{ name }`) and the response field
 * holding its id. `null` = stateless API, the whole history is sent with every message.
 */
const AI_CONVERSATION_PATH: string | null = null;
const AI_CONVERSATION_ID_FIELD = "id";

/** Path of a completion; `{conversationId}` is replaced by the remote conversation id. */
const AI_MESSAGE_PATH = "/chat/completions";

/** "json": one JSON response. "sse": event stream (`event: content` chunks until `event: done`). */
const AI_RESPONSE: "json" | "sse" = "json";

/**
 * Request headers built from the AI key saved in the chat. The key is either a plain token or
 * several `NAME=value` pairs (one per line), available in `fields`.
 */
const AI_HEADERS = (key: AiKey): Record<string, string> => ({ Authorization: `Bearer ${key.token}` });

/** Request body. `messages` = whole history (stateless APIs), `message` = the new user turn. */
const AI_BODY = ({ model, messages }: { model: string; messages: Message[]; message: string }) => ({
  model,
  messages: messages.map(({ role, content }) => ({ role, content })),
});

/** Reply text of a "json" response. */
const AI_REPLY = (data: { choices?: { message?: { content?: string } }[] }) => data.choices?.[0]?.message?.content ?? "";

/* -------------------------------------------------------------------------- */

type AiKey = { token: string; fields: Record<string, string> };

/** "abc" → token; "NAME=value" lines → fields (the first value is also the token). */
function parseKey(raw: string): AiKey {
  const fields = Object.fromEntries([...raw.matchAll(/([A-Za-z0-9_]+)=(\S+)/g)].map((m) => [m[1], m[2]]));
  return { token: Object.values(fields)[0] ?? raw.trim(), fields };
}

export class AiAuthError extends Error {
  constructor(status: number) {
    super(status ? `The AI key was rejected (HTTP ${status}).` : "Missing AI key — add it with the key button above.");
  }
}

const now = () => new Date();

export const createConversation = (input: Pick<Conversation, "title" | "scope">) =>
  store.conversations.put({ ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() });

export const getConversations = async ({ scope }: { scope: string }) =>
  (await store.conversations.list())
    .filter((conversation) => conversation.scope === scope)
    .sort((a, b) => +b.updatedAt - +a.updatedAt);

export const getMessages = async ({ conversationId }: { conversationId: string }) =>
  (await store.messages(conversationId).list()).sort((a, b) => +a.createdAt - +b.createdAt);

/** Adds a user message, then waits for the model reply (readable via getMessages). */
export async function createMessage({ conversationId, content, model }: { conversationId: string; content: string; model: string }) {
  let conversation = await store.conversations.get(conversationId);
  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);
  const messages = store.messages(conversationId);
  const message = await messages.put(newMessage(conversationId, "user", content));

  // Stateful APIs keep the history on their side, in a remote conversation created once.
  if (AI_CONVERSATION_PATH && !conversation.remoteId)
    conversation = await store.conversations.put({ ...conversation, remoteId: await createRemoteConversation(conversation.title) });

  const reply = await complete({
    model,
    message: content,
    messages: await getMessages({ conversationId }),
    remoteId: conversation.remoteId,
  });
  await messages.put({ ...newMessage(conversationId, "assistant", reply), model });
  await store.conversations.put({ ...conversation, updatedAt: now() });
  return message;
}

const newMessage = (conversationId: string, role: Message["role"], content: string): Message => ({
  id: crypto.randomUUID(),
  conversationId,
  role,
  content,
  createdAt: now(),
  updatedAt: now(),
});

async function request(path: string, body: unknown) {
  const { aiKey } = await store.settings.get();
  if (!aiKey) throw new AiAuthError(0);
  const response = await fetch(`${AI_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AI_HEADERS(parseKey(aiKey)) },
    body: JSON.stringify(body),
  });
  if (response.status === 401 || response.status === 403) throw new AiAuthError(response.status);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message ?? data.content ?? `AI request failed (${response.status})`);
  }
  return response;
}

async function createRemoteConversation(name: string) {
  const data = await (await request(AI_CONVERSATION_PATH!, { name: name || `session @ ${now().toISOString()}` })).json();
  const id = data[AI_CONVERSATION_ID_FIELD];
  if (!id) throw new Error("The AI API did not return a conversation id");
  return String(id);
}

async function complete({ model, message, messages, remoteId }: { model: string; message: string; messages: Message[]; remoteId?: string }) {
  const response = await request(AI_MESSAGE_PATH.replace("{conversationId}", remoteId ?? ""), AI_BODY({ model, messages, message }));
  return AI_RESPONSE === "sse" ? readStream(response) : String(AI_REPLY(await response.json()));
}

/** Server-sent events: concatenates `content` events until `done` (a done payload `{"valid":false}` is an error). */
async function readStream(response: Response) {
  if (!response.body) throw new Error("Empty stream from the AI API");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let event = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).replace(/^ /, "");
      if (event === "content") text += data;
      if (event === "done") {
        if (/"valid"\s*:\s*false/.test(data)) throw new Error("The AI API returned an invalid completion");
        return text.trim();
      }
    }
  }
  return text.trim();
}
