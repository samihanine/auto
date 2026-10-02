/**
 * bun run export-src <app> → exports/<app>-src.zip: the app as a standalone project.
 * Workspace packages are copied into src/packages/<name> (imports keep their @repo/* alias,
 * mapped in tsconfig), the shared Vite config and the auth proxy are copied at the root.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { strToU8, zipSync } from "fflate";
import { EXPORTS, ROOT, appArgument } from "./shared";

const app = appArgument("export-src");
const appDir = join(ROOT, "apps", app);
const PACKAGES = ["ui", "microsoft-auth", "storage", "tables", "config"];
const SKIP = new Set(["node_modules", "dist", ".turbo", ".DS_Store"]);
const files: Record<string, Uint8Array> = {};
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const put = (path: string, content: string | Uint8Array) =>
  (files[`${app}/${path}`] = typeof content === "string" ? strToU8(content) : content);

function copyDir(from: string, to: string) {
  for (const name of readdirSync(from)) {
    if (SKIP.has(name)) continue;
    const path = join(from, name);
    if (statSync(path).isDirectory()) copyDir(path, join(to, name));
    else put(join(to, name), readFileSync(path));
  }
}

// App files, minus the monorepo-specific config rewritten below.
copyDir(appDir, ".");
for (const pkg of PACKAGES) copyDir(join(ROOT, "packages", pkg, "src"), `src/packages/${pkg}`);
put("vite.shared.ts", readFileSync(join(ROOT, "vite.shared.ts")));
put("vite.config.ts", readFileSync(join(appDir, "vite.config.ts"), "utf8").replace("../../vite.shared", "./vite.shared"));
put(
  "auth-proxy.ts",
  readFileSync(join(ROOT, "packages/microsoft-auth/proxy.ts"), "utf8").replace(/"\.\/src\/config"/g, '"./src/packages/microsoft-auth/config"'),
);

// tsconfig: base options + aliases pointing to the copied packages.
const base = json(join(ROOT, "tsconfig.base.json"));
put(
  "tsconfig.json",
  JSON.stringify(
    {
      compilerOptions: {
        ...base.compilerOptions,
        types: ["vite/client", "bun"],
        paths: {
          "@/*": ["./src/*"],
          "@repo/ui/*": ["./src/packages/ui/*"],
          "@repo/microsoft-auth/*": ["./src/packages/microsoft-auth/*"],
          "@repo/storage": ["./src/packages/storage/index.ts"],
          "@repo/storage/*": ["./src/packages/storage/*"],
          "@repo/config": ["./src/packages/config/constants.ts"],
          "@repo/tables": ["./src/packages/tables/index.ts"],
          "@repo/tables/*": ["./src/packages/tables/*"],
        },
      },
      include: ["src", "vite.config.ts", "vite.shared.ts", "auth-proxy.ts"],
    },
    null,
    2,
  ),
);

// package.json: app + packages dependencies (without workspace links) + build tooling.
const appPkg = json(join(appDir, "package.json"));
const root = json(join(ROOT, "package.json"));
const dependencies = Object.fromEntries(
  Object.entries({
    ...appPkg.dependencies,
    ...Object.assign({}, ...PACKAGES.map((pkg) => json(join(ROOT, "packages", pkg, "package.json")).dependencies)),
  })
    .filter(([name]) => !name.startsWith("@repo/"))
    .sort(([a], [b]) => a.localeCompare(b)),
);
const tooling = ["@tailwindcss/vite", "@types/bun", "@tanstack/router-plugin", "@types/node", "@types/react", "@types/react-dom", "@vitejs/plugin-react", "tailwindcss", "typescript", "vite", "vite-plugin-singlefile"];
put(
  "package.json",
  JSON.stringify(
    {
      name: app,
      private: true,
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        "build:html": "SINGLE_FILE=1 vite build",
        preview: "vite preview",
        typecheck: "tsc --noEmit",
        "auth-proxy": "bun auth-proxy.ts",
      },
      dependencies,
      devDependencies: Object.fromEntries(tooling.map((name) => [name, root.devDependencies[name]])),
    },
    null,
    2,
  ),
);
put(".gitignore", "node_modules\ndist\n.local\n");
put(
  "README.md",
  `# ${app}\n\nExported from the monorepo.\n\n\`\`\`bash\nbun install\nbun run auth-proxy   # Microsoft sign-in (keep it running)\nbun run dev\n\`\`\`\n`,
);

mkdirSync(EXPORTS, { recursive: true });
const output = join(EXPORTS, `${app}-src.zip`);
writeFileSync(output, zipSync(files));
console.log(`${relative(ROOT, output)} — ${Object.keys(files).length} files`);
