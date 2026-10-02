# auto

Turborepo + Bun workspaces — three TanStack Router / React / Tailwind apps sharing three packages.

| App | Port | |
| --- | --- | --- |
| `apps/cms` | 3001 | Excel sources (OneDrive / SharePoint) edited through table structures, with the assistant |
| `apps/powerbi-viewer` | 3002 | Embedded Power BI report driven by the assistant, guides, data definitions, DAX |
| `apps/chat` | 3003 | Embeddable assistant (iframe), params in the URL hash |

Packages: `@repo/ui` (shadcn components + styles), `@repo/microsoft-auth` (device-code auth proxy, Graph Excel / SharePoint, Power BI), `@repo/storage` (typed localStorage).

```bash
bun install
bun run auth-proxy               # Microsoft sign-in proxy (keep it running)
bun run dev                      # all apps
bun run export-src <app>         # exports/<app>-src.zip, standalone project
bun run export-html <app>        # exports/<app>.html, single file (still needs the auth proxy)
bun run typecheck
```
