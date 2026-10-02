import { existsSync, readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Vite config shared by the apps.
 * SINGLE_FILE=1 builds one self-contained HTML; CHAT_HTML_FILE inlines the chat app into it.
 */
export function appConfig({ port }: { port: number }) {
  const singleFile = process.env.SINGLE_FILE === "1";
  const chatFile = process.env.CHAT_HTML_FILE;
  const chatHtml = chatFile && existsSync(chatFile) ? readFileSync(chatFile, "utf8") : "";

  return defineConfig({
    base: "./",
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: !singleFile }),
      react(),
      tailwindcss(),
      ...(singleFile ? [viteSingleFile({ removeViteModuleLoader: true })] : []),
    ],
    // Packages are consumed as source: keep a single React instance.
    resolve: { tsconfigPaths: true, dedupe: ["react", "react-dom"] },
    define: { __CHAT_HTML__: JSON.stringify(chatHtml) },
    server: { port, strictPort: true },
    build: singleFile
      ? { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 100_000_000, cssCodeSplit: false }
      : {},
  });
}
