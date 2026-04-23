"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

export type Period = "today" | "week" | "month";

export interface PeriodData {
  today: { value: number; meta?: string };
  week: { value: number; meta?: string };
  month: { value: number; meta?: string };
}

interface Props {
  title: string;
  icon?: ReactNode;
  data: PeriodData;
  accent?: "primary" | "emerald" | "amber" | "rose" | "default";
  prefix?: string;      // e.g. "Rp "
  suffix?: string;      // e.g. " kg"
  format?: "number" | "currency" | "decimal";
  href?: string;
  footer?: ReactNode;
}

const PERIOD_KEY: Record<Period, string> = {
  today: "dpc.today",
  week: "dpc.week",
  month: "dpc.month",
};

const ACCENT_CLASS = {
  primary: "text-primary",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  default: "text-foreground",
};

export function DashboardPeriodCard({
  title, icon, data, accent = "default", prefix = "", suffix = "", format = "number", href, footer,
}: Props) {
  const { t } = useLang();
  const [period, setPeriod] = useState<Period>("month");
  const current = data[period];
  const formatted =
    format === "decimal"
      ? current.value.toLocaleString("id-ID", { maximumFractionDigits: 2 })
      : current.value.toLocaleString("id-ID");

  return (
    <div className="rounded-lg border border-border/40 bg-card p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">{title}</span>
        </div>
        <div className="inline-flex rounded-md bg-secondary/50 p-0.5 shrink-0">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "px-2 py-0.5 text-[10px] rounded transition-colors",
                period === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(PERIOD_KEY[p])}
            </button>
          ))}
        </div>
      </div>
      <p className={cn("text-xl font-semibold", ACCENT_CLASS[accent])}>
        {prefix}
        {formatted}
        {suffix && <span className="text-[13px] text-muted-foreground ml-1">{suffix}</span>}
      </p>
      {current.meta && (
        <p className="text-[11px] text-muted-foreground mt-0.5">{current.meta}</p>
      )}
      {footer}
    </div>
  );
}
