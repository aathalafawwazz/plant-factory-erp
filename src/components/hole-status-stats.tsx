"use client";

import { HOLE_STATUS, type HoleStatus } from "@/lib/constants";
import { useLang } from "@/lib/i18n";

// Theme-aware stat card styles. Light palette = deeper ink for readability on white;
// dark palette = original vibrant hues for legibility on dark surfaces.
const STATUS_HEX: Record<HoleStatus, { bg: string; border: string; text: string; dot: string }> = {
  empty: {
    bg: "bg-[#6b7280]/10 dark:bg-[#3a3d45]/10",
    border: "border-[#6b7280]/25 dark:border-[#3a3d45]/30",
    text: "text-[#4b5563] dark:text-[#9CA3AF]",
    dot: "bg-[#6b7280] dark:bg-[#9CA3AF]",
  },
  planted: {
    bg: "bg-[#3b5bdb]/8 dark:bg-[#638cff]/10",
    border: "border-[#3b5bdb]/25 dark:border-[#638cff]/30",
    text: "text-[#2749b0] dark:text-[#638cff]",
    dot: "bg-[#3b5bdb] dark:bg-[#638cff]",
  },
  growing: {
    bg: "bg-[#16a34a]/8 dark:bg-[#4ade80]/10",
    border: "border-[#16a34a]/25 dark:border-[#4ade80]/30",
    text: "text-[#15803d] dark:text-[#4ade80]",
    dot: "bg-[#16a34a] dark:bg-[#4ade80]",
  },
  ready_harvest: {
    bg: "bg-[#d97706]/8 dark:bg-[#f59e0b]/10",
    border: "border-[#d97706]/25 dark:border-[#f59e0b]/30",
    text: "text-[#b45309] dark:text-[#f59e0b]",
    dot: "bg-[#d97706] dark:bg-[#f59e0b]",
  },
  harvested: {
    bg: "bg-[#0d9488]/8 dark:bg-[#2dd4bf]/10",
    border: "border-[#0d9488]/25 dark:border-[#2dd4bf]/30",
    text: "text-[#0f766e] dark:text-[#2dd4bf]",
    dot: "bg-[#0d9488] dark:bg-[#2dd4bf]",
  },
  maintenance: {
    bg: "bg-[#dc2626]/8 dark:bg-[#ef4444]/10",
    border: "border-[#dc2626]/25 dark:border-[#ef4444]/30",
    text: "text-[#b91c1c] dark:text-[#ef4444]",
    dot: "bg-[#dc2626] dark:bg-[#ef4444]",
  },
};

interface Props {
  counts: Record<HoleStatus, number>;
}

export function HoleStatusStats({ counts }: Props) {
  const { t } = useLang();
  const order: HoleStatus[] = ["empty", "planted", "growing", "ready_harvest", "harvested", "maintenance"];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {order.map((key) => {
        const config = HOLE_STATUS[key];
        const style = STATUS_HEX[key];
        const count = counts[key] ?? 0;
        return (
          <div
            key={key}
            className={`rounded-lg border ${style.border} ${style.bg} p-3 flex flex-col justify-between min-h-[76px]`}
          >
            <p className={`text-2xl font-bold leading-none ${style.text} tabular-nums`}>{count}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot} shrink-0`} />
              <span className="text-[11px] text-muted-foreground truncate">{t(config.labelKey)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
