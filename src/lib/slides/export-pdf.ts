import pdfMake from "pdfmake/build/pdfmake";
import vfs from "pdfmake/build/vfs_fonts";
import type { Content } from "pdfmake/interfaces";
import { imageDataUrl } from "@/lib/images";
import type { Row } from "@/lib/schemas";
import { boldRuns } from "@/lib/utils";
import type { Box, Theme } from "./layout";
import { SLIDE, deck, layoutSlide, lines, tableData } from "./layout";

pdfMake.addVirtualFileSystem(vfs);

const at = (box: Box) => ({
  absolutePosition: { x: box.x * SLIDE.widthPt, y: box.y * SLIDE.heightPt },
  width: box.w * SLIDE.widthPt,
});
const color = (hex: string) => `#${hex}`;
const runs = (text: string) => boldRuns(text).map((run) => ({ text: run.text, bold: run.bold }));

export async function exportPdf(dir: FileSystemDirectoryHandle, slides: Row[], sections: Row[], name: string) {
  const pages: Content[] = [];
  for (const [index, { slide, sections: blocks }] of deck(slides, sections).entries()) {
    const layout = layoutSlide(slide, blocks);
    const { theme } = layout;
    const centered = ["Title", "Section header"].includes(String(slide.layout));
    const align = centered ? "center" : "left";

    pages.push(
      {
        canvas: [{ type: "rect", x: 0, y: 0, w: SLIDE.widthPt, h: SLIDE.heightPt, color: color(theme.background) }],
        absolutePosition: { x: 0, y: 0 },
        ...(index > 0 && { pageBreak: "before" as const }),
      },
      ...(await Promise.all(layout.blocks.map(({ section, box }) => block(dir, section, box, theme)))),
      {
        ...at({ ...layout.title, y: layout.title.y + layout.title.h - layout.titleSize / SLIDE.heightPt * 1.3 }),
        text: String(slide.name),
        fontSize: layout.titleSize,
        bold: true,
        color: color(theme.text),
        alignment: align,
      },
    );
    if (layout.subtitle)
      pages.push({ ...at(layout.subtitle), text: String(slide.subtitle), fontSize: 18, color: color(theme.muted), alignment: align });
  }

  await pdfMake
    .createPdf({
      pageSize: { width: SLIDE.widthPt, height: SLIDE.heightPt },
      pageMargins: 0,
      content: pages,
      defaultStyle: { font: "Roboto" },
    })
    .download(`${name}.pdf`);
}

async function block(dir: FileSystemDirectoryHandle, section: Row, box: Box, theme: Theme): Promise<Content> {
  const content = String(section.content ?? "");
  const base = { ...at(box), color: color(theme.text), fontSize: 18 };
  switch (section.type) {
    case "Image": {
      const data = section.image ? await imageDataUrl(dir, String(section.image)) : null;
      return data
        ? { image: data, ...at(box), cover: { width: box.w * SLIDE.widthPt, height: box.h * SLIDE.heightPt } }
        : { text: "" };
    }
    case "Bullets":
      return { ...base, ul: lines(content).map((line) => ({ text: runs(line), margin: [0, 0, 0, 6] })) };
    case "Quote":
      return { ...base, text: runs(content), italics: true, fontSize: 24 };
    case "KPI":
      return {
        ...base,
        absolutePosition: { x: box.x * SLIDE.widthPt, y: (box.y + box.h * 0.3) * SLIDE.heightPt },
        alignment: "center",
        stack: [
          { text: String(section.value ?? ""), fontSize: 44, bold: true, color: color(theme.accent) },
          { text: content, fontSize: 14, color: color(theme.muted), margin: [0, 6, 0, 0] },
        ],
      };
    case "Table": {
      const rows = tableData(section.data);
      if (!rows.length) return { text: "" };
      const width = rows[0].length;
      return {
        ...base,
        fontSize: 12,
        table: {
          headerRows: 1,
          widths: Array(width).fill("*"),
          body: rows.map((row, r) =>
            Array.from({ length: width }, (_, i) => ({ text: row[i] ?? "", bold: r === 0 })),
          ),
        },
        layout: "lightHorizontalLines",
      };
    }
    default:
      return { ...base, text: runs(content) };
  }
}
