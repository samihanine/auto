import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { replaceScript } from "vite-plugin-singlefile";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLIENT_DIR = join(ROOT, "dist", "client");
const OUTPUT = join(ROOT, "dist", "atelier.html");

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });
}

function findHtml(): string {
  const preferred = [
    join(CLIENT_DIR, "index.html"),
    join(CLIENT_DIR, "_shell.html"),
    join(CLIENT_DIR, "index", "index.html"),
  ];
  const found = preferred.find((path) => existsSync(path));
  if (found) return found;

  const fallback = walkFiles(CLIENT_DIR).find((path) => path.endsWith(".html"));
  if (fallback) return fallback;

  throw new Error(
    "Aucun HTML client n’a été généré. Vérifiez que le build SPA a réussi.",
  );
}

function stripQuery(url: string) {
  return url.split("#")[0]?.split("?")[0] ?? url;
}

function isExternal(url: string) {
  return (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("//")
  );
}

function resolveAsset(fromDir: string, href: string) {
  const clean = stripQuery(href.trim());
  if (!clean || isExternal(clean)) return null;

  const relative = clean.replace(/^\/_build\//, "/").replace(/^\//, "");
  const candidates = [
    resolve(fromDir, clean),
    join(CLIENT_DIR, relative),
    join(CLIENT_DIR, clean),
    join(ROOT, "public", relative),
  ];

  return candidates.find((path) => existsSync(path)) ?? null;
}

function dataUri(path: string) {
  return `data:image/x-icon;base64,${readFileSync(path).toString("base64")}`;
}

function neutralizeLocalAssets(html: string) {
  return html
    .replace(/src:"(?:\.\/|\/)?(?:assets\/)?[^"]+\.js"/g, 'src:""')
    .replace(/href:"(?:\.\/|\/)?(?:assets\/)?[^"]+\.css"/g, 'href:""')
    .replace(
      /"(?:\.\/|\/)(?:_build\/)?(?:assets\/)?(?:index|styles)-[^"]+\.(?:js|css)"/g,
      '""',
    )
    .replace(
      /`(?:\.\/|\/)?(?:assets\/)?(?:index|styles)-[^`]+\.(?:js|css)`/g,
      '""',
    )
    .replace(/href="\/favicon\.ico"/g, 'href=""');
}

function inlineWithPlugin(html: string, htmlDir: string) {
  let next = html;

  const scripts = [
    ...next.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/gi),
  ];
  for (const match of scripts) {
    const href = match[1];
    if (!href) continue;
    const asset = resolveAsset(htmlDir, href);
    if (!asset) continue;
    next = replaceScript(
      next,
      basename(asset),
      readFileSync(asset, "utf8"),
      true,
    );
  }

  const cssFile =
    walkFiles(CLIENT_DIR).find((path) => path.endsWith(".css")) ?? null;
  if (cssFile) {
    const css = readFileSync(cssFile, "utf8");
    next = next.replace(
      /<link\b[^>]*rel="stylesheet"[^>]*>/gi,
      `<style>${css}</style>`,
    );
    if (!/<style[\s>][\s\S]*?<\/style>/i.test(next)) {
      next = next.replace("</head>", `<style>${css}</style></head>`);
    }
  }

  const favicon = resolveAsset(htmlDir, "/favicon.ico");
  next = next.replace(/<link\b([^>]*?)>/gi, (tag, attrs: string) => {
    const rel =
      /rel\s*=\s*(['"])(.*?)\1/i.exec(attrs)?.[2]?.toLowerCase() ?? "";
    const href = /href\s*=\s*(['"])(.*?)\1/i.exec(attrs)?.[2];
    if (!href) return tag;

    if (rel.includes("icon") && favicon) {
      return tag.replace(href, dataUri(favicon));
    }

    if (
      rel.includes("modulepreload") ||
      rel.includes("preload") ||
      rel.includes("prefetch") ||
      rel.includes("manifest")
    ) {
      return "";
    }

    return tag;
  });

  if (favicon && !/rel="icon"/.test(next)) {
    next = next.replace(
      "</head>",
      `<link rel="icon" href="${dataUri(favicon)}" /></head>`,
    );
  }

  return neutralizeLocalAssets(next.replace(/\n{3,}/g, "\n\n"));
}

function build() {
  execFileSync("bun", ["x", "vite", "build"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, SINGLE_FILE: "1" },
  });

  const htmlPath = findHtml();
  const html = inlineWithPlugin(
    readFileSync(htmlPath, "utf8"),
    dirname(htmlPath),
  );
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, html);
  console.log(`HTML unique écrit : ${OUTPUT}`);
}

build();
