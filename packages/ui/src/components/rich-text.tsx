import { BoldIcon } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { boldRuns } from "../lib/utils";

/** Minimal editor: line breaks and bold only, stored as "text with **bold**". */
export function RichText({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!ref.current || value === last.current) return;
    ref.current.innerHTML = toHtml(value);
    last.current = value;
  }, [value]);

  const emit = () => {
    last.current = fromHtml(ref.current!);
    onChange(last.current);
  };
  const run = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    emit();
  };

  return (
    <div className="rounded-xl border border-input bg-input/30 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      {!readOnly && (
      <div className="flex border-b border-input/70 px-1.5 py-1">
        <button
          type="button"
          aria-label="Bold"
          onMouseDown={(e) => {
            e.preventDefault();
            run("bold");
          }}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <BoldIcon className="size-3.5" />
        </button>
      </div>
      )}
      <div
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={emit}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          run("insertLineBreak");
        }}
        onPaste={(e) => {
          e.preventDefault();
          run("insertText", e.clipboardData.getData("text/plain"));
        }}
        className="max-h-80 min-h-24 overflow-y-auto px-3 py-2.5 text-sm leading-relaxed outline-none"
      />
    </div>
  );
}

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const toHtml = (value: string) =>
  boldRuns(value)
    .map(({ text, bold }) => {
      const html = escape(text).replace(/\n/g, "<br>");
      return bold ? `<b>${html}</b>` : html;
    })
    .join("");

function fromHtml(root: HTMLElement) {
  const walk = (node: Node, bold: boolean): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      return bold && text.trim() ? `**${text}**` : text;
    }
    if (!(node instanceof HTMLElement)) return "";
    if (node.tagName === "BR") return "\n";
    const weight = node.style.fontWeight;
    const isBold =
      bold || ["B", "STRONG"].includes(node.tagName) || weight === "bold" || Number(weight) >= 600;
    const inner = [...node.childNodes].map((child) => walk(child, isBold)).join("");
    if (node !== root && ["DIV", "P"].includes(node.tagName))
      return "\n" + (node.childNodes.length === 1 && node.firstChild?.nodeName === "BR" ? "" : inner);
    return inner;
  };
  return walk(root, false).replace(/\*\*\*\*/g, "").replace(/\n+$/, "");
}

/** Read-only rendering of a "text with **bold**" value. */
export function RichTextView({ value, className }: { value: string; className?: string }) {
  return (
    <p className={className} style={{ whiteSpace: "pre-line" }}>
      {boldRuns(value).map((run, i) => (run.bold ? <b key={i}>{run.text}</b> : <span key={i}>{run.text}</span>))}
    </p>
  );
}
