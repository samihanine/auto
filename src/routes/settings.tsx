import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { getSavedFolder, pickFolder } from "@/lib/folder";
import { useSettings } from "@/lib/hooks";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export const Route = createFileRoute("/settings")({
  ssr: false,
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const [settings, updateSettings] = useSettings();
  const [key, setKey] = useState<string>();
  const [folder, setFolder] = useState<string>();

  useEffect(() => {
    void getSavedFolder().then((handle) => setFolder(handle?.name));
  }, []);

  const changeFolder = async () => {
    try {
      await pickFolder();
      await navigate({ to: "/" });
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        toast.add({ title: "Could not open folder", description: errorMessage(error), type: "error" });
    }
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2" nativeButton={false} render={<Link to="/" />}>
          <ChevronLeftIcon /> Back
        </Button>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <Section title="OpenAI API key" description="Stored locally in this browser, used only to call the OpenAI API.">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await updateSettings({ openaiKey: (key ?? settings.openaiKey).trim() });
            toast.add({ title: "API key saved", type: "success" });
          }}
        >
          <Input
            type="password"
            autoComplete="off"
            placeholder="sk-…"
            value={key ?? settings.openaiKey}
            onChange={(e) => setKey(e.target.value)}
            className="rounded-xl"
          />
          <Button type="submit">Save</Button>
        </form>
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
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
