import { ImageIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import type { CellValue, FieldSchema, Row, TableSchema } from "@/lib/schemas";
import { cn, errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { OptionSelect } from "@/components/select-option";
import { RichText } from "@/components/rich-text";

type Values = Record<string, CellValue>;

export function RowForm({
  table,
  row,
  onSave,
  onDelete,
  onCancel,
}: {
  table: TableSchema;
  /** null = new row */
  row: Row | null;
  onSave: (values: Values) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Values | null>(row ? null : {});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const values: Values = { ...row, ...draft };
  const dirty = draft !== null;

  const save = async () => {
    try {
      await onSave(values);
      setDraft(null);
    } catch (error) {
      toast.add({ title: "Could not save", description: errorMessage(error), type: "error" });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && dirty) {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start gap-2 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {table.name} {row && <span className="tabular-nums">· #{row.id}</span>}
          </p>
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {String(values.name || "") || (row ? "Untitled" : "New row")}
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
        {table.columns.map((column) => (
          <div
            key={column.name}
            className={cn("flex min-w-0 flex-col gap-1.5", column.dataType === "text" && "col-span-2")}
          >
            <span className="text-xs font-medium text-muted-foreground capitalize">
              {column.name}
              {column.required && <span className="text-primary"> *</span>}
            </span>
            <FieldInput
              column={column}
              value={values[column.name] ?? null}
              onChange={(value) => setDraft((d) => ({ ...d, [column.name]: value }))}
            />
          </div>
        ))}
      </div>

      {dirty && (
        <footer className="flex items-center justify-end gap-2 border-t bg-background/80 px-5 py-3 backdrop-blur animate-in fade-in slide-in-from-bottom-1">
          <span className="mr-auto text-xs text-muted-foreground">⌘S to save</span>
          <Button variant="ghost" size="sm" onClick={() => (row ? setDraft(null) : onCancel())}>
            {row ? "Discard" : "Cancel"}
          </Button>
          <Button size="sm" onClick={() => void save()}>
            {row ? "Save" : "Create"}
          </Button>
        </footer>
      )}
    </div>
  );
}

function FieldInput({
  column,
  value,
  onChange,
}: {
  column: FieldSchema;
  value: CellValue;
  onChange: (value: CellValue) => void;
}) {
  const text = Array.isArray(value) ? value.join("; ") : value === null ? "" : String(value);
  const input = (props: React.ComponentProps<"input">) => (
    <Input
      value={text}
      onChange={(e) => onChange(column.multiple ? e.target.value.split(/\s*;\s*/) : e.target.value)}
      className="rounded-xl"
      {...props}
    />
  );

  switch (column.dataType) {
    case "option":
      return <OptionSelect column={column} value={value} onChange={onChange} />;
    case "text":
      return <RichText value={text} onChange={onChange} />;
    case "boolean":
      return <Switch checked={value === true} onCheckedChange={onChange} />;
    case "number":
      return input({
        type: "number",
        onChange: (e) => onChange(e.target.value === "" ? null : Number(e.target.value)),
      });
    case "date":
      return input({ type: "date" });
    case "json":
      return (
        <Textarea value={text} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      );
    case "image":
      return (
        <div className="flex flex-col gap-2">
          {input({ type: "url", placeholder: "Paste an image URL" })}
          <div className="grid aspect-video place-items-center overflow-hidden rounded-xl bg-muted ring-1 ring-border/60">
            {text ? (
              <img src={text} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="size-5 text-muted-foreground/60" />
            )}
          </div>
        </div>
      );
    default:
      return input({ type: column.dataType === "url" ? "url" : "text" });
  }
}
