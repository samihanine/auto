/** Option lists shared by several tables. */
export const STATUS = [
  { value: "to_do", label: "To do", color: "red" },
  { value: "to_study", label: "To study", color: "orange" },
  { value: "in_progress", label: "In progress", color: "blue" },
  { value: "to_validate", label: "To validate", color: "yellow" },
  { value: "done", label: "Done", color: "green" },
  { value: "canceled", label: "Canceled", color: "gray" },
] as const;

export const PRIORITY = [
  { value: "low", label: "Low", color: "gray" },
  { value: "medium", label: "Medium", color: "yellow" },
  { value: "high", label: "High", color: "red" },
] as const;

export const SCOPE = [
  { value: "private", label: "Private", color: "violet" },
  { value: "public", label: "Public", color: "teal" },
] as const;

/** Power BI links: report, page, and visual links (copied with "Copy link to visual"). */
export const REPORT_FIELDS = [
  { name: "report_url", label: "Report", description: "Power BI report link", dataType: "url" },
  { name: "page_url", label: "Page", description: "Power BI page link", dataType: "url" },
] as const;

export const VISUALS_FIELD = {
  name: "visual_urls",
  label: "Visuals",
  description: "Power BI visual links (\"…&visual=<id>\"), one per line",
  dataType: "url",
  multiple: true,
} as const;
