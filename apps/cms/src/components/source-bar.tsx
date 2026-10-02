import { PlusIcon, SettingsIcon } from "lucide-react";
import { FEATURES } from "@repo/config";
import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import { SearchSelect } from "@repo/ui/components/search-select";
import { Spinner } from "@repo/ui/components/spinner";
import { errorMessage } from "@repo/ui/lib/utils";
import type { Source } from "@/lib/store";
import { useSettings, useSources } from "@/lib/store";
import { openSource } from "@/lib/use-rows";
import { findStructure, structures } from "@repo/tables";

/** Top bar: active source, add a source, images folder setting. */
export function SourceBar({ source }: { source?: Source }) {
  const { sources } = useSources();
  const [settings, updateSettings] = useSettings();
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
      <span className="text-sm font-semibold tracking-tight">CMS</span>
      {sources.length > 0 && (
        <SearchSelect
          className="w-64"
          placeholder="Select a source…"
          items={sources.map((s) => ({
            value: s.id,
            label: s.name,
            hint: findStructure(s.structure)?.label,
          }))}
          value={source?.id ?? null}
          onChange={(id) =>
            id && void updateSettings({ activeSource: String(id) })
          }
        />
      )}
      <Popover>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          <PlusIcon /> Add source
        </PopoverTrigger>
        <PopoverContent align="start" className="w-96">
          <AddSourceForm
            onAdded={(id) => void updateSettings({ activeSource: id })}
          />
        </PopoverContent>
      </Popover>
      {FEATURES.imageUpload && (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label="Settings"
              />
            }
          >
            <SettingsIcon />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 gap-2">
            <p className="text-sm font-medium">Images folder</p>
            <p className="text-xs text-muted-foreground">
              OneDrive / SharePoint folder link where uploaded images are
              stored. Without it, image fields only take links.
            </p>
            <Input
              placeholder="https://…sharepoint.com/:f:/…"
              defaultValue={settings.imagesFolder}
              onBlur={(e) =>
                void updateSettings({ imagesFolder: e.target.value.trim() })
              }
              className="rounded-xl font-mono text-xs"
            />
          </PopoverContent>
        </Popover>
      )}
    </header>
  );
}

/** Excel link + structure; creates the table / missing columns in the workbook. */
export function AddSourceForm({ onAdded }: { onAdded: (id: string) => void }) {
  const { add } = useSources();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [structure, setStructure] = useState<string | null>(structures[0].name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const table = findStructure(structure ?? "");
    if (!table) return;
    setBusy(true);
    setError(null);
    try {
      const excel = await openSource(
        { id: "", name, url: url.trim(), structure: table.name },
        table,
      );
      const created = await add({
        url: url.trim(),
        structure: table.name,
        name: name.trim() || excel.item.name.replace(/\.xlsx?$/i, ""),
      });
      onAdded(created.id);
      setUrl("");
      setName("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm font-medium">Add an Excel source</p>
      <Input
        required
        placeholder="Excel link (OneDrive / SharePoint)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="rounded-xl"
      />
      <Input
        placeholder="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-xl"
      />
      <SearchSelect
        placeholder="Structure…"
        items={structures.map((s) => ({
          value: s.name,
          label: s.label,
          hint: `${s.columns.length} fields`,
        }))}
        value={structure}
        onChange={(value) => setStructure(value ? String(value) : null)}
      />
      <p className="text-xs text-muted-foreground">
        Missing table or columns are created in the workbook.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="submit"
        disabled={busy || !structure}
        className="self-start"
      >
        {busy && <Spinner />} Add source
      </Button>
    </form>
  );
}
