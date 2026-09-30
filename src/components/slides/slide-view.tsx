import { useImageUrl } from "@/lib/hooks";
import type { Row } from "@/lib/schemas";
import type { Box, Theme } from "@/lib/slides/layout";
import { layoutSlide, lines, tableData } from "@/lib/slides/layout";
import { boldRuns, cn } from "@/lib/utils";

// Font sizes are given in points of a 960pt-wide slide and scaled with the container width.
const pt = (size: number) => `${size / 9.6}cqw`;
const place = (box: Box): React.CSSProperties => ({
  position: "absolute",
  left: `${box.x * 100}%`,
  top: `${box.y * 100}%`,
  width: `${box.w * 100}%`,
  height: `${box.h * 100}%`,
});
const hex = (color: string) => `#${color}`;

export function SlideView({ slide, sections, className }: { slide: Row; sections: Row[]; className?: string }) {
  const layout = layoutSlide(slide, sections);
  const { theme } = layout;
  const centered = ["Title", "Section header"].includes(String(slide.layout));

  return (
    <div
      className={cn("relative aspect-video w-full overflow-hidden select-none", className)}
      style={{ containerType: "inline-size", background: hex(theme.background), color: hex(theme.text) }}
    >
      {layout.blocks.map(({ section, box }) => (
        <div key={section.id} style={place(box)} className="overflow-hidden">
          <Block section={section} theme={theme} />
        </div>
      ))}
      <div
        style={{ ...place(layout.title), fontSize: pt(layout.titleSize) }}
        className={cn("flex items-end leading-tight font-semibold tracking-tight", centered && "justify-center text-center")}
      >
        {slide.name}
      </div>
      {layout.subtitle && (
        <div
          style={{ ...place(layout.subtitle), fontSize: pt(18), color: hex(theme.muted) }}
          className={cn(centered && "text-center")}
        >
          {String(slide.subtitle)}
        </div>
      )}
    </div>
  );
}

function Rich({ text }: { text: string }) {
  return (
    <>
      {boldRuns(text).map((run, i) => (run.bold ? <b key={i}>{run.text}</b> : <span key={i}>{run.text}</span>))}
    </>
  );
}

function Block({ section, theme }: { section: Row; theme: Theme }) {
  const content = String(section.content ?? "");
  switch (section.type) {
    case "Image":
      return <SlideImage value={section.image ? String(section.image) : null} />;
    case "Bullets":
      return (
        <ul style={{ fontSize: pt(18) }} className="flex flex-col gap-[0.6em] leading-snug">
          {lines(content).map((line, i) => (
            <li key={i} className="flex gap-[0.6em]">
              <span style={{ color: hex(theme.accent) }}>•</span>
              <span><Rich text={line} /></span>
            </li>
          ))}
        </ul>
      );
    case "Quote":
      return (
        <blockquote
          style={{ fontSize: pt(24), borderColor: hex(theme.accent) }}
          className="h-full border-l-[0.35cqw] pl-[1.2cqw] leading-snug italic"
        >
          <Rich text={content} />
        </blockquote>
      );
    case "KPI":
      return (
        <div
          className="flex h-full flex-col items-center justify-center rounded-[0.8cqw] text-center"
          style={{ background: `${hex(theme.accent)}1a` }}
        >
          <span style={{ fontSize: pt(44), color: hex(theme.accent) }} className="leading-none font-semibold">
            {String(section.value ?? "")}
          </span>
          <span style={{ fontSize: pt(14), color: hex(theme.muted) }} className="mt-[0.8cqw]">
            {content}
          </span>
        </div>
      );
    case "Table": {
      const [head, ...rows] = tableData(section.data);
      return (
        <table style={{ fontSize: pt(13) }} className="w-full border-collapse">
          <thead>
            <tr style={{ borderColor: hex(theme.accent) }} className="border-b-2 text-left">
              {head?.map((cell, i) => <th key={i} className="px-[0.6cqw] py-[0.4cqw] font-semibold">{cell}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} style={{ borderColor: `${hex(theme.muted)}55` }} className="border-b">
                {row.map((cell, i) => <td key={i} className="px-[0.6cqw] py-[0.4cqw]">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    default:
      return (
        <p style={{ fontSize: pt(18) }} className="leading-snug whitespace-pre-line">
          <Rich text={content} />
        </p>
      );
  }
}

function SlideImage({ value }: { value: string | null }) {
  const url = useImageUrl(value);
  return url ? (
    <img src={url} alt="" className="size-full object-cover" />
  ) : (
    <div className="size-full bg-black/5" />
  );
}
