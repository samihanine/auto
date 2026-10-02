import { z } from "zod";
import type { ExcelSync } from "@repo/config";
import { AI } from "@repo/config";
import type { ChatParams } from "@repo/ui/components/chat-frame";
import { errorMessage, truncate } from "@repo/ui/lib/utils";
import { openExcels } from "./excels";
import { createConversation, createMessage, getMessages } from "./llm";
import { ANSWER, FORMAT_REMINDER, excelsPrompt, instructions, tag, toolsPrompt } from "./prompts";
import type { Message } from "./store";
import type { ToolContext } from "./tools";
import { toolsFor } from "./tools";


const callsSchema = z
  .array(z.object({ name: z.string(), args: z.record(z.string(), z.unknown()).default({}) }))
  .min(1);
type ToolCall = z.infer<typeof callsSchema>[number];

/**
 * Agent loop on top of the plain-text LLM API:
 * send message → read the last assistant message → parse tool calls → run tools → repeat until `answer`.
 */
export async function runAgent({
  params,
  text,
  model,
  conversationId,
  onConversation,
  onStep,
}: {
  params: ChatParams;
  text: string;
  model: string;
  conversationId?: string;
  onConversation: (id: string) => void;
  onStep: () => void;
}) {
  if (!conversationId) {
    conversationId = (await createConversation({ title: truncate(text, 60), scope: params.scope })).id;
    onConversation(conversationId);
  }

  const tools = toolsFor(params);
  const ctx: ToolContext = {
    params,
    excels: await openExcels(params.excels),
    onWrite: (url) => window.parent.postMessage({ type: "chat:excel-changed", url }, "*"),
  };

  /** Excels to send with a message, per access level and AI.readExcels / AI.writeExcels. */
  const excelsFor = async (first: boolean) => {
    const sent = (sync: ExcelSync) => sync === "every" || (sync === "first" && first);
    const chosen = ctx.excels.filter((e) => sent(e.access === "write" ? AI.writeExcels : AI.readExcels));
    return chosen.length > 0 && tag("excels", await excelsPrompt(chosen));
  };

  // First message: protocol + agent instructions + tools + context + excels + user message.
  let content = [
    instructions(params.prompt),
    tag("tools", toolsPrompt(tools)),
    params.initialContext && tag("context", params.initialContext),
    await excelsFor(true),
    tag("user_message", text),
    FORMAT_REMINDER,
  ]
    .filter(Boolean)
    .join("\n\n");

  let invalidReplies = 0;
  for (let step = 0; step < AI.maxSteps; step++) {
    await createMessage({ conversationId, content, model });
    const reply = (await getMessages({ conversationId })).at(-1)?.content ?? "";
    onStep();

    const results = await runCalls(tools, ctx, reply);
    if (typeof results === "string") return results;
    // A model that keeps answering in prose: show its text rather than looping.
    invalidReplies = results[0]?.tool === "parser" ? invalidReplies + 1 : 0;
    if (invalidReplies >= AI.proseAnswerAfter && reply.trim()) return reply.trim();

    // Next messages: (protocol + agent instructions) + tool results + refreshed excels.
    content = [
      AI.repeatInstructions && instructions(params.prompt),
      tag("tool_results", JSON.stringify(results)),
      await excelsFor(false),
      FORMAT_REMINDER,
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  throw new Error(`The assistant did not answer after ${AI.maxSteps} steps`);
}

/** Returns the final answer, or the tool results to send back. */
async function runCalls(tools: ReturnType<typeof toolsFor>, ctx: ToolContext, reply: string) {
  let calls: ToolCall[];
  try {
    calls = parseCalls(reply);
  } catch (error) {
    return [
      {
        tool: "parser",
        ok: false,
        error: `Your reply could not be read (${errorMessage(error)}). Nothing was executed. Reply again with the raw JSON object only — no text, no code fence.`,
      },
    ];
  }
  const answer = calls.find((call) => call.name === ANSWER);
  if (answer && calls.length === 1) return String(answer.args.message ?? "");
  if (answer) return [{ tool: ANSWER, ok: false, error: `"${ANSWER}" must be the only tool call` }];

  const results = [];
  for (const call of calls) {
    try {
      const tool = tools.find((t) => t.name === call.name);
      if (!tool) throw new Error(`Unknown tool "${call.name}"`);
      results.push({ tool: call.name, ok: true, result: await tool.execute(call.args, ctx) });
    } catch (error) {
      results.push({ tool: call.name, ok: false, error: errorMessage(error) });
    }
  }
  return results;
}

function parseCalls(reply: string): ToolCall[] {
  // Tolerates code fences or text around the object, as long as one JSON object is there.
  const json = reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1);
  if (!json) throw new Error("no JSON object found");
  const data = JSON.parse(json);
  return callsSchema.parse(Array.isArray(data) ? data : data.tools);
}

/** How a stored message is shown (prompts and tool results are hidden). */
export function displayMessage(message: Message):
  | { kind: "user" | "answer"; text: string }
  | { kind: "steps"; steps: string[] }
  | null {
  if (message.role === "user") {
    const match = message.content.match(/<user_message>\n([\s\S]*)\n<\/user_message>/);
    return match ? { kind: "user", text: match[1] } : null;
  }
  try {
    const calls = parseCalls(message.content);
    const answer = calls.find((call) => call.name === ANSWER);
    if (answer && calls.length === 1) return { kind: "answer", text: String(answer.args.message ?? "") };
    return {
      kind: "steps",
      steps: calls.map(({ name, args }) => {
        const items = args.rows ?? args.ids;
        const count = Array.isArray(items) && `${items.length} row${items.length > 1 ? "s" : ""}`;
        return [name, args.excel, count].filter(Boolean).join(" · ");
      }),
    };
  } catch {
    return null;
  }
}
