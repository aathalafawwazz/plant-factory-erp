"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/role-gate";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowUpDown, List, LayoutGrid, Thermometer, BarChart3, Download } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import type { EnvironmentalLog } from "@/lib/types/database";
import { useChartTheme } from "@/lib/use-chart-theme";
import { useLang } from "@/lib/i18n";

type SortKey = "date_desc" | "date_asc" | "temp_desc" | "humidity_desc" | "co2_desc" | "vpd_desc" | "ppfd_desc";
type ViewMode = "list" | "grid";

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => headers.map(h => {
    const v = String(r[h] ?? "");
    return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const SORT_LABEL_KEYS: Record<SortKey, string> = {
  date_desc: "env.sort_newest",
  date_asc: "env.sort_oldest",
  temp_desc: "env.sort_temp_high",
  humidity_desc: "env.sort_humidity_high",
  co2_desc: "env.sort_co2_high",
  vpd_desc: "env.sort_vpd_high",
  ppfd_desc: "env.sort_ppfd_high",
};

export default function EnvironmentalLogPage() {
  const supabase = createClient();
  const chartTheme = useChartTheme();
  const { t } = useLang();

  const [logs, setLogs] = useState<EnvironmentalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [chartLocation, setChartLocation] = useState("all");
  const [chartRange, setChartRange] = useState<"1d" | "7d" | "1m" | "1y" | "custom">("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Dialog state
  const [selectedLog, setSelectedLog] = useState<EnvironmentalLog | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTemp, setEditTemp] = useState("");
  const [editHumidity, setEditHumidity] = useState("");
  const [editCo2, setEditCo2] = useState("");
  const [editVpd, setEditVpd] = useState("");
  const [editPpfd, setEditPpfd] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchLogs() {
    const { data } = await supabase
      .from("environmental_logs")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(500);
    setLogs((data ?? []) as EnvironmentalLog[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  // Populate edit fields when selectedLog changes
  useEffect(() => {
    if (selectedLog) {
      setEditTemp(selectedLog.temperature_c?.toString() ?? "");
      setEditHumidity(selectedLog.humidity_pct?.toString() ?? "");
      setEditCo2(selectedLog.co2_ppm?.toString() ?? "");
      setEditVpd(selectedLog.vpd_kpa?.toString() ?? "");
      setEditPpfd(selectedLog.ppfd_umol?.toString() ?? "");
      setEditNotes(selectedLog.notes ?? "");
      setEditMode(false);
    }
  }, [selectedLog]);

  async function handleSave() {
    if (!selectedLog) return;
    setSaving(true);
    const { error } = await supabase
      .from("environmental_logs")
      .update({
        temperature_c: editTemp ? parseFloat(editTemp) : null,
        humidity_pct: editHumidity ? parseFloat(editHumidity) : null,
        co2_ppm: editCo2 ? parseFloat(editCo2) : null,
        vpd_kpa: editVpd ? parseFloat(editVpd) : null,
        ppfd_umol: editPpfd ? parseFloat(editPpfd) : null,
        notes: editNotes || null,
      })
      .eq("id", selectedLog.id);
    setSaving(false);
    if (!error) {
      await fetchLogs();
      setSelectedLog(null);
    }
  }

  const sortedLogs = useMemo(() => {
    const arr = [...logs];
    switch (sortKey) {
      case "date_desc": return arr.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
      case "date_asc": return arr.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      case "temp_desc": return arr.sort((a, b) => (b.temperature_c ?? -Infinity) - (a.temperature_c ?? -Infinity));
      case "humidity_desc": return arr.sort((a, b) => (b.humidity_pct ?? -Infinity) - (a.humidity_pct ?? -Infinity));
      case "co2_desc": return arr.sort((a, b) => (b.co2_ppm ?? -Infinity) - (a.co2_ppm ?? -Infinity));
      case "vpd_desc": return arr.sort((a, b) => (b.vpd_kpa ?? -Infinity) - (a.vpd_kpa ?? -Infinity));
      case "ppfd_desc": return arr.sort((a, b) => (b.ppfd_umol ?? -Infinity) - (a.ppfd_umol ?? -Infinity));
      default: return arr;
    }
  }, [logs, sortKey]);

  const chartData = useMemo(() => {
    const now = new Date();
    let filtered = [...logs];
    if (chartRange === "1d") filtered = filtered.filter(l => new Date(l.recorded_at) > new Date(now.getTime() - 86400000));
    if (chartRange === "7d") filtered = filtered.filter(l => new Date(l.recorded_at) > new Date(now.getTime() - 7 * 86400000));
    if (chartRange === "1m") filtered = filtered.filter(l => new Date(l.recorded_at) > new Date(now.getTime() - 30 * 86400000));
    if (chartRange === "1y") filtered = filtered.filter(l => new Date(l.recorded_at) > new Date(now.getTime() - 365 * 86400000));
    if (chartRange === "custom") {
      if (customFrom) filtered = filtered.filter(l => new Date(l.recorded_at) >= new Date(customFrom));
      if (customTo) filtered = filtered.filter(l => new Date(l.recorded_at) <= new Date(customTo + "T23:59:59"));
    }
    if (chartLocation !== "all") {
      if (chartLocation === "room") {
        filtered = filtered.filter(l => l.rack === null);
      } else {
        const [rack, tier] = chartLocation.split("-");
        filtered = filtered.filter(l => l.rack === rack && l.tier === Number(tier));
      }
    }
    return filtered.reverse().map((l) => ({
      time: new Date(l.recorded_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      suhu: l.temperature_c,
      rh: l.humidity_pct,
      co2: l.co2_ppm,
      vpd: l.vpd_kpa,
      ppfd: l.ppfd_umol,
    }));
  }, [logs, chartRange, customFrom, customTo, chartLocation]);

  function fmtTime(d: string) {
    return new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function fmtLoc(log: EnvironmentalLog) {
    return log.rack ? `${t("cult.rack")} ${log.rack}${log.tier ? ` T${log.tier}` : ""}` : t("env.room");
  }

  function handleExportCSV() {
    const rows = sortedLogs.map(l => ({
      Waktu: fmtTime(l.recorded_at),
      Lokasi: fmtLoc(l),
      Suhu_C: l.temperature_c ?? "",
      RH_pct: l.humidity_pct ?? "",
      CO2_ppm: l.co2_ppm ?? "",
      VPD_kPa: l.vpd_kpa ?? "",
      PPFD: l.ppfd_umol ?? "",
      Catatan: l.notes ?? "",
    }));
    downloadCSV(rows, `log-lingkungan-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-foreground">{t("env.log_env")}</h1>
        <RoleGate roles={["admin", "operator"]} fallback={null}>
          <Link href="/lingkungan/baru">
            <Button className="h-9 bg-primary hover:bg-primary/90 text-white text-[13px]">{t("cult.record_new")}</Button>
          </Link>
        </RoleGate>
      </div>

      {/* Parameter cards */}
      {logs.length > 0 && (() => {
        const latestLog = logs[0];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-4">
            {[
              { label: t("env.temperature"), value: latestLog.temperature_c, unit: "°C", color: "#ef4444" },
              { label: t("env.humidity"), value: latestLog.humidity_pct, unit: "%RH", color: "#638cff" },
              { label: "CO2", value: latestLog.co2_ppm, unit: "ppm", color: "#a78bfa" },
              { label: "VPD", value: latestLog.vpd_kpa, unit: "kPa", color: "#4ade80" },
              { label: "PPFD", value: latestLog.ppfd_umol, unit: "μmol", color: "#22d3ee" },
            ].map((p) => (
              <div key={p.label} className="rounded-lg border border-border/40 bg-card p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: p.color }}>
                  {p.value !== null && p.value !== undefined ? p.value : "···"}
                </p>
                <p className="text-[10px] text-muted-foreground">{p.unit}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Chart with time filters */}
      {logs.length > 0 && (
        <div className="mb-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Time range dropdown */}
            <Select value={chartRange} onValueChange={(v) => v !== null && setChartRange(v as typeof chartRange)}>
              <SelectTrigger className="h-8 bg-secondary border-border/50 text-[11px] w-[120px]">
                <SelectValue>
                  {({ "1d": t("env.range_1d"), "7d": t("env.range_7d"), "1m": t("env.range_1m"), "1y": t("env.range_1y"), custom: t("env.range_custom") } as Record<string, string>)[chartRange]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">{t("env.range_1d")}</SelectItem>
                <SelectItem value="7d">{t("env.range_7d")}</SelectItem>
                <SelectItem value="1m">{t("env.range_1m")}</SelectItem>
                <SelectItem value="1y">{t("env.range_1y")}</SelectItem>
                <SelectItem value="custom">{t("env.range_custom")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom date range — show only when custom */}
            {chartRange === "custom" && (
              <>
                <Input type="date" className="h-8 text-[11px] w-36 bg-secondary border-border/50" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                <Input type="date" className="h-8 text-[11px] w-36 bg-secondary border-border/50" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </>
            )}

            <div className="flex-1" />

            {/* Location dropdown — right aligned */}
            <Select value={chartLocation} onValueChange={(v) => v !== null && setChartLocation(v)}>
              <SelectTrigger className="h-8 bg-secondary border-border/50 text-[11px] w-[130px]">
                <SelectValue>
                  {({ all: t("env.all_locations"), room: t("env.room"), "A-1": `${t("cult.rack")} A T1`, "A-2": `${t("cult.rack")} A T2`, "A-3": `${t("cult.rack")} A T3`, "B-1": `${t("cult.rack")} B T1`, "B-2": `${t("cult.rack")} B T2`, "B-3": `${t("cult.rack")} B T3` } as Record<string, string>)[chartLocation]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("env.all_locations")}</SelectItem>
                <SelectItem value="room">{t("env.room")}</SelectItem>
                <SelectItem value="A-1">{t("cult.rack")} A T1</SelectItem>
                <SelectItem value="A-2">{t("cult.rack")} A T2</SelectItem>
                <SelectItem value="A-3">{t("cult.rack")} A T3</SelectItem>
                <SelectItem value="B-1">{t("cult.rack")} B T1</SelectItem>
                <SelectItem value="B-2">{t("cult.rack")} B T2</SelectItem>
                <SelectItem value="B-3">{t("cult.rack")} B T3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border/40 bg-card p-4">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: chartTheme.axis }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: chartTheme.axis }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: chartTheme.axis }} />
                <Tooltip
                  contentStyle={chartTheme.tooltip}
                  formatter={(v) => [String(v), '']}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line yAxisId="left" type="monotone" dataKey="suhu" name={`${t("env.temperature")} (°C)`} stroke="#f59e0b" dot={false} strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="rh" name="RH (%)" stroke="#638cff" dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="co2" name="CO2 (ppm)" stroke="#4ade80" dot={false} strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="vpd" name="VPD (kPa)" stroke="#a78bfa" dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="ppfd" name="PPFD (μmol)" stroke="#22d3ee" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={sortKey} onValueChange={(v) => v !== null && setSortKey(v as SortKey)}>
            <SelectTrigger className="h-8 bg-secondary border-border/50 text-[12px] w-[180px]">
              <SelectValue>{t(SORT_LABEL_KEYS[sortKey])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_LABEL_KEYS).map(([k, key]) => (
                <SelectItem key={k} value={k}>{t(key)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> {t("env.export_csv")}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="h-8 w-8 p-0" onClick={() => setViewMode("list")}>
            <List className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" className="h-8 w-8 p-0" onClick={() => setViewMode("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {sortedLogs.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">{t("env.no_log")}</CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">{t("common.time")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("env.location")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("env.temperature")} (°C)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">RH (%)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">CO2 (ppm)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">VPD (kPa)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">PPFD (μmol)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("env.equipment")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("common.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLogs.map((log) => (
                <TableRow key={log.id} className="cursor-pointer hover:bg-secondary/30" onClick={() => setSelectedLog(log)}>
                  <TableCell className="whitespace-nowrap text-[13px] text-foreground">{fmtTime(log.recorded_at)}</TableCell>
                  <TableCell className="text-[13px] text-foreground">{fmtLoc(log)}</TableCell>
                  <TableCell className="text-[13px] text-foreground">{log.temperature_c ?? "-"}</TableCell>
                  <TableCell className="text-[13px] text-foreground">{log.humidity_pct ?? "-"}</TableCell>
                  <TableCell className="text-[13px] text-foreground">{log.co2_ppm ?? "-"}</TableCell>
                  <TableCell className="text-[13px] text-foreground">{log.vpd_kpa ?? "-"}</TableCell>
                  <TableCell className="text-[13px] text-foreground">{log.ppfd_umol ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {log.growlight_on !== null && (
                        <Badge variant="secondary" className={`text-[10px] text-white ${log.growlight_on ? "bg-[oklch(0.55_0.17_150)] dark:bg-[oklch(0.45_0.16_150)]" : "bg-secondary"}`}>
                          Lamp {log.growlight_on ? "ON" : "OFF"}
                        </Badge>
                      )}
                      {log.ac_on !== null && (
                        <Badge variant="secondary" className={`text-[10px] text-white ${log.ac_on ? "bg-[oklch(0.55_0.17_150)] dark:bg-[oklch(0.45_0.16_150)]" : "bg-secondary"}`}>
                          AC {log.ac_on ? "ON" : "OFF"}
                        </Badge>
                      )}
                      {log.fan_on !== null && (
                        <Badge variant="secondary" className={`text-[10px] text-white ${log.fan_on ? "bg-[oklch(0.55_0.17_150)] dark:bg-[oklch(0.45_0.16_150)]" : "bg-secondary"}`}>
                          Fan {log.fan_on ? "ON" : "OFF"}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground max-w-[150px] truncate">
                    {log.notes ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Tile view */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedLogs.map((log) => (
            <div key={log.id} className="rounded-lg border border-border/40 bg-card p-4 space-y-3 cursor-pointer hover:bg-secondary/30" onClick={() => setSelectedLog(log)}>
              {/* Row 1: Date + Location */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{fmtTime(log.recorded_at)}</span>
                <span className="text-[12px] font-medium bg-secondary/50 px-2 py-0.5 rounded">{fmtLoc(log)}</span>
              </div>

              {/* Row 2: All parameters in equal grid */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase">{t("env.temperature")}</span>
                  <span className="text-lg font-semibold text-foreground">{log.temperature_c ?? "-"}<span className="text-[10px] text-muted-foreground ml-0.5">°C</span></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase">RH</span>
                  <span className="text-lg font-semibold text-foreground">{log.humidity_pct ?? "-"}<span className="text-[10px] text-muted-foreground ml-0.5">%</span></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase">CO2</span>
                  <span className="text-lg font-semibold text-foreground">{log.co2_ppm ?? "-"}<span className="text-[10px] text-muted-foreground ml-0.5">ppm</span></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase">VPD</span>
                  <span className="text-lg font-semibold text-foreground">{log.vpd_kpa ?? "-"}<span className="text-[10px] text-muted-foreground ml-0.5">kPa</span></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase">PPFD</span>
                  <span className="text-lg font-semibold text-foreground">{log.ppfd_umol ?? "-"}<span className="text-[10px] text-muted-foreground ml-0.5">μmol</span></span>
                </div>
              </div>

              {/* Row 3: Equipment badges */}
              <div className="flex gap-1 flex-wrap">
                {log.growlight_on !== null && (
                  <Badge variant="secondary" className={`text-[10px] text-white ${log.growlight_on ? "bg-[oklch(0.55_0.17_150)] dark:bg-[oklch(0.45_0.16_150)]" : "bg-secondary"}`}>
                    Lamp {log.growlight_on ? "ON" : "OFF"}
                  </Badge>
                )}
                {log.ac_on !== null && (
                  <Badge variant="secondary" className={`text-[10px] text-white ${log.ac_on ? "bg-[oklch(0.55_0.17_150)] dark:bg-[oklch(0.45_0.16_150)]" : "bg-secondary"}`}>
                    AC {log.ac_on ? "ON" : "OFF"}
                  </Badge>
                )}
                {log.fan_on !== null && (
                  <Badge variant="secondary" className={`text-[10px] text-white ${log.fan_on ? "bg-[oklch(0.55_0.17_150)] dark:bg-[oklch(0.45_0.16_150)]" : "bg-secondary"}`}>
                    Fan {log.fan_on ? "ON" : "OFF"}
                  </Badge>
                )}
              </div>

              {/* Row 4: Notes (conditional) */}
              {log.notes && (
                <p className="text-[11px] text-muted-foreground italic">{log.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail / Edit Dialog */}
      <Dialog open={selectedLog !== null} onOpenChange={(v) => { if (!v) setSelectedLog(null); }}>
        <DialogContent showCloseButton={true} className="sm:max-w-[450px] bg-card border-border/50 p-0 gap-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{editMode ? t("env.edit_log") : t("env.detail_log")}</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="p-4 space-y-3">
              {/* Time & Location */}
              <div className="space-y-1">
                <p className="text-[13px] text-muted-foreground">{fmtTime(selectedLog.recorded_at)}</p>
                <p className="text-[13px] font-medium text-foreground">{fmtLoc(selectedLog)}</p>
              </div>

              <Separator />

              {editMode ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[13px]">{t("env.temperature")} (°C)</Label>
                      <Input className="h-9 bg-secondary border-border/50 text-[12px]" value={editTemp} onChange={(e) => setEditTemp(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[13px]">{t("env.humidity")} (%)</Label>
                      <Input className="h-9 bg-secondary border-border/50 text-[12px]" value={editHumidity} onChange={(e) => setEditHumidity(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[13px]">CO2 (ppm)</Label>
                      <Input className="h-9 bg-secondary border-border/50 text-[12px]" value={editCo2} onChange={(e) => setEditCo2(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[13px]">VPD (kPa)</Label>
                      <Input className="h-9 bg-secondary border-border/50 text-[12px]" value={editVpd} onChange={(e) => setEditVpd(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[13px]">PPFD (μmol)</Label>
                      <Input className="h-9 bg-secondary border-border/50 text-[12px]" value={editPpfd} onChange={(e) => setEditPpfd(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[13px]">{t("common.notes")}</Label>
                    <Input className="h-9 bg-secondary border-border/50 text-[12px]" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button className="h-9 bg-primary hover:bg-primary/90 text-white text-[13px] flex-1" disabled={saving} onClick={handleSave}>
                      {saving ? t("common.saving") : t("common.save")}
                    </Button>
                    <Button variant="ghost" className="h-9 text-[13px]" onClick={() => setEditMode(false)}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[13px] text-muted-foreground">{t("env.temperature")}</p>
                      <p className="text-[13px] text-foreground font-medium">{selectedLog.temperature_c ?? "-"} °C</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">{t("env.humidity")}</p>
                      <p className="text-[13px] text-foreground font-medium">{selectedLog.humidity_pct ?? "-"} %</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[13px] text-muted-foreground">CO2</p>
                      <p className="text-[13px] text-foreground font-medium">{selectedLog.co2_ppm ?? "-"} ppm</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">VPD</p>
                      <p className="text-[13px] text-foreground font-medium">{selectedLog.vpd_kpa ?? "-"} kPa</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">PPFD</p>
                      <p className="text-[13px] text-foreground font-medium">{selectedLog.ppfd_umol ?? "-"} μmol</p>
                    </div>
                  </div>

                  {/* Equipment */}
                  <div className="flex gap-1 flex-wrap">
                    {selectedLog.growlight_on !== null && (
                      <Badge variant="secondary" className={`text-[10px] text-white ${selectedLog.growlight_on ? "bg-[oklch(0.55_0.17_150)] dark:bg-[oklch(0.45_0.16_150)]" : "bg-secondary"}`}>
                        Lamp {selectedLog.growlight_on ? "ON" : "OFF"}
                      </Badge>
                    )}
                    {selectedLog.ac_on !== null && (
                      <Badge variant="secondary" className={`text-[10px] text-white ${selectedLog.ac_on ? "bg-[oklch(0.55_0.17_150)] dark:bg-[oklch(0.45_0.16_150)]" : "bg-secondary"}`}>
                        AC {selectedLog.ac_on ? "ON" : "OFF"}
                      </Badge>
                    )}
                    {selectedLog.fan_on !== null && (
                      <Badge variant="secondary" className={`text-[10px] text-white ${selectedLog.fan_on ? "bg-[oklch(0.55_0.17_150)] dark:bg-[oklch(0.45_0.16_150)]" : "bg-secondary"}`}>
                        Fan {selectedLog.fan_on ? "ON" : "OFF"}
                      </Badge>
                    )}
                  </div>

                  {/* Notes */}
                  {selectedLog.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-[13px] text-muted-foreground">{t("common.notes")}</p>
                        <p className="text-[13px] text-foreground">{selectedLog.notes}</p>
                      </div>
                    </>
                  )}

                  <RoleGate roles={["admin", "operator"]} fallback={null}>
                    <Button variant="outline" className="h-9 text-[13px] w-full" onClick={() => setEditMode(true)}>
                      {t("common.edit")}
                    </Button>
                  </RoleGate>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
