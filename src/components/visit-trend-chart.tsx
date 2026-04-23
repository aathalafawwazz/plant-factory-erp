"use client";

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { useChartTheme } from "@/lib/use-chart-theme";
import { useLang } from "@/lib/i18n";

export interface MonthlyTrendData {
  label: string;       // "Apr", "Mei", ...
  count: number;       // jumlah kunjungan
  visitors: number;    // total tamu
}

interface Props {
  data: MonthlyTrendData[];
}

export function VisitTrendChart({ data }: Props) {
  const c = useChartTheme();
  const { t } = useLang();
  const hasData = data.some((d) => d.count > 0 || d.visitors > 0);
  const totalVisitors = data.reduce((s, d) => s + d.visitors, 0);
  const totalVisits = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-lg border border-border/40 bg-card">
      <div className="px-4 py-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            {t("vtc.title")}
          </h3>
        </div>
        {hasData && (
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-primary/70" />
              {t("vtc.visits")}
              <span className="text-foreground font-medium tabular-nums ml-0.5">{totalVisits}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-3 bg-amber-400" />
              {t("vtc.guests")}
              <span className="text-foreground font-medium tabular-nums ml-0.5">{totalVisitors}</span>
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        {!hasData ? (
          <p className="text-[12px] text-muted-foreground text-center py-8">
            {t("vtc.no_data")}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="visitBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="oklch(0.7 0.16 175)" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="oklch(0.7 0.16 175)" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: c.axis }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "oklch(0.7 0.16 175)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={26}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: "#fbbf24" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                cursor={c.cursor}
                contentStyle={{ ...c.tooltip, padding: "6px 10px" }}
                labelStyle={c.tooltipLabel}
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : Number(value ?? 0);
                  const n = String(name ?? "");
                  if (n === "count")    return [`${v} ${t("vtc.visits_unit")}`, t("vtc.total")];
                  if (n === "visitors") return [`${v} ${t("vtc.guests_unit")}`, t("vtc.people")];
                  return [v, n];
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="count"
                fill="url(#visitBarGrad)"
                radius={[4, 4, 0, 0]}
                barSize={18}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="visitors"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ fill: "#fbbf24", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
