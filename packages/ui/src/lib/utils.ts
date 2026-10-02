export { cn } from "cn";

export function download(data: BlobPart | File, name: string, type?: string) {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data], { type: type ?? "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(value: unknown, name: string) {
  download(
    JSON.stringify(value, null, 2),
    `${slugify(name)}.json`,
    "application/json",
  );
}

export function downloadText(value: string, name: string) {
  download(value, `${slugify(name)}.txt`, "text/plain");
}

export function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "file"
  );
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function formatValue(value: unknown, format = "text") {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "number") return String(value);
  switch (format) {
    case "integer":
      return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    case "currency":
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
    case "percent":
      return value.toLocaleString("en-US", {
        style: "percent",
        maximumFractionDigits: 1,
      });
    default:
      return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
}

export function compactNumber(value: unknown) {
  return typeof value === "number"
    ? value.toLocaleString("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      })
    : String(value ?? "");
}

/** Splits "plain **bold** text" into runs; the only rich formatting we support. */
export function boldRuns(value: string) {
  return value
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      /^\*\*[^*]+\*\*$/.test(part)
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );
}
