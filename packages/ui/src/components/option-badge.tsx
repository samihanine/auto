import { cn } from "../lib/utils";

export const OPTION_COLORS = [
  "cyan", "green", "yellow", "red", "purple", "blue", "gray", "orange",
  "pink", "brown", "black", "white", "lime", "teal", "indigo", "violet",
] as const;

export type OptionColor = (typeof OPTION_COLORS)[number];
export type BadgeOption = { value: string; label?: string; color?: OptionColor };

/** Tinted background + readable text per option color. */
const STYLES: Record<OptionColor, string> = {
  cyan: "bg-cyan-100 text-cyan-800",
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
  purple: "bg-purple-100 text-purple-800",
  blue: "bg-blue-100 text-blue-800",
  gray: "bg-neutral-100 text-neutral-700",
  orange: "bg-orange-100 text-orange-800",
  pink: "bg-pink-100 text-pink-800",
  brown: "bg-amber-100 text-amber-900",
  black: "bg-neutral-800 text-white",
  white: "bg-white text-neutral-700 ring-1 ring-border",
  lime: "bg-lime-100 text-lime-800",
  teal: "bg-teal-100 text-teal-800",
  indigo: "bg-indigo-100 text-indigo-800",
  violet: "bg-violet-100 text-violet-800",
};

/** Option label on a background of its color. */
export function OptionBadge({ option, className }: { option: BadgeOption; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-xs font-medium whitespace-nowrap",
        STYLES[option.color ?? "gray"],
        className,
      )}
    >
      {option.label ?? option.value}
    </span>
  );
}
