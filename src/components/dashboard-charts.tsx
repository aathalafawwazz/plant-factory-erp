"use client";
import { ResponsiveContainer, AreaChart, Area, Tooltip, PieChart, Pie, Cell, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface SparklineChartProps {
  data: { value: number }[];
  color: string;
  unit: string;
}

export function SparklineChart({ data, color, unit }: SparklineChartProps) {
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
          contentStyle={{ backgroundColor: '#161b22', border: '1px solid #2a2f3a', borderRadius: '8px', fontSize: '12px', color: '#f7f8f8' }}
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
  const data = [
    { name: "Dipanen", value: harvested },
    { name: "Aktif", value: active },
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

const darkTooltipStyle = {
  backgroundColor: "#161b22",
  border: "1px solid #2a2f3a",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f7f8f8",
};

export function EnvironmentChart({ data }: { data: { time: string; suhu: number | null; rh: number | null; co2: number | null; vpd: number | null; ppfd: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid stroke="#2a2f3a" strokeDasharray="3 3" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={darkTooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line yAxisId="left" type="monotone" dataKey="suhu" name="Suhu (°C)" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
        <Line yAxisId="left" type="monotone" dataKey="rh" name="RH (%)" stroke="#638cff" strokeWidth={2} dot={false} connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="co2" name="CO2 (ppm)" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls />
        <Line yAxisId="left" type="monotone" dataKey="vpd" name="VPD (kPa)" stroke="#4ade80" strokeWidth={1.5} dot={false} connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="ppfd" name="PPFD (umol)" stroke="#22d3ee" strokeWidth={1.5} dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function NutrientChart({ data }: { data: { time: string; ec: number | null; ph: number | null; volume: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid stroke="#2a2f3a" strokeDasharray="3 3" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={darkTooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="right" dataKey="volume" name="Volume (L)" fill="#638cff" opacity={0.3} />
        <Line yAxisId="left" type="monotone" dataKey="ec" name="EC" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
        <Line yAxisId="left" type="monotone" dataKey="ph" name="pH" stroke="#4ade80" strokeWidth={2} dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
