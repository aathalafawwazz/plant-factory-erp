"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Hook yang me-return palette warna untuk Recharts yang adaptive terhadap
 * theme (dark/light). Gunakan ini sebagai pengganti hex literal di chart.
 *
 * Example:
 *   const c = useChartTheme();
 *   <CartesianGrid stroke={c.grid} />
 *   <XAxis tick={{ fill: c.axis }} />
 *   <Tooltip contentStyle={c.tooltip} />
 */
export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Saat SSR / first paint, default ke dark (agar tidak flicker terang dulu).
  const isLight = mounted && resolvedTheme === "light";

  return {
    // Axis labels & tick text
    axis: isLight ? "#64748b" : "#8a8f98",
    // Grid lines
    grid: isLight ? "#e2e8f0" : "#2a2f3a",
    // Tooltip styling
    tooltip: {
      backgroundColor: isLight ? "#ffffff" : "#161b22",
      border: `1px solid ${isLight ? "#e2e8f0" : "#2a2f3a"}`,
      borderRadius: "8px",
      fontSize: "12px",
      color: isLight ? "#0f172a" : "#f7f8f8",
      boxShadow: isLight
        ? "0 4px 12px rgba(0,0,0,0.08)"
        : "0 4px 12px rgba(0,0,0,0.25)",
    } as const,
    tooltipLabel: { color: isLight ? "#64748b" : "#8a8f98", marginBottom: 2 } as const,
    // Cursor highlight saat hover
    cursor: {
      fill: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
    } as const,
    // Series colors — tetap sama untuk konsistensi brand, bisa diadjust nanti
    series: {
      primary: "oklch(0.7 0.16 175)",     // teal
      accent: "#fbbf24",                   // amber
      info: "#638cff",                     // blue
      success: "#4ade80",                  // emerald
      warning: "#f59e0b",                  // amber deep
      danger: "#f87171",                   // red
      purple: "#a78bfa",                   // violet
      cyan: "#22d3ee",
    } as const,
    isLight,
  };
}
