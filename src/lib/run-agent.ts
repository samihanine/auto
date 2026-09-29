import { z } from "zod";
import type { Database } from "./crud-table";
import { createConversation, createMessage, getMessages } from "./llm";
import type { AgentSchema, MessageSchema } from "./schemas";
import { getColumns } from "./schemas";
import { errorMessage, truncate } from "./utils";

const MAX_STEPS = 10;
const ANSWER = "answer";

const callsSchema = z
  .array(z.object({ name: z.string(), args: z.record(z.string(), z.unknown()).default({}) }))
  .min(1);

type ToolCall = z.infer<typeof callsSchema>[number];
type ToolResult = { tool: string; ok: boolean; result?: unknown; error?: string };

/**
 * Agent loop on top of the plain-text LLM API:
 * send message → read last assistant message → parse tool calls → run tools → repeat until `answer`.
 */
export async function runAgent({
  agent,
  db,
  text,
  model,
  conversationId,
  onConversation,
  onStep,
}: {
  agent: AgentSchema;
  db: Database;
  text: string;
  model: string;
  conversationId?: string;
  onConversation?: (id: string) => void;
  onStep?: () => void;
}) {
  if (!conversationId) {
    const conversation = await createConversation({
      title: truncate(text, 60),
      agent: agent.name,
      tables: agent.tables.map(({ table }) => ({ table: table.name, path: db.path(table.name) })),
    });
    conversationId = conversation.id;
    onConversation?.(conversationId);
  }

  let content = [
    instructions(agent),
    tag("tools", toolsPrompt(agent)),
    tag("tables", tablesPrompt(agent, db)),
    tag("user_message", text),
  ].join("\n\n");

  for (let step = 0; step < MAX_STEPS; step++) {
    await createMessage({ conversationId, content, model });
    const reply = (await getMessages({ conversationId })).at(-1);
    onStep?.();

    const results = await runCalls(agent, db, reply?.content ?? "");
    if (typeof results === "string") return results;
    content = [instructions(agent), tag("tool_results", JSON.stringify(results))].join("\n\n");
  }
  throw new Error(`The agent did not answer after ${MAX_STEPS} steps`);
}

/** Returns the final answer, or the tool results to send back. */
async function runCalls(agent: AgentSchema, db: Database, reply: string) {
  let calls: ToolCall[];
  try {
    calls = parseCalls(reply);
  } catch (error) {
    return [{ tool: "parser", ok: false, error: `Invalid response: ${errorMessage(error)}` }];
  }

  const answer = calls.find((call) => call.name === ANSWER);
  if (answer && calls.length === 1) return String(answer.args.message ?? "");
  if (answer)
    return [{ tool: ANSWER, ok: false, error: `"${ANSWER}" must be the only tool call` }];

  const results: ToolResult[] = [];
  for (const call of calls) {
    try {
      const tool = agent.tools.find((t) => t.name === call.name);
      if (!tool) throw new Error(`Unknown tool "${call.name}"`);
      results.push({ tool: call.name, ok: true, result: await tool.execute(call.args, { db, agent }) });
    } catch (error) {
      results.push({ tool: call.name, ok: false, error: errorMessage(error) });
    }
  }
  return results;
}

function parseCalls(reply: string): ToolCall[] {
  const json = reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1);
  if (!json) throw new Error("no JSON object found");
  const data = JSON.parse(json);
  return callsSchema.parse(Array.isArray(data) ? data : data.tools);
}

const tag = (name: string, body: string) => `<${name}>\n${body}\n</${name}>`;

const instructions = (agent: AgentSchema) =>
  [
    tag(
      "general_instructions",
      `You are an assistant inside a spreadsheet app. Each table is an Excel file kept in sync with your edits.
Today is ${new Date().toLocaleDateString("en-CA")}.
Reply ONLY with a single JSON object, no prose and no code fences:
{"tools":[{"name":"<tool name>","args":{...}}]}
- You may call several tools in one reply; they run in order and you receive all results in the next message.
- "${ANSWER}" ends your turn: use it alone, once your work is done, to reply to the user.
- Every row has a unique integer "id" (managed by the app) and a unique "name".
- Values: "text" is plain text with \\n line breaks and **bold**; "option" must be one of the listed options; "multiple" columns take an array; dates are YYYY-MM-DD; use null for empty values.
- If a tool fails, fix the call and retry, or explain the problem to the user.`,
    ),
    tag("agent_instructions", `${agent.description}\n${agent.prompt}`),
  ].join("\n\n");

const toolsPrompt = (agent: AgentSchema) =>
  agent.tools
    .map(
      (tool) =>
        `- ${tool.name}: ${tool.description}\n` +
        Object.entries(tool.parameters)
          .map(([name, type]) => `    ${name}: ${type}`)
          .join("\n"),
    )
    .join("\n");

const tablesPrompt = (agent: AgentSchema, db: Database) =>
  agent.tables
    .map(({ table, accessLevel }) => {
      const columns = getColumns(table).map((column) =>
        [
          `  - ${column.name} (${column.dataType}${column.multiple ? ", multiple" : ""}${column.required ? ", required" : ""})`,
          column.description,
          column.options.length && `options: ${column.options.map((o) => o.name).join(" | ")}`,
        ]
          .filter(Boolean)
          .join(" — "),
      );
      return [
        `## ${table.name} (${accessLevel}) — ${table.description}`,
        "Columns:",
        ...columns,
        `Rows: ${JSON.stringify(db.rows(table.name))}`,
      ].join("\n");
    })
    .join("\n\n");

/** How a stored message is shown in the chat (prompts and tool results are hidden). */
export function displayMessage(message: MessageSchema):
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
        return [name, args.table, count].filter(Boolean).join(" · ");
      }),
    };
  } catch {
    return null;
  }
}
