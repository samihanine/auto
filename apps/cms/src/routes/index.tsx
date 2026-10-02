import { createFileRoute } from "@tanstack/react-router";
import { DatabaseIcon } from "lucide-react";
import { AuthGate } from "@repo/microsoft-auth/auth-gate";
import { useSettings, useSources } from "@/lib/store";
import { AddSourceForm, SourceBar } from "@/components/source-bar";
import { SourceView } from "@/components/source-view";

export const Route = createFileRoute("/")({
  component: () => (
    <AuthGate resources={["graph"]}>
      <Workspace />
    </AuthGate>
  ),
});

function Workspace() {
  const { sources } = useSources();
  const [settings, updateSettings] = useSettings();
  const source = sources.find((s) => s.id === settings.activeSource) ?? sources[0];

  return (
    <div className="flex h-dvh flex-col">
      <SourceBar source={source} />
      {source ? (
        <SourceView key={source.id} source={source} sources={sources} />
      ) : (
        <div className="grid flex-1 place-items-center p-6">
          <div className="w-full max-w-sm rounded-2xl border p-6 shadow-sm">
            <DatabaseIcon className="mb-3 size-6 text-primary" />
            <AddSourceForm onAdded={(id) => void updateSettings({ activeSource: id })} />
          </div>
        </div>
      )}
    </div>
  );
}
