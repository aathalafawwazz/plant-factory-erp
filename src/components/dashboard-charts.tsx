"use client";
import { ResponsiveContainer, AreaChart, Area, Tooltip, PieChart, Pie, Cell, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useChartTheme } from "@/lib/use-chart-theme";
import { useLang } from "@/lib/i18n";

interface SparklineChartProps {
  data: { value: number }[];
  color: string;
  unit: string;
}

export function SparklineChart({ data, color, unit }: SparklineChartProps) {
  const c = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={50}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={c.tooltip}
          formatter={(v) => [`${v}${unit}`, '']}
          labelFormatter={() => ''}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${color.replace('#','')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface HarvestDonutProps {
  harvested: number;
  active: number;
  pct: number;
}

export function HarvestDonutChart({ harvested, active, pct }: HarvestDonutProps) {
  const { t } = useLang();
  const data = [
    { name: t("dc.harvested"), value: harvested },
    { name: t("dc.active"), value: active },
  ];
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={120}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={50} dataKey="value" strokeWidth={0}>
            <Cell fill="#2dd4bf" />
            <Cell fill="#1e2430" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <span className="text-xl font-bold text-foreground">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

export function EnvironmentOverviewChart({ data }: { data: { label: string; value: number | null; unit: string; color: string }[] }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {data.map((d) => (
        <div key={d.label} className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">{d.label}</p>
          <p className="text-lg font-semibold" style={{ color: d.color }}>{d.value ?? "-"}</p>
          <p className="text-[10px] text-muted-foreground">{d.unit}</p>
        </div>
      ))}
    </div>
  );
}

// Kept as backwards-compat fallback if any consumer still references it elsewhere.
// Prefer `useChartTheme().tooltip` for theme-aware value.
const darkTooltipStyle = {
  backgroundColor: "#161b22",
  border: "1px solid #2a2f3a",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f7f8f8",
};
void darkTooltipStyle;

type LegendItem = { label: string; color: string; shape?: "line" | "rect" };

function makeLegend(items: LegendItem[]) {
  return function CustomLegend() {
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "12px",
          fontSize: 11,
          paddingTop: 6,
        }}
      >
        {items.map((it) => (
          <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#c9cdd4" }}>
            {it.shape === "rect" ? (
              <span style={{ width: 12, height: 10, backgroundColor: it.color, opacity: 0.6, borderRadius: 2, display: "inline-block" }} />
            ) : (
              <span style={{ width: 14, height: 2, backgroundColor: it.color, display: "inline-block", borderRadius: 2 }} />
            )}
            <span>{it.label}</span>
          </span>
        ))}
      </div>
    );
  };
}

export function EnvironmentChart({ data }: { data: { time: string; suhu: number | null; rh: number | null; co2: number | null; vpd: number | null; ppfd: number | null }[] }) {
  const c = useChartTheme();
  const { t } = useLang();
  const labels = {
    temp: t("dc.temp_c"),
    rh: t("dc.rh_pct"),
    vpd: t("dc.vpd_kpa"),
    co2: t("dc.co2_ppm"),
    ppfd: t("dc.ppfd"),
  };
  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={c.tooltip} />
        <Legend
          content={makeLegend([
            { label: labels.temp, color: "#ef4444" },
            { label: labels.rh, color: "#638cff" },
            { label: labels.vpd, color: "#4ade80" },
            { label: labels.co2, color: "#a78bfa" },
            { label: labels.ppfd, color: "#22d3ee" },
          ])}
        />
        <Line yAxisId="left" type="monotone" dataKey="suhu" name={labels.temp} stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
        <Line yAxisId="left" type="monotone" dataKey="rh" name={labels.rh} stroke="#638cff" strokeWidth={2} dot={false} connectNulls />
        <Line yAxisId="left" type="monotone" dataKey="vpd" name={labels.vpd} stroke="#4ade80" strokeWidth={1.5} dot={false} connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="co2" name={labels.co2} stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="ppfd" name={labels.ppfd} stroke="#22d3ee" strokeWidth={1.5} dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function NutrientChart({ data }: { data: { time: string; ec: number | null; ph: number | null; volume: number | null }[] }) {
  const c = useChartTheme();
  const { t } = useLang();
  const labels = {
    ec: t("dc.ec"),
    ph: t("dc.ph"),
    volume: t("dc.volume_l"),
  };
  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={c.tooltip} />
        <Legend
          content={makeLegend([
            { label: labels.ec, color: "#f59e0b" },
            { label: labels.ph, color: "#4ade80" },
            { label: labels.volume, color: "#638cff", shape: "rect" },
          ])}
        />
        <Line yAxisId="left" type="monotone" dataKey="ec" name={labels.ec} stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
        <Line yAxisId="left" type="monotone" dataKey="ph" name={labels.ph} stroke="#4ade80" strokeWidth={2} dot={false} connectNulls />
        <Bar yAxisId="right" dataKey="volume" name={labels.volume} fill="#638cff" opacity={0.3} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
