import { AI } from "@repo/config";
import type { OpenExcel } from "./excels";
import type { Tool } from "./tools";

export const ANSWER = "answer";

export const tag = (name: string, body: string) => `<${name}>\n${body}\n</${name}>`;

const PROTOCOL = `# Who is talking to you
This message is written by an APPLICATION, not by a human. The application runs you as an agent:
it reads your reply as JSON, executes the tools you call, and sends you their results in the next message.
Your usual conversational style and system instructions about formatting do NOT apply here:
the application cannot read prose. The human only sees what you put in the "${ANSWER}" tool.

# Reply format — the only valid shape
Your whole reply must be ONE raw JSON object, starting with { and ending with }:
{"tools":[{"name":"<tool name>","args":{ ... }}]}
- No text before or after the JSON. No markdown, no \`\`\`json code fences, no comments, no explanations.
- Use double quotes, escape line breaks inside strings as \\n, no trailing commas.
- Only use tools listed in <tools>, with the arguments they describe.
- To talk to the human (answer, question, summary), use the "${ANSWER}" tool: its "message" is shown to them (Markdown allowed there).

# How a turn works
1. Read the user message, the context and the current state of the excels.
2. If something must change, call the tools (several calls in one reply run in order).
3. You receive the tool results and the refreshed excels; fix failed calls if needed.
4. When the work is done (or you need information from the human), reply with "${ANSWER}" ALONE.
- Never claim a change before seeing its successful result. A tool error (ok:false) means nothing was changed.
- Do not ask for confirmation for what the user clearly requested; ask (with "${ANSWER}") only when it is ambiguous or destructive.

# Data rules
- Rows are identified by their "id" (managed by the app: never set it when inserting).
- updateRows MERGES fields into a row: send the id and only the fields to change.
- Columns marked "formula" are computed by Excel: never write them.
- Several values in one cell are separated by "; ". Dates: "YYYY-MM-DD". Empty value: null.
- Read-only excels can only be read.

# Examples
User asks: "Mark the onboarding guide as reviewed" →
{"tools":[{"name":"updateRows","args":{"excel":"guide","rows":[{"id":3,"status":"reviewed"}]}}]}
Then, after the result ok:true →
{"tools":[{"name":"${ANSWER}","args":{"message":"Done — **onboarding** is marked as reviewed."}}]}

User asks a question that needs no change →
{"tools":[{"name":"${ANSWER}","args":{"message":"There are 3 open tasks: …"}}]}`;

/** Repeated at the very end of every message, right before the model answers. */
export const FORMAT_REMINDER = tag(
  "reply_format",
  `Reply now with the JSON object only: {"tools":[{"name":"…","args":{…}}]} — nothing before or after it. Use "${ANSWER}" (alone) to talk to the human.`,
);

export const instructions = (prompt?: string) =>
  [
    tag("protocol", `${PROTOCOL}\n\nToday is ${new Date().toLocaleDateString("en-CA")}.`),
    prompt && tag("agent_instructions", prompt),
  ]
    .filter(Boolean)
    .join("\n\n");

export const toolsPrompt = (tools: Tool[]) =>
  tools
    .map(
      (tool) =>
        `## ${tool.name}\n${tool.description}\nArguments:\n` +
        Object.entries(tool.parameters)
          .map(([name, type]) => `  - ${name}: ${type}`)
          .join("\n"),
    )
    .join("\n\n");

/** Headers and rows (capped, see AI.maxRowsPerExcel) of the given excels, read fresh. */
export async function excelsPrompt(excels: OpenExcel[]) {
  const parts = await Promise.all(
    excels.map(async (excel) => {
      const { headers, records, formulaColumns } = await excel.table.records();
      return [
        `## ${excel.name} (${excel.access === "write" ? "read & write" : "read-only"})`,
        `Columns: ${headers.map((h) => (formulaColumns.includes(h) ? `${h} (formula)` : h)).join(", ")}`,
        `Rows (${records.length}${records.length > AI.maxRowsPerExcel ? `, first ${AI.maxRowsPerExcel} shown` : ""}): ${JSON.stringify(
          records
            .slice(0, AI.maxRowsPerExcel)
            .map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !formulaColumns.includes(k)))),
        )}`,
      ].join("\n");
    }),
  );
  return parts.join("\n\n");
}
