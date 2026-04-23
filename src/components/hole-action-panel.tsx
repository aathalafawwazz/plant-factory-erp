"use client";

import Link from "next/link";
import { Scissors, Wrench, Sprout, ArrowRight, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

export interface ActionableHole {
  id: number;
  canonical_id: string;
  status: "ready_harvest" | "maintenance";
  crop_name?: string | null;
  days_remaining?: number | null;   // for ready_harvest, negative = overdue
}

export interface ActiveBatchSummary {
  id: number;
  batch_code: string;
  crop_name: string | null;
  total_cycles: number;
  days_elapsed: number;
  days_total: number | null;
  progress_pct: number;
}

export interface CommodityStat {
  name: string;
  count: number;
  color?: string; // optional hex for the accent
}

interface Props {
  actionables: ActionableHole[];
  batches: ActiveBatchSummary[];
  commodities: CommodityStat[];
}

// rotating palette for commodity tiles (stable per index) — theme-aware
const COMMODITY_PALETTE = [
  { text: "text-[#15803d] dark:text-[#4ade80]", bg: "bg-[#16a34a]/10 dark:bg-[#4ade80]/10", border: "border-[#16a34a]/25 dark:border-[#4ade80]/25" },
  { text: "text-[#2749b0] dark:text-[#638cff]", bg: "bg-[#3b5bdb]/10 dark:bg-[#638cff]/10", border: "border-[#3b5bdb]/25 dark:border-[#638cff]/25" },
  { text: "text-[#b45309] dark:text-[#f59e0b]", bg: "bg-[#d97706]/10 dark:bg-[#f59e0b]/10", border: "border-[#d97706]/25 dark:border-[#f59e0b]/25" },
  { text: "text-[#0f766e] dark:text-[#2dd4bf]", bg: "bg-[#0d9488]/10 dark:bg-[#2dd4bf]/10", border: "border-[#0d9488]/25 dark:border-[#2dd4bf]/25" },
  { text: "text-[#6d28d9] dark:text-[#a78bfa]", bg: "bg-[#7c3aed]/10 dark:bg-[#a78bfa]/10", border: "border-[#7c3aed]/25 dark:border-[#a78bfa]/25" },
  { text: "text-[#0e7490] dark:text-[#22d3ee]", bg: "bg-[#0891b2]/10 dark:bg-[#22d3ee]/10", border: "border-[#0891b2]/25 dark:border-[#22d3ee]/25" },
];

export function HoleActionPanel({ actionables, batches, commodities }: Props) {
  const { t } = useLang();
  const readyCount = actionables.filter((a) => a.status === "ready_harvest").length;
  const maintenanceCount = actionables.filter((a) => a.status === "maintenance").length;
  const totalCommodityCycles = commodities.reduce((s, c) => s + c.count, 0);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ========= 1. Batch Aktif ========= */}
      <div className="rounded-lg border border-border/40 bg-card flex flex-col">
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between shrink-0">
          <h3 className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
            <Sprout className="h-3.5 w-3.5 text-emerald-400" />
            {t("hole.active_batches")}
          </h3>
          <span className="text-[10px] text-muted-foreground">{batches.length} {t("hole.batch_count_suffix")}</span>
        </div>
        <div className="p-3 overflow-y-auto max-h-[280px]">
          {batches.length === 0 ? (
            <p className="text-[12px] text-muted-foreground text-center py-4">
              {t("hole.no_active_batches")}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {batches.map((b) => (
                <li key={b.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-foreground truncate">{b.batch_code}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {b.crop_name ?? "-"} · {b.total_cycles} {t("hole.holes_suffix")}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {b.days_total ? `${b.days_elapsed}/${b.days_total}h` : `${b.days_elapsed}h`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${b.progress_pct}%`,
                        backgroundColor: b.progress_pct >= 90 ? "#f59e0b" : "#4ade80",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ========= 2. Perlu Tindakan ========= */}
      <div className="rounded-lg border border-border/40 bg-card flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">{t("hole.needs_action")}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {actionables.length} {t("hole.holes_need_attention")}
            </p>
          </div>
          <div className="flex gap-1.5">
            {readyCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 text-[10px]">
                <Scissors className="h-3 w-3" /> {readyCount}
              </span>
            )}
            {maintenanceCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px]">
                <Wrench className="h-3 w-3" /> {maintenanceCount}
              </span>
            )}
          </div>
        </div>
        <div className="p-3 overflow-y-auto flex-1 min-h-0">
          {actionables.length === 0 ? (
            <p className="text-[12px] text-muted-foreground text-center py-6">
              {t("hole.all_normal")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {actionables.map((a) => {
                const isHarvest = a.status === "ready_harvest";
                const overdue = typeof a.days_remaining === "number" && a.days_remaining < 0;
                const iconStyle = isHarvest
                  ? "bg-amber-400/10 text-amber-400"
                  : "bg-rose-500/10 text-rose-400";
                const Icon = isHarvest ? Scissors : Wrench;
                return (
                  <li key={`${a.status}-${a.id}-${a.days_remaining ?? "x"}`}>
                    <Link
                      href={isHarvest ? "/panen" : "/lubang"}
                      className="flex items-center gap-2.5 rounded-md hover:bg-secondary/50 px-2 py-1.5 transition-colors"
                    >
                      <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", iconStyle)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">
                          {a.canonical_id}
                          {a.crop_name && (
                            <span className="text-muted-foreground font-normal"> · {a.crop_name}</span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {isHarvest
                            ? overdue
                              ? `${t("hole.late_days_prefix")} ${Math.abs(a.days_remaining!)} ${t("hole.late_days_suffix")}`
                              : a.days_remaining === 0
                                ? t("hole.today")
                                : a.days_remaining != null
                                  ? `${a.days_remaining} ${t("hole.days_left_suffix")}`
                                  : t("hole.ready_to_harvest")
                            : t("hole.needs_maintenance")}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ========= 3. Statistik Komoditas ========= */}
      <div className="rounded-lg border border-border/40 bg-card">
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            {t("hole.commodity_stats")}
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {totalCommodityCycles} {t("hole.active_holes_suffix")}
          </span>
        </div>
        <div className="p-3">
          {commodities.length === 0 ? (
            <p className="text-[12px] text-muted-foreground text-center py-4">
              {t("hole.no_commodity_planted")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {commodities.slice(0, 6).map((c, i) => {
                const style = COMMODITY_PALETTE[i % COMMODITY_PALETTE.length];
                return (
                  <div
                    key={c.name}
                    className={cn("rounded-md border p-2", style.border, style.bg)}
                  >
                    <p className={cn("text-lg font-bold leading-none tabular-nums", style.text)}>
                      {c.count}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1.5 truncate">{c.name}</p>
                  </div>
                );
              })}
            </div>
          )}
          <Link href="/komoditas" className="text-[11px] text-primary hover:underline mt-3 inline-flex items-center gap-1">
            {t("hole.see_all_commodities")}
          </Link>
        </div>
      </div>
    </div>
  );
}
