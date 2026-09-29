import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SRC_DIR = join(ROOT, "src");
const OUTPUT_DIR = join(ROOT, ".local");
const OUTPUT = join(OUTPUT_DIR, "src.txt");

function walkSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const label = `/${relative(SRC_DIR, path).replaceAll("\\", "/")}`;
    if (label === "/components/ui" || label.startsWith("/components/ui/")) {
      return [];
    }
    if (label === "/routeTree.gen.ts") return [];
    if (statSync(path).isDirectory()) return walkSourceFiles(path);
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

const files = walkSourceFiles(SRC_DIR).sort((left, right) =>
  left.localeCompare(right),
);

if (!files.length) {
  throw new Error(`Aucun fichier .ts / .tsx trouvé dans ${SRC_DIR}`);
}

const dump = files
  .map((path) => {
    const label = `/${relative(SRC_DIR, path).replaceAll("\\", "/")}`;
    const code = readFileSync(path, "utf8").replace(/\s+$/, "");
    return `${label}\n${code}`;
  })
  .join("\n\n");

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT, `${dump}\n`);
console.log(`${files.length} fichiers écrits dans ${relative(ROOT, OUTPUT)}`);
