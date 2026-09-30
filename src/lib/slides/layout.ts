import type { Row } from "@/lib/schemas";

/** Slide geometry shared by the HTML preview, the PPTX and the PDF exports. */
export const SLIDE = { widthIn: 13.333, heightIn: 7.5, widthPt: 960, heightPt: 540 };

export type Box = { x: number; y: number; w: number; h: number }; // fractions of the slide
type Zone = Box & { direction: "column" | "row" };

export const THEMES = {
  Light: { background: "FFFFFF", text: "1F2937", muted: "6B7280", accent: "A98B46" },
  Dark: { background: "111827", text: "F9FAFB", muted: "9CA3AF", accent: "D4B86A" },
  Accent: { background: "A98B46", text: "FFFFFF", muted: "F3EBD8", accent: "FFFFFF" },
} as const;

export type Theme = (typeof THEMES)[keyof typeof THEMES];

const TITLE: Box = { x: 0.06, y: 0.07, w: 0.88, h: 0.13 };
const BODY = { y: 0.25, h: 0.67 };

const LAYOUTS: Record<string, { title: Box; subtitle?: Box; titleSize: number; zones: Record<string, Zone> }> = {
  Title: {
    title: { x: 0.08, y: 0.32, w: 0.84, h: 0.2 },
    subtitle: { x: 0.08, y: 0.53, w: 0.84, h: 0.09 },
    titleSize: 44,
    zones: { main: { x: 0.08, y: 0.68, w: 0.84, h: 0.22, direction: "column" } },
  },
  "Section header": {
    title: { x: 0.08, y: 0.38, w: 0.84, h: 0.16 },
    subtitle: { x: 0.08, y: 0.55, w: 0.84, h: 0.09 },
    titleSize: 40,
    zones: {},
  },
  "Title + content": {
    title: TITLE,
    titleSize: 28,
    zones: { main: { x: 0.06, ...BODY, w: 0.88, direction: "column" } },
  },
  "Two columns": {
    title: TITLE,
    titleSize: 28,
    zones: {
      left: { x: 0.06, ...BODY, w: 0.43, direction: "column" },
      right: { x: 0.51, ...BODY, w: 0.43, direction: "column" },
    },
  },
  "Image + text": {
    title: { x: 0.5, y: 0.07, w: 0.44, h: 0.13 },
    titleSize: 26,
    zones: {
      left: { x: 0, y: 0, w: 0.45, h: 1, direction: "column" },
      right: { x: 0.5, ...BODY, w: 0.44, direction: "column" },
    },
  },
  "Full image": {
    title: { x: 0.06, y: 0.8, w: 0.88, h: 0.13 },
    titleSize: 30,
    zones: { main: { x: 0, y: 0, w: 1, h: 1, direction: "column" } },
  },
  KPIs: {
    title: TITLE,
    titleSize: 28,
    zones: { main: { x: 0.06, y: 0.32, w: 0.88, h: 0.45, direction: "row" } },
  },
};

const GAP = 0.02;

export type SlideLayout = {
  theme: Theme;
  title: Box;
  titleSize: number;
  subtitle?: Box;
  blocks: { section: Row; box: Box }[];
};

/** Places each section in its zone (unknown zones fall back to the first one), split evenly. */
export function layoutSlide(slide: Row, sections: Row[]): SlideLayout {
  const layout = LAYOUTS[String(slide.layout)] ?? LAYOUTS["Title + content"];
  const zoneNames = Object.keys(layout.zones);
  const byZone = new Map<string, Row[]>();
  for (const section of [...sections].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))) {
    const zone = zoneNames.includes(String(section.zone)) ? String(section.zone) : zoneNames[0];
    if (zone) byZone.set(zone, [...(byZone.get(zone) ?? []), section]);
  }

  const blocks = [...byZone].flatMap(([name, items]) => {
    const zone = layout.zones[name];
    const row = zone.direction === "row";
    const size = ((row ? zone.w : zone.h) - GAP * (items.length - 1)) / items.length;
    return items.map((section, index) => ({
      section,
      box: row
        ? { x: zone.x + index * (size + GAP), y: zone.y, w: size, h: zone.h }
        : { x: zone.x, y: zone.y + index * (size + GAP), w: zone.w, h: size },
    }));
  });

  return {
    theme: THEMES[String(slide.theme) as keyof typeof THEMES] ?? THEMES.Light,
    title: layout.title,
    titleSize: layout.titleSize,
    subtitle: slide.subtitle ? layout.subtitle : undefined,
    blocks,
  };
}

/** Slides in deck order with their sections (linked by slide name). */
export const deck = (slides: Row[], sections: Row[]) =>
  [...slides]
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map((slide) => ({ slide, sections: sections.filter((s) => s.slide === slide.name) }));

export const lines = (value: unknown) =>
  String(value ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-•*]\s*/, ""))
    .filter((line) => line.trim());

export function tableData(value: unknown): string[][] {
  try {
    const data = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(data) ? data.map((row) => (Array.isArray(row) ? row.map(String) : [String(row)])) : [];
  } catch {
    return [];
  }
}
