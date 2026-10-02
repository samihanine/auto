import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dir, "..");
export const APPS = readdirSync(join(ROOT, "apps"));
export const EXPORTS = join(ROOT, "exports");

/** App name from `bun run <script> <app>`, or exits with the list of apps. */
export function appArgument(script: string) {
  const app = process.argv[2];
  if (!app || !APPS.includes(app) || !existsSync(join(ROOT, "apps", app, "package.json"))) {
    console.error(`Usage: bun run ${script} <${APPS.join(" | ")}>`);
    process.exit(1);
  }
  return app;
}
