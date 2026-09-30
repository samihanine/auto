import PptxGenJS from "pptxgenjs";
import { imageDataUrl } from "@/lib/images";
import type { Row } from "@/lib/schemas";
import { boldRuns } from "@/lib/utils";
import type { Box, Theme } from "./layout";
import { SLIDE, deck, layoutSlide, lines, tableData } from "./layout";

const inches = (box: Box) => ({
  x: box.x * SLIDE.widthIn,
  y: box.y * SLIDE.heightIn,
  w: box.w * SLIDE.widthIn,
  h: box.h * SLIDE.heightIn,
});

const runs = (text: string, options: PptxGenJS.TextPropsOptions = {}) =>
  boldRuns(text).map((run) => ({ text: run.text, options: { ...options, bold: run.bold || options.bold } }));

export async function exportPptx(dir: FileSystemDirectoryHandle, slides: Row[], sections: Row[], name: string) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  for (const { slide, sections: blocks } of deck(slides, sections)) {
    const layout = layoutSlide(slide, blocks);
    const { theme } = layout;
    const page = pptx.addSlide();
    page.background = { color: theme.background };
    if (slide.notes) page.addNotes(String(slide.notes).replace(/\*\*/g, ""));

    for (const { section, box } of layout.blocks) await addBlock(page, dir, section, inches(box), theme);

    const centered = ["Title", "Section header"].includes(String(slide.layout));
    page.addText(String(slide.name), {
      ...inches(layout.title),
      fontSize: layout.titleSize,
      bold: true,
      color: theme.text,
      align: centered ? "center" : "left",
      valign: "bottom",
    });
    if (layout.subtitle)
      page.addText(String(slide.subtitle), {
        ...inches(layout.subtitle),
        fontSize: 18,
        color: theme.muted,
        align: centered ? "center" : "left",
        valign: "top",
      });
  }
  await pptx.writeFile({ fileName: `${name}.pptx` });
}

async function addBlock(
  page: PptxGenJS.Slide,
  dir: FileSystemDirectoryHandle,
  section: Row,
  position: ReturnType<typeof inches>,
  theme: Theme,
) {
  const content = String(section.content ?? "");
  const text = { ...position, color: theme.text, valign: "top" as const, fontSize: 18 };
  switch (section.type) {
    case "Image": {
      const data = section.image ? await imageDataUrl(dir, String(section.image)) : null;
      if (data) page.addImage({ data, ...position, sizing: { type: "cover", w: position.w, h: position.h } });
      return;
    }
    case "Bullets":
      // One paragraph per line: bold runs share the bullet, the last run breaks the line.
      return page.addText(
        lines(content).flatMap((line) =>
          runs(line, { bullet: { code: "2022" } }).map((run, i, all) => ({
            ...run,
            options: { ...run.options, breakLine: i === all.length - 1 },
          })),
        ),
        { ...text, paraSpaceAfter: 8 },
      );
    case "Quote":
      return page.addText(runs(content, { italic: true }), { ...text, fontSize: 24 });
    case "KPI":
      page.addShape("rect", { ...position, fill: { color: theme.accent, transparency: 90 }, rectRadius: 0.1 });
      page.addText(String(section.value ?? ""), { ...position, h: position.h * 0.6, fontSize: 44, bold: true, color: theme.accent, align: "center", valign: "bottom" });
      page.addText(content, { ...position, y: position.y + position.h * 0.6, h: position.h * 0.4, fontSize: 14, color: theme.muted, align: "center", valign: "top" });
      return;
    case "Table": {
      const rows = tableData(section.data);
      if (!rows.length) return;
      page.addTable(
        rows.map((row, r) => row.map((cell) => ({ text: cell, options: { bold: r === 0, color: theme.text } }))),
        { ...position, fontSize: 13, border: { type: "solid", pt: 0.5, color: theme.muted } },
      );
      return;
    }
    default:
      return page.addText(runs(content), text);
  }
}
