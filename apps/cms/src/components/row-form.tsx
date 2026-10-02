import { CheckIcon, Trash2Icon } from "lucide-react";
import { TIMING } from "@repo/config";
import { useEffect, useRef, useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { RichText } from "@repo/ui/components/rich-text";
import { SearchSelect } from "@repo/ui/components/search-select";
import { Spinner } from "@repo/ui/components/spinner";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { cn, errorMessage } from "@repo/ui/lib/utils";
import type { FieldSchema, Row, TableSchema, Value } from "@repo/tables/schema";
import { fieldLabel, validate } from "@repo/tables/schema";
import { ImageInput } from "@/components/image-input";

const AUTOSAVE_DELAY = TIMING.autosaveDelay;
type Status = { kind: "idle" | "saving" | "saved" } | { kind: "invalid" | "error"; message: string };

/**
 * Edits a row and saves automatically once the user pauses typing (no save button).
 * `row = null` creates a new row on the first valid save.
 */
export function RowForm({
  table,
  row,
  rows,
  onCreate,
  onUpdate,
  onDelete,
}: {
  table: TableSchema;
  row: Row | null;
  rows: Row[];
  onCreate: (values: Partial<Row>) => Promise<number>;
  onUpdate: (values: Partial<Row>) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [values, setValues] = useState<Partial<Row>>(row ?? {});
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useRef<() => Promise<void>>(async () => {});

  // Follow changes made elsewhere (assistant, other apps) while the user isn't editing.
  useEffect(() => {
    if (row && !dirty) setValues(row);
  }, [row, dirty]);

  save.current = async () => {
    const problem = validate(table, { ...values, id: row?.id }, rows);
    if (problem) return setStatus({ kind: "invalid", message: problem });
    setStatus({ kind: "saving" });
    try {
      if (row) await onUpdate({ ...values, id: row.id });
      else await onCreate(values);
      setDirty(false);
      setStatus({ kind: "saved" });
    } catch (e) {
      setStatus({ kind: "error", message: errorMessage(e) });
    }
  };

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => void save.current(), AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [values, dirty]);

  const change = (name: string, value: Value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setDirty(true);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start gap-2 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {table.label} {row && <span className="tabular-nums">· #{row.id}</span>}
            <SaveStatus status={status} dirty={dirty} />
          </p>
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {String(values.name ?? "") || (row ? "Untitled" : "New row")}
          </h2>
        </div>
        {row && (
          <Button
            variant={confirmDelete ? "destructive" : "ghost"}
            size={confirmDelete ? "sm" : "icon-sm"}
            onClick={() => (confirmDelete ? void onDelete() : setConfirmDelete(true))}
            onBlur={() => setConfirmDelete(false)}
            aria-label="Delete row"
          >
            <Trash2Icon />
            {confirmDelete && "Delete"}
          </Button>
        )}
      </header>

      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-x-3 gap-y-4 overflow-y-auto px-5 py-5">
        {table.columns.map((field) => (
          <div
            key={field.name}
            className={cn("flex min-w-0 flex-col gap-1.5", (field.dataType === "text" || field.dataType === "image" || field.multiple) && "col-span-2")}
          >
            <span className="text-xs font-medium text-muted-foreground capitalize" title={field.description}>
              {fieldLabel(field)}
              {field.required && <span className="text-primary"> *</span>}
            </span>
            <FieldInput field={field} value={values[field.name] ?? null} onChange={(value) => change(field.name, value)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveStatus({ status, dirty }: { status: Status; dirty: boolean }) {
  if (status.kind === "saving") return <Spinner className="size-3" />;
  if (status.kind === "invalid" || status.kind === "error")
    return <span className="truncate normal-case text-destructive">· {status.message}</span>;
  if (status.kind === "saved" && !dirty)
    return (
      <span className="inline-flex items-center gap-0.5 normal-case text-green-600">
        <CheckIcon className="size-3" /> Saved
      </span>
    );
  return null;
}

function FieldInput({ field, value, onChange }: { field: FieldSchema; value: Value; onChange: (value: Value) => void }) {
  const text = Array.isArray(value) ? value.join("\n") : value === null ? "" : String(value);
  const input = (props: React.ComponentProps<"input">) => (
    <Input value={text} onChange={(e) => onChange(e.target.value || null)} className="rounded-xl" {...props} />
  );

  if (field.dataType === "option")
    return (
      <SearchSelect
        items={field.options.map((o) => ({ value: o.value, label: o.label ?? o.value, color: o.color }))}
        value={Array.isArray(value) ? value : value ? String(value) : null}
        onChange={onChange}
        multiple={field.multiple}
      />
    );
  if (field.multiple)
    return (
      <Textarea
        value={text}
        placeholder="One per line"
        onChange={(e) => onChange(e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))}
        className="min-h-16 font-mono text-xs"
      />
    );
  switch (field.dataType) {
    case "text":
      return <RichText value={text} onChange={onChange} />;
    case "boolean":
      return <Switch checked={value === true} onCheckedChange={onChange} />;
    case "number":
      return input({ type: "number", onChange: (e) => onChange(e.target.value === "" ? null : Number(e.target.value)) });
    case "date":
      return input({ type: "date" });
    case "image":
      return <ImageInput value={value ? String(value) : null} onChange={onChange} />;
    default:
      return input({ type: field.dataType === "url" ? "url" : "text" });
  }
}
