/**
 * App-wide switches and tuning. Change a value here to enable / disable a feature in every app.
 */

/** Tabs and features of the apps. */
export const FEATURES = {
  /** "Assistant" tab (embedded AI chat) in the CMS and the Power BI viewer. */
  aiChat: true,
  /** "DAX" tab of the Power BI viewer (DAX queries on the report dataset). */
  daxTab: true,
  /** "Guide" tab of the Power BI viewer. */
  guideTab: true,
  /** "Data" tab (DataGalaxy definitions) of the Power BI viewer. */
  dataTab: true,
  /** CMS: upload images to the SharePoint / OneDrive folder (otherwise image fields take links only). */
  imageUpload: true,
  /** CMS: edit simple fields directly in the table (otherwise only in the side form). */
  inlineEdit: true,
  /** CMS: saved views (tabs with their own filters, sort and columns). Off = one view. */
  savedViews: true,
} as const;

/**
 * When the content of the excels is sent to the AI:
 * "first" = with the first message of each user turn only, "every" = with every message of the
 * turn (after each tool use too), "never" = not sent (the AI only has the context and tool results).
 */
export type ExcelSync = "first" | "every" | "never";

/** Behaviour of the AI agent (chat app). */
export const AI = {
  /** Read-only excels: their content rarely changes during a turn. */
  readExcels: "first" as ExcelSync,
  /** Writable excels: refreshed after each tool use so the AI sees its own changes. */
  writeExcels: "every" as ExcelSync,
  /** Repeat the protocol + agent instructions on every message (true) or only on the first one. */
  repeatInstructions: true,
  /** Rows sent per excel at most (the rest is summarised as a count). */
  maxRowsPerExcel: 300,
  /** Tool-use rounds before giving up on a turn. */
  maxSteps: 12,
  /** Prose replies in a row accepted as the final answer (models that ignore the JSON format). */
  proseAnswerAfter: 2,
  /** DAX tool: rows returned to the AI at most. */
  maxDaxRows: 100,
  /** Models offered in the chat; the first one is the default. */
  models: ["gpt-5", "gpt-6-luna"] as const,
};

/** Polling and saving delays (ms). */
export const TIMING = {
  /** CMS rows re-read from Excel (changes made by the AI or other apps). */
  cmsRefresh: 15_000,
  /** Viewer: report_viewer row polled to follow the AI's page / filter changes. */
  viewerStateRefresh: 2_000,
  /** Viewer: guide / data excels re-read. */
  linkedRefresh: 30_000,
  /** CMS form: autosave after the user stops typing. */
  autosaveDelay: 800,
};
