import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, ExternalLinkIcon, LinkIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExcelRecord } from "@repo/microsoft-auth/excel";
import { ImageView } from "@repo/microsoft-auth/image-view";
import { columnFormulas } from "@repo/tables/schema";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { SearchSelect } from "@repo/ui/components/search-select";
import { Spinner } from "@repo/ui/components/spinner";
import { Textarea } from "@repo/ui/components/textarea";
import { cn, errorMessage } from "@repo/ui/lib/utils";
import type { LinkedKind } from "@/lib/linked";
import { KINDS, linkedKey, openLinkedExcel, pagesOfRow, parsed, rowsOfReport, splitUrls, useLinkedRows, visualIdsOfRow } from "@/lib/linked";

export type ClickedVisual = { id: string; title?: string; pageName?: string };
/** A visual of the report, to (re)link entries. */
export type ReportVisual = { id: string; title: string; pageName: string; pageTitle: string };
export type ReportPage = { name: string; displayName: string };

/** Where the panel is: the report (its pages), a page (its entries), an entry, or the clicked visual. */
type Nav = { level: "visual" } | { level: "report" } | { level: "page"; page: string } | { level: "entry"; id: string };

/**
 * Guide / Data tab: entries of an Excel (CMS "guide" / "data" structure) linked to the report.
 * Breadcrumb "report › page › entry"; a clicked visual opens its entries, or offers to attach /
 * create one. Entries are Markdown, editable, re-linkable and deletable.
 */
export function LinkedPanel({
  kind,
  excelUrl,
  onExcelUrl,
  reportUrl,
  reportName,
  pages,
  pageName,
  visual,
  visuals,
}: {
  kind: LinkedKind;
  excelUrl: string;
  onExcelUrl: (url: string) => void;
  reportUrl: string;
  reportName: string;
  /** Pages of the report (from its extracted structure). */
  pages: ReportPage[];
  /** Page shown in the report. */
  pageName?: string;
  visual?: ClickedVisual;
  /** All visuals of the report. */
  visuals: ReportVisual[];
}) {
  const { table, text, label } = KINDS[kind];
  const client = useQueryClient();
  const rows = useLinkedRows(kind, excelUrl);
  const [nav, setNav] = useState<Nav>(visual ? { level: "visual" } : pageName ? { level: "page", page: pageName } : { level: "report" });

  // A new click on a visual (or a page change) brings the panel back to it.
  useEffect(() => {
    setNav(visual ? { level: "visual" } : pageName ? { level: "page", page: pageName } : { level: "report" });
  }, [visual?.id, pageName]);

  const save = useMutation({
    mutationFn: async (action: { insert?: ExcelRecord; update?: ExcelRecord; delete?: string }) => {
      const excel = await openLinkedExcel(excelUrl, kind);
      if (action.insert) await excel.insertRecords([action.insert], columnFormulas(table));
      if (action.update) await excel.updateRecords([action.update]);
      if (action.delete !== undefined) await excel.deleteRecords([action.delete]);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: linkedKey(excelUrl) }),
  });

  if (!excelUrl) return <ExcelLinkForm label={label} onSubmit={onExcelUrl} />;
  if (rows.isLoading)
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Spinner /> Opening the {label.toLowerCase()} Excel…
      </p>
    );
  if (rows.error)
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-destructive">{errorMessage(rows.error)}</p>
        <Button variant="outline" size="sm" className="self-start" onClick={() => onExcelUrl("")}>
          Change the Excel link
        </Button>
      </div>
    );

  const ref = parsed(reportUrl);
  const entries = rowsOfReport(rows.data ?? [], ref?.reportId);
  const urlOf = (page: string, visualId?: string) =>
    ref && `https://app.powerbi.com/groups/${ref.groupId ?? "me"}/reports/${ref.reportId}/${page}${visualId ? `?visual=${visualId}` : ""}`;
  const update = (row: ExcelRecord, patch: ExcelRecord) => save.mutateAsync({ update: { id: row.id, ...patch } });
  const pageTitle = (name?: string) => pages.find((p) => p.name === name)?.displayName ?? name ?? "Page";
  const ofPage = (page: string) => entries.filter((row) => pagesOfRow(row).includes(page));

  const visualPage = visual?.pageName ?? pageName;
  const forVisual = visual ? entries.filter((row) => visualIdsOfRow(row).includes(visual.id)) : [];
  const shownEntry = nav.level === "entry" ? entries.find((row) => String(row.id) === nav.id) : undefined;
  const crumbPage = nav.level === "page" ? nav.page : nav.level === "visual" ? visualPage : shownEntry ? pagesOfRow(shownEntry)[0] : undefined;
  const crumbTitle =
    nav.level === "entry" ? String(shownEntry?.name ?? "") : nav.level === "visual" ? (forVisual.length === 1 ? String(forVisual[0].name) : (visual?.title ?? "Visual")) : undefined;

  const entry = (row: ExcelRecord) => (
    <Entry
      key={String(row.id)}
      row={row}
      text={text}
      visuals={visuals}
      onSave={(value) => update(row, { [text]: value })}
      onLinks={(urls) => update(row, { visual_urls: urls.join("; ") })}
      linkUrl={(v) => urlOf(v.pageName, v.id) ?? ""}
      onDelete={() => save.mutateAsync({ delete: String(row.id) }).then(() => setNav({ level: "report" }))}
    />
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <nav className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Crumb onClick={() => setNav({ level: "report" })} active={nav.level === "report"}>{reportName}</Crumb>
        {crumbPage && (
          <>
            <ChevronRightIcon className="size-3 shrink-0" />
            <Crumb onClick={() => setNav({ level: "page", page: crumbPage })} active={nav.level === "page"}>{pageTitle(crumbPage)}</Crumb>
          </>
        )}
        {crumbTitle && (
          <>
            <ChevronRightIcon className="size-3 shrink-0" />
            <Crumb active>{crumbTitle}</Crumb>
          </>
        )}
      </nav>

      {nav.level === "report" && (
        <List
          empty="The report has no pages yet."
          items={pages.map((page) => ({ key: page.name, label: page.displayName, count: ofPage(page.name).length }))}
          onOpen={(page) => setNav({ level: "page", page })}
        />
      )}

      {nav.level === "page" && (
        <List
          empty={`No ${label.toLowerCase()} on this page — click a visual to add one.`}
          items={ofPage(nav.page).map((row) => ({ key: String(row.id), label: String(row.name ?? `#${String(row.id)}`) }))}
          onOpen={(id) => setNav({ level: "entry", id })}
        />
      )}

      {nav.level === "entry" && (shownEntry ? entry(shownEntry) : <p className="text-sm text-muted-foreground">This entry no longer exists.</p>)}

      {nav.level === "visual" && visual && (
        forVisual.length ? (
          forVisual.map(entry)
        ) : (
          visualPage && (
            <AttachVisual
              label={label}
              visual={visual}
              rows={entries.length ? entries : (rows.data ?? [])}
              busy={save.isPending}
              onAttach={(row) => update(row, { visual_urls: [...splitUrls(row.visual_urls), urlOf(visualPage, visual.id)].join("; ") })}
              onCreate={(name) =>
                save.mutateAsync({
                  insert: { name, report_url: reportUrl, page_url: urlOf(visualPage) ?? null, visual_urls: urlOf(visualPage, visual.id) ?? null, [text]: "" },
                })
              }
            />
          )
        )
      )}
      {save.error && <p className="text-xs text-destructive">{errorMessage(save.error)}</p>}
    </div>
  );
}

function Crumb({ children, onClick, active }: { children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn("max-w-48 truncate rounded px-1 py-0.5", active ? "font-medium text-foreground" : "hover:bg-muted hover:text-foreground")}
    >
      {children}
    </button>
  );
}

/** Clickable list of pages (with entry counts) or entry titles. */
function List({ items, onOpen, empty }: { items: { key: string; label: string; count?: number }[]; onOpen: (key: string) => void; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col overflow-hidden rounded-xl border bg-background">
      {items.map((item) => (
        <li key={item.key} className="border-b last:border-b-0">
          <button onClick={() => onOpen(item.key)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-muted/60">
            <span className="flex-1 truncate">{item.label}</span>
            {item.count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{item.count}</span>}
            <ChevronRightIcon className="size-3.5 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ExcelLinkForm({ label, onSubmit }: { label: string; onSubmit: (url: string) => void }) {
  const [input, setInput] = useState("");
  return (
    <form
      className="flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(input.trim());
      }}
    >
      <p className="text-sm font-medium">{label} Excel</p>
      <p className="text-xs text-muted-foreground">
        Link of the {label.toLowerCase()} Excel (the same as in the CMS). Its table is created if needed.
      </p>
      <Input required placeholder="Excel link" value={input} onChange={(e) => setInput(e.target.value)} className="rounded-xl" />
      <Button type="submit" size="sm" className="self-start">Save</Button>
    </form>
  );
}

/** Clicked visual without entry: attach it to an existing entry, or create one for it. */
function AttachVisual({
  label,
  visual,
  rows,
  busy,
  onAttach,
  onCreate,
}: {
  label: string;
  visual: ClickedVisual;
  rows: ExcelRecord[];
  busy: boolean;
  onAttach: (row: ExcelRecord) => Promise<unknown>;
  onCreate: (name: string) => Promise<unknown>;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [name, setName] = useState(visual.title ?? "");
  const lower = label.toLowerCase();
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed p-4">
      <p className="text-sm">
        No {lower} for <span className="font-medium">“{visual.title ?? visual.id}”</span> yet.
      </p>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Attach to an existing {lower}</span>
        <div className="flex gap-2">
          <SearchSelect
            className="min-w-0 flex-1"
            placeholder={`Choose a ${lower}…`}
            items={rows.map((row) => ({ value: String(row.id), label: String(row.name ?? `#${String(row.id)}`) }))}
            value={target}
            onChange={(value) => setTarget(value ? String(value) : null)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!target || busy}
            onClick={() => void onAttach(rows.find((row) => String(row.id) === target)!)}
          >
            <LinkIcon /> Attach
          </Button>
        </div>
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void onCreate(name.trim());
        }}
      >
        <span className="text-xs font-medium text-muted-foreground">Or create a new {lower}</span>
        <div className="flex gap-2">
          <Input placeholder="Title" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
          <Button size="sm" type="submit" disabled={!name.trim() || busy}>
            {busy ? <Spinner /> : <PlusIcon />} Create
          </Button>
        </div>
      </form>
    </div>
  );
}

/** One entry: Markdown text, image, DataGalaxy link. Edit mode: text, linked visuals, deletion. */
function Entry({
  row,
  text,
  visuals,
  onSave,
  onLinks,
  linkUrl,
  onDelete,
}: {
  row: ExcelRecord;
  text: string;
  visuals: ReportVisual[];
  onSave: (value: string) => Promise<unknown>;
  onLinks: (urls: string[]) => Promise<unknown>;
  linkUrl: (visual: ReportVisual) => string;
  onDelete: () => Promise<unknown>;
}) {
  const content = String(row[text] ?? "");
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const links = splitUrls(row.visual_urls);
  const linkedIds = visualIdsOfRow(row);

  return (
    <article className="flex flex-col gap-2 rounded-xl border bg-background p-4">
      <div className="flex items-start gap-2">
        <h3 className="flex-1 text-sm font-semibold tracking-tight">{String(row.name ?? "")}</h3>
        {draft === null && (
          <Button variant="ghost" size="icon-xs" onClick={() => setDraft(content)} aria-label="Edit">
            <PencilIcon />
          </Button>
        )}
      </div>
      {row.image_url && <ImageView url={String(row.image_url)} className="aspect-video w-full rounded-lg" />}
      {draft === null ? (
        content ? (
          <div className="markdown text-sm text-foreground/90">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <button onClick={() => setDraft("")} className="text-left text-sm text-muted-foreground hover:text-foreground">
            Add a text…
          </button>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Markdown: **bold**, *italic*, - lists, [links](https://…)"
            className="min-h-40 font-mono text-xs"
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Linked visuals</span>
            <div className="flex flex-wrap gap-1">
              {links.map((url) => {
                const id = parsed(url)?.visualId;
                const linked = visuals.find((v) => v.id === id);
                return (
                  <span key={url} className="inline-flex h-6 items-center gap-1 rounded-md bg-muted pr-1 pl-2 text-xs">
                    {linked ? `${linked.title} · ${linked.pageTitle}` : (id ?? "Page link")}
                    <button
                      onClick={() => void onLinks(links.filter((other) => other !== url))}
                      aria-label="Unlink visual"
                      className="grid size-4 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                );
              })}
              {!links.length && <span className="text-xs text-muted-foreground">None</span>}
            </div>
            <SearchSelect
              placeholder="Link another visual…"
              items={visuals
                .filter((v) => !linkedIds.includes(v.id))
                .map((v) => ({ value: v.id, label: v.title, hint: v.pageTitle }))}
              value={null}
              onChange={(id) => {
                const target = visuals.find((v) => v.id === id);
                if (target) void onLinks([...links, linkUrl(target)]);
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant={confirmDelete ? "destructive" : "ghost"}
              size="sm"
              className="mr-auto"
              onBlur={() => setConfirmDelete(false)}
              onClick={() => (confirmDelete ? void onDelete() : setConfirmDelete(true))}
            >
              <Trash2Icon /> {confirmDelete ? "Confirm delete" : "Delete"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={() => {
                setSaving(true);
                void onSave(draft)
                  .then(() => setDraft(null))
                  .finally(() => setSaving(false));
              }}
            >
              {saving && <Spinner />} Save
            </Button>
          </div>
        </div>
      )}
      {row.datagalaxy_url && (
        <a href={String(row.datagalaxy_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Open in DataGalaxy <ExternalLinkIcon className="size-3" />
        </a>
      )}
    </article>
  );
}
