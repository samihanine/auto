/**
 * bun run export-html <app> → exports/<app>.html: the whole app in one HTML file.
 * The cms and powerbi-viewer apps embed the chat: it is built first and inlined.
 * (Microsoft sign-in still needs the local auth proxy: bun run auth-proxy.)
 */
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { EXPORTS, ROOT, appArgument } from "./shared";

const app = appArgument("export-html");

function build(name: string, env: Record<string, string> = {}) {
  const outDir = join(EXPORTS, ".build", name);
  rmSync(outDir, { recursive: true, force: true });
  const result = Bun.spawnSync(["bunx", "vite", "build", "--outDir", outDir, "--emptyOutDir"], {
    cwd: join(ROOT, "apps", name),
    env: { ...process.env, SINGLE_FILE: "1", ...env },
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode ?? 1);
  return join(outDir, "index.html");
}

mkdirSync(EXPORTS, { recursive: true });
const chat = app === "chat" ? undefined : build("chat");
const html = build(app, chat ? { CHAT_HTML_FILE: chat } : {});
const output = join(EXPORTS, `${app}.html`);
copyFileSync(html, output);
rmSync(join(EXPORTS, ".build"), { recursive: true, force: true });
console.log(`${relative(ROOT, output)} ready`);
