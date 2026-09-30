import { useState } from "react";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export type ImportField = { name: string; label: string; placeholder: string; required?: boolean };

/** Form with a few link/name fields that runs an import and shows its progress log. */
export function ImportForm({
  fields,
  action,
  run,
}: {
  fields: ImportField[];
  action: string;
  run: (values: Record<string, string>, log: (message: string) => void) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<{ text: string; error?: boolean }[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLogs([]);
    const log = (text: string) => setLogs((current) => [...current, { text }]);
    try {
      await run(values, log);
    } catch (error) {
      setLogs((current) => [...current, { text: errorMessage(error), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {fields.map((field) => (
        <label key={field.name} className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
          <Input
            required={field.required}
            placeholder={field.placeholder}
            value={values[field.name] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            className="rounded-xl"
          />
        </label>
      ))}
      <Button type="submit" disabled={busy} className="self-start">
        {busy && <Spinner />} {action}
      </Button>
      {logs.length > 0 && (
        <ol className="flex flex-col gap-1 rounded-xl bg-muted/60 px-4 py-3 font-mono text-xs">
          {logs.map((line, i) => (
            <li key={i} className={line.error ? "text-destructive" : "text-muted-foreground"}>
              {line.text}
            </li>
          ))}
        </ol>
      )}
    </form>
  );
}
