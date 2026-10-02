import { useState } from "react";
import { parseDatasetUrl, parseReportUrl } from "@repo/microsoft-auth/powerbi";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { errorMessage } from "@repo/ui/lib/utils";
import { useSettings } from "@/lib/store";
import { viewerTable } from "@/lib/viewer-state";

/** Report link (+ optional name / dataset link). */
export function AddReportForm() {
  const [settings, updateSettings] = useSettings();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [datasetUrl, setDatasetUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { reportId } = parseReportUrl(url);
      if (datasetUrl) parseDatasetUrl(datasetUrl);
      const id = crypto.randomUUID();
      void updateSettings({
        reports: [...settings.reports, { id, url: url.trim(), name: name.trim() || `Report ${reportId.slice(0, 8)}`, datasetUrl: datasetUrl.trim() || undefined }],
        activeReport: id,
      });
      setUrl("");
      setName("");
      setDatasetUrl("");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm font-medium">Add a report</p>
      <Input required placeholder="Report link (app.powerbi.com/…/reports/…)" value={url} onChange={(e) => setUrl(e.target.value)} className="rounded-xl" />
      <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
      <Input placeholder="Dataset link (optional, if not readable from the report)" value={datasetUrl} onChange={(e) => setDatasetUrl(e.target.value)} className="rounded-xl" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="self-start">Add report</Button>
    </form>
  );
}

/** First run: a report and the report_viewer Excel the assistant writes to. */
export function Setup() {
  const [settings, updateSettings] = useSettings();
  const [excel, setExcel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await viewerTable(excel.trim()); // checks the link, creates the table / columns
      await updateSettings({ viewerExcel: excel.trim() });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-dvh place-items-center bg-muted/40 p-6">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border bg-background p-8 shadow-[0_8px_30px_rgb(0_0_0/0.06)]">
        <h1 className="text-lg font-semibold tracking-tight">Set up the viewer</h1>
        {!settings.reports.length && <AddReportForm />}
        {!settings.viewerExcel && (
          <form onSubmit={saveExcel} className="flex flex-col gap-3">
            <p className="text-sm font-medium">report_viewer Excel</p>
            <p className="text-xs text-muted-foreground">
              The assistant writes the page and filters to show in this Excel (OneDrive / SharePoint). Its table is created if needed.
            </p>
            <Input required placeholder="Excel link" value={excel} onChange={(e) => setExcel(e.target.value)} className="rounded-xl" />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="self-start">
              {busy && <Spinner />} Save
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
