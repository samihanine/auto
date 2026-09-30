import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { DatabaseIcon, FileBarChartIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { getSavedFolder, pickFolder } from "@/lib/folder";
import { useSettings } from "@/lib/hooks";
import { isTokenExpired, tokenAge, tokenClaims } from "@/lib/pbi-auth";
import { errorMessage } from "@/lib/utils";
import { PageShell, Section } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export const Route = createFileRoute("/settings")({
  ssr: false,
  // `bun run pbi-token` opens /settings?pbiToken=… to hand over a fresh Power BI token.
  validateSearch: (search: Record<string, unknown>): { pbiToken?: string } =>
    typeof search.pbiToken === "string" ? { pbiToken: search.pbiToken } : {},
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const { pbiToken } = Route.useSearch();
  const [settings, updateSettings] = useSettings();
  const [key, setKey] = useState<string>();
  const [folder, setFolder] = useState<string>();

  useEffect(() => {
    void getSavedFolder().then((handle) => setFolder(handle?.name));
  }, []);

  useEffect(() => {
    if (!pbiToken) return;
    void updateSettings({ pbiToken, pbiTokenAt: Date.now() }).then(() => {
      toast.add({ title: "Power BI token saved", type: "success" });
      void navigate({ to: "/settings", search: {}, replace: true });
    });
  }, [pbiToken, updateSettings, navigate]);

  const changeFolder = async () => {
    try {
      await pickFolder();
      await navigate({ to: "/" });
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        toast.add({ title: "Could not open folder", description: errorMessage(error), type: "error" });
    }
  };

  const minutes = Math.round(tokenAge(settings.pbiTokenAt) / 60_000);
  const user = settings.pbiToken ? tokenClaims(settings.pbiToken).upn : undefined;

  return (
    <PageShell title="Settings">
      <Section title="AI key" description="Stored locally in this browser, sent only to the AI provider.">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await updateSettings({ aiKey: (key ?? settings.aiKey).trim() });
            toast.add({ title: "AI key saved", type: "success" });
          }}
        >
          <Input
            type="password"
            autoComplete="off"
            placeholder="sk-…"
            value={key ?? settings.aiKey}
            onChange={(e) => setKey(e.target.value)}
            className="rounded-xl"
          />
          <Button type="submit">Save</Button>
        </form>
      </Section>

      <Section
        title="Power BI"
        description="Sign in once with a device code, then each run refreshes the token and opens this page to save it."
      >
        <div className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
          <span
            className={`size-2 shrink-0 rounded-full ${!settings.pbiToken ? "bg-neutral-300" : isTokenExpired(settings.pbiTokenAt) ? "bg-amber-500" : "bg-green-500"}`}
          />
          <span className="min-w-0 flex-1 truncate">
            {!settings.pbiToken
              ? "Not connected"
              : isTokenExpired(settings.pbiTokenAt)
                ? `Token expired (${minutes} min ago)`
                : `Connected${user ? ` as ${user}` : ""} · ${minutes} min ago`}
          </span>
        </div>
        <code className="rounded-lg bg-muted px-3 py-2 font-mono text-xs">bun run pbi-token</code>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/import-dataset" />}>
            <DatabaseIcon /> Import a dataset
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/import-report" />}>
            <FileBarChartIcon /> Import a report
          </Button>
        </div>
      </Section>

      <Section title="Workspace folder" description="Folder holding one Excel file per table.">
        <div className="flex items-center justify-between rounded-xl border px-4 py-3">
          <span className="text-sm">{folder ?? "No folder selected"}</span>
          <Button variant="outline" size="sm" onClick={changeFolder}>
            Change…
          </Button>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">
            Absolute path of this folder — browsers can’t read it, it’s used to write full image paths in Excel.
          </span>
          <Input
            placeholder="/Users/me/Documents/workspace"
            defaultValue={settings.workspacePath}
            key={settings.workspacePath}
            onBlur={(e) => void updateSettings({ workspacePath: e.target.value.trim() })}
            className="rounded-xl font-mono text-xs"
          />
        </label>
      </Section>
    </PageShell>
  );
}
