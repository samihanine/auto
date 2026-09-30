import type { FieldOption, OptionColor } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const DOTS: Record<OptionColor, string> = {
  cyan: "bg-cyan-500",
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  gray: "bg-neutral-400",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  brown: "bg-amber-800",
  black: "bg-neutral-900",
  white: "bg-white ring-1 ring-border",
  lime: "bg-lime-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
};

export function OptionBadge({ option, className }: { option: FieldOption; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 text-xs whitespace-nowrap text-foreground/80",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOTS[option.color])} />
      {option.name}
    </span>
  );
}
