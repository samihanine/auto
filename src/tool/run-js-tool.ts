import type { ToolSchema } from "@/lib/schemas";

const WORKER = `
self.fetch = undefined; self.XMLHttpRequest = undefined; self.WebSocket = undefined; self.importScripts = undefined;
self.onmessage = async ({ data }) => {
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const result = await new AsyncFunction("data", '"use strict";' + data.code)(data.input);
    self.postMessage({ result: JSON.parse(JSON.stringify(result ?? null)) });
  } catch (error) {
    self.postMessage({ error: String(error && error.message || error) });
  }
};`;

function runJavaScript(code: string) {
  const timeoutMs = 5000;
  const url = URL.createObjectURL(
    new Blob([WORKER], { type: "text/javascript" }),
  );
  const worker = new Worker(url);
  return new Promise<unknown>((resolve) => {
    const done = (value: unknown) => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(
      () => done({ error: `Timed out after ${timeoutMs} ms` }),
      timeoutMs,
    );
    worker.onmessage = ({ data }) => {
      clearTimeout(timer);
      done(data);
    };
    worker.postMessage({ code });
  });
}

export const runJavaScriptTool: ToolSchema = {
  name: "runJavaScript",
  description: "Run JavaScript in a sandboxed worker and return the result",
  parameters: {
    code: "string — async function body; `return` the result",
  },
  execute: (args: { code: string }) => runJavaScript(args.code),
};
