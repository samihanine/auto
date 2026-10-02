import { useMutation } from "@tanstack/react-query";
import { PlayIcon } from "lucide-react";
import { useState } from "react";
import type { DatasetRef } from "@repo/microsoft-auth/powerbi";
import { executeQuery } from "@repo/microsoft-auth/powerbi";
import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { Textarea } from "@repo/ui/components/textarea";
import { errorMessage } from "@repo/ui/lib/utils";

/** Runs DAX queries on the report's dataset and shows the result table. */
export function DaxPanel({ dataset }: { dataset?: DatasetRef }) {
  const [query, setQuery] = useState("EVALUATE\nTOPN(10, INFO.VIEW.MEASURES())");
  const run = useMutation({ mutationFn: () => executeQuery(dataset!, query) });

  if (!dataset)
    return <p className="p-4 text-sm text-muted-foreground">No dataset found for this report — add its dataset link to the report.</p>;

  const rows = run.data ?? [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <Textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run.mutate();
        }}
        spellCheck={false}
        className="min-h-32 font-mono text-xs"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? <Spinner /> : <PlayIcon />} Run
        </Button>
        <span className="text-xs text-muted-foreground">⌘↵ · {run.data ? `${rows.length} rows` : "executeQueries"}</span>
      </div>
      {run.error && <p className="text-xs text-destructive">{errorMessage(run.error)}</p>}
      {columns.length > 0 && (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>{columns.map((c) => <th key={c} className="px-2 py-1.5 font-medium whitespace-nowrap">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t">
                  {columns.map((c) => <td key={c} className="px-2 py-1.5 whitespace-nowrap tabular-nums">{String(row[c] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
