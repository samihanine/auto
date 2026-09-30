import { useQuery } from "@tanstack/react-query";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Database } from "@/lib/crud-table";
import { resultKey, visualQuery } from "@/lib/dax";
import { executeQuery } from "@/lib/pbi-api";
import { parseJson } from "@/lib/pbi-fields";
import type { Row } from "@/lib/schemas";
import { compactNumber, errorMessage } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

type Data = Record<string, unknown>[];
type Format = { color?: string; colors?: string[]; background?: string; titleColor?: string; showLegend?: boolean };

const PALETTE = ["#a98b46", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899"];
const list = (value: unknown) => [value].flat().filter((v): v is string => typeof v === "string" && !!v);

/** A report visual rendered from its DAX result (builder canvas). */
export function VisualView({ db, visual, datasetId }: { db: Database; visual: Row; datasetId?: string }) {
  const query = visualQuery(db, visual, datasetId);
  const result = useQuery({
    queryKey: ["dax", query?.ref.datasetId, query?.dax],
    queryFn: () => executeQuery(query!.ref, query!.dax),
    enabled: !!query,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const format = parseJson<Format>(visual.format, {});
  const colors = format.colors?.length ? format.colors : format.color ? [format.color, ...PALETTE] : PALETTE;

  return (
    <div
      className="flex size-full flex-col overflow-hidden rounded-lg border bg-card p-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
      style={{ background: format.background }}
    >
      {visual.type !== "textbox" && (
        <p className="truncate text-xs font-medium" style={{ color: format.titleColor }}>
          {String(visual.title ?? visual.name)}
        </p>
      )}
      <div className="min-h-0 flex-1 pt-1.5 text-xs">
        {visual.type === "textbox" ? (
          <TextBox visual={visual} />
        ) : !query ? (
          <Empty>No fields yet</Empty>
        ) : result.isLoading ? (
          <Empty><Spinner /></Empty>
        ) : result.error ? (
          <Empty>{errorMessage(result.error)}</Empty>
        ) : (
          <Content visual={visual} data={result.data ?? []} colors={colors} legend={format.showLegend !== false} />
        )}
      </div>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="grid size-full place-items-center p-2 text-center text-muted-foreground">{children}</div>
);

function TextBox({ visual }: { visual: Row }) {
  return (
    <div className="size-full overflow-hidden">
      <p className="text-sm font-semibold">{String(visual.title ?? "")}</p>
      <p className="mt-1 whitespace-pre-line text-muted-foreground">{String(visual.description ?? "")}</p>
    </div>
  );
}

/** Pivots series values into columns: [{x, serieA, serieB}] */
function pivot(data: Data, x: string, series: string, value: string) {
  const rows = new Map<unknown, Record<string, unknown>>();
  const keys = new Set<string>();
  for (const row of data) {
    const key = String(row[series] ?? "(blank)");
    keys.add(key);
    rows.set(row[x], { ...rows.get(row[x]), [x]: row[x], [key]: row[value] });
  }
  return { data: [...rows.values()], keys: [...keys] };
}

function Content({ visual, data, colors, legend }: { visual: Row; data: Data; colors: string[]; legend: boolean }) {
  const type = String(visual.type ?? "tableEx");
  const category = list(visual.category).map(resultKey);
  const values = list(visual.values).map(resultKey);
  const series = list(visual.series).map(resultKey);
  if (!data.length) return <Empty>No data</Empty>;

  if (["card", "kpi", "gauge", "multiRowCard"].includes(type))
    return (
      <div className="flex size-full flex-wrap items-center justify-center gap-4">
        {values.map((key, i) => (
          <div key={key} className="text-center">
            <p className="text-2xl font-semibold tabular-nums" style={{ color: i === 0 ? colors[0] : undefined }}>
              {compactNumber(data[0][key])}
            </p>
            <p className="text-muted-foreground">{key}</p>
          </div>
        ))}
      </div>
    );

  if (type === "slicer")
    return (
      <div className="flex size-full flex-col gap-1 overflow-auto">
        {data.map((row, i) => (
          <label key={i} className="flex items-center gap-2">
            <span className="size-3 rounded-sm border" /> {String(row[category[0]] ?? "(blank)")}
          </label>
        ))}
      </div>
    );

  const x = category[0];
  const chartable = x && values.length;
  if (chartable && ["pieChart", "donutChart", "funnel", "treemap"].includes(type))
    return (
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey={values[0]} nameKey={x} innerRadius={type === "donutChart" ? "55%" : 0} outerRadius="90%">
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => compactNumber(v)} />
          {legend && <Legend wrapperStyle={{ fontSize: 10 }} />}
        </PieChart>
      </ResponsiveContainer>
    );

  if (type === "scatterChart" && values.length >= 2)
    return (
      <ResponsiveContainer>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
          <XAxis dataKey={values[0]} tick={{ fontSize: 10 }} tickFormatter={compactNumber} />
          <YAxis dataKey={values[1]} tick={{ fontSize: 10 }} tickFormatter={compactNumber} width={40} />
          <Tooltip />
          <Scatter data={data} fill={colors[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    );

  const cartesian = ["Column", "Bar", "line", "area", "waterfall", "Combo"].some((part) => type.includes(part));
  if (chartable && cartesian) {
    const { data: rows, keys } = series.length ? pivot(data, x, series[0], values[0]) : { data, keys: values };
    const horizontal = type.includes("BarChart");
    const stacked = type.startsWith("stacked");
    const mark = (key: string, i: number) => {
      const color = colors[i % colors.length];
      if (type === "lineChart" || (type.includes("Combo") && i > 0))
        return <Line key={key} dataKey={key} stroke={color} strokeWidth={2} dot={false} />;
      if (type === "areaChart") return <Area key={key} dataKey={key} stroke={color} fill={color} fillOpacity={0.2} />;
      return <Bar key={key} dataKey={key} fill={color} stackId={stacked ? "s" : undefined} radius={2} />;
    };
    return (
      <ResponsiveContainer>
        <ComposedChart data={rows} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: 0, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={compactNumber} />
              <YAxis type="category" dataKey={x} tick={{ fontSize: 10 }} width={80} />
            </>
          ) : (
            <>
              <XAxis dataKey={x} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={compactNumber} width={40} />
            </>
          )}
          <Tooltip formatter={(v) => compactNumber(v)} />
          {legend && keys.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {keys.map(mark)}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  const columns = Object.keys(data[0]);
  return (
    <div className="size-full overflow-auto">
      <table className="w-full text-left">
        <thead>
          <tr>{columns.map((c) => <th key={c} className="sticky top-0 border-b bg-card px-1.5 py-1 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-border/50">
              {columns.map((c) => (
                <td key={c} className="px-1.5 py-1 tabular-nums">
                  {typeof row[c] === "number" ? compactNumber(row[c]) : String(row[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
