"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { ArrowUpDown, List, LayoutGrid, Droplets, Pencil, BarChart3, Download } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import type { NutrientLog } from "@/lib/types/database";
import { useChartTheme } from "@/lib/use-chart-theme";
import { useLang } from "@/lib/i18n";

type SortKey = "date_desc" | "date_asc" | "volume_desc" | "ec_desc" | "ph_desc";
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
  volume_desc: "env.sort_volume_high",
  ec_desc: "env.sort_ec_high",
  ph_desc: "env.sort_ph_high",
};

export default function NutrientLogPage() {
  const supabase = createClient();
  const chartTheme = useChartTheme();
  const { t } = useLang();

  const [logs, setLogs] = useState<NutrientLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [chartRack, setChartRack] = useState("all");
  const [chartRange, setChartRange] = useState<"1d" | "7d" | "1m" | "1y" | "custom">("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Dialog state
  const [selectedLog, setSelectedLog] = useState<NutrientLog | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editFormula, setEditFormula] = useState("");
  const [editVolume, setEditVolume] = useState("");
  const [editEc, setEditEc] = useState("");
  const [editPh, setEditPh] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchLogs() {
    const { data } = await supabase
      .from("nutrient_logs")
      .select("*")
      .order("mixed_at", { ascending: false })
      .limit(500);
    setLogs((data ?? []) as NutrientLog[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  // Populate edit fields when selectedLog changes
  useEffect(() => {
    if (selectedLog) {
      setEditFormula(selectedLog.formula_name ?? "");
      setEditVolume(selectedLog.volume_liters?.toString() ?? "");
      setEditEc(selectedLog.ec_actual?.toString() ?? "");
      setEditPh(selectedLog.ph_actual?.toString() ?? "");
      setEditNotes(selectedLog.notes ?? "");
      setEditMode(false);
    }
  }, [selectedLog]);

  async function handleSave() {
    if (!selectedLog) return;
    setSaving(true);
    const { error } = await supabase
      .from("nutrient_logs")
      .update({
        formula_name: editFormula || null,
        volume_liters: editVolume ? parseFloat(editVolume) : null,
        ec_actual: editEc ? parseFloat(editEc) : null,
        ph_actual: editPh ? parseFloat(editPh) : null,
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
      case "date_desc": return arr.sort((a, b) => b.mixed_at.localeCompare(a.mixed_at));
      case "date_asc": return arr.sort((a, b) => a.mixed_at.localeCompare(b.mixed_at));
      case "volume_desc": return arr.sort((a, b) => (b.volume_liters ?? -Infinity) - (a.volume_liters ?? -Infinity));
      case "ec_desc": return arr.sort((a, b) => (b.ec_actual ?? -Infinity) - (a.ec_actual ?? -Infinity));
      case "ph_desc": return arr.sort((a, b) => (b.ph_actual ?? -Infinity) - (a.ph_actual ?? -Infinity));
      default: return arr;
    }
  }, [logs, sortKey]);

  const chartData = useMemo(() => {
    const now = new Date();
    let filtered = [...logs];
    if (chartRange === "1d") filtered = filtered.filter(l => new Date(l.mixed_at) > new Date(now.getTime() - 86400000));
    if (chartRange === "7d") filtered = filtered.filter(l => new Date(l.mixed_at) > new Date(now.getTime() - 7 * 86400000));
    if (chartRange === "1m") filtered = filtered.filter(l => new Date(l.mixed_at) > new Date(now.getTime() - 30 * 86400000));
    if (chartRange === "1y") filtered = filtered.filter(l => new Date(l.mixed_at) > new Date(now.getTime() - 365 * 86400000));
    if (chartRange === "custom") {
      if (customFrom) filtered = filtered.filter(l => new Date(l.mixed_at) >= new Date(customFrom));
      if (customTo) filtered = filtered.filter(l => new Date(l.mixed_at) <= new Date(customTo + "T23:59:59"));
    }
    return filtered.reverse().map((l) => ({
      time: new Date(l.mixed_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      ec: l.ec_actual,
      ph: l.ph_actual,
      volume: l.volume_liters,
    }));
  }, [logs, chartRange, customFrom, customTo]);

  function fmtTime(d: string) {
    return new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function handleExportCSV() {
    const rows = sortedLogs.map(l => ({
      Tanggal: fmtTime(l.mixed_at),
      Formula: l.formula_name ?? "",
      Volume_L: l.volume_liters ?? "",
      EC: l.ec_actual ?? "",
      pH: l.ph_actual ?? "",
      Catatan: l.notes ?? "",
    }));
    downloadCSV(rows, `log-nutrisi-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-foreground">{t("nut.log_nut")}</h1>
        <Link href="/nutrisi/baru">
          <Button className="h-9 bg-primary hover:bg-primary/90 text-white text-[13px]">{t("cult.record_new")}</Button>
        </Link>
      </div>

      {/* Parameter cards */}
      {logs.length > 0 && (() => {
        const latestLog = logs[0];
        return (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "EC", value: latestLog.ec_actual, unit: "mS/cm", color: "#f59e0b" },
              { label: "pH", value: latestLog.ph_actual, unit: "", color: "#4ade80" },
              { label: t("nut.volume"), value: latestLog.volume_liters, unit: "L", color: "#638cff" },
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

            {chartRange === "custom" && (
              <>
                <Input type="date" className="h-8 text-[11px] w-36 bg-secondary border-border/50" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                <Input type="date" className="h-8 text-[11px] w-36 bg-secondary border-border/50" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </>
            )}

            <div className="flex-1" />

            {/* Rack dropdown — right aligned */}
            {/* TODO: filter by rack when column added to DB */}
            <Select value={chartRack} onValueChange={(v) => v !== null && setChartRack(v)}>
              <SelectTrigger className="h-8 bg-secondary border-border/50 text-[11px] w-[110px]">
                <SelectValue>
                  {({ all: t("env.all_racks"), A: `${t("cult.rack")} A`, B: `${t("cult.rack")} B` } as Record<string, string>)[chartRack]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("env.all_racks")}</SelectItem>
                <SelectItem value="A">{t("cult.rack")} A</SelectItem>
                <SelectItem value="B">{t("cult.rack")} B</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border/40 bg-card p-4">
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: chartTheme.axis }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: chartTheme.axis }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: chartTheme.axis }} />
                <Tooltip
                  contentStyle={chartTheme.tooltip}
                  formatter={(v) => [String(v), '']}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar yAxisId="right" dataKey="volume" name={`${t("nut.volume")} (L)`} fill="#638cff" opacity={0.3} />
                <Line yAxisId="left" type="monotone" dataKey="ec" name="EC" stroke="#f59e0b" dot={false} strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="ph" name="pH" stroke="#4ade80" dot={false} strokeWidth={2} />
              </ComposedChart>
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
          <CardContent className="py-12 text-center text-muted-foreground">{t("env.no_nut_log")}</CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">{t("common.date")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("env.formula")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("nut.volume")} (L)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">EC</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">pH</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("cult.rack")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("common.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLogs.map((log) => (
                <TableRow key={log.id} className="cursor-pointer hover:bg-secondary/30" onClick={() => setSelectedLog(log)}>
                  <TableCell className="whitespace-nowrap text-[13px]">
                    {fmtTime(log.mixed_at)}
                  </TableCell>
                  <TableCell className="text-[13px] font-medium">{log.formula_name ?? "-"}</TableCell>
                  <TableCell className="text-[13px]">{log.volume_liters ?? "-"}</TableCell>
                  <TableCell className="text-[13px]">{log.ec_actual ?? "-"}</TableCell>
                  <TableCell className="text-[13px]">{log.ph_actual ?? "-"}</TableCell>
                  <TableCell className="text-[13px]">{/* TODO: DB column */ "A"}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground max-w-[200px] truncate">
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
              {/* Row 1: Date + Formula */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{fmtTime(log.mixed_at)}</span>
                <span className="text-[13px] font-medium text-foreground">{log.formula_name ?? "-"}</span>
              </div>

              {/* Row 2: Parameters in equal 3-col grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase">{t("nut.volume")}</span>
                  <span className="text-xl font-semibold text-foreground">{log.volume_liters ?? "-"}<span className="text-[10px] text-muted-foreground ml-0.5">L</span></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase">EC</span>
                  <span className="text-xl font-semibold text-foreground">{log.ec_actual ?? "-"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase">pH</span>
                  <span className="text-xl font-semibold text-foreground">{log.ph_actual ?? "-"}</span>
                </div>
              </div>

              {/* Row 3: Notes (conditional) */}
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
              {/* Time */}
              <div className="space-y-1">
                <p className="text-[13px] text-muted-foreground">{fmtTime(selectedLog.mixed_at)}</p>
                <p className="text-[13px] font-medium text-foreground">{selectedLog.formula_name ?? "-"}</p>
              </div>

              <Separator />

              {editMode ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[13px] text-muted-foreground">{t("env.formula")}</Label>
                    <Input className="h-9 bg-secondary border-border/50 text-[12px]" value={editFormula} onChange={(e) => setEditFormula(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[13px] text-muted-foreground">{t("nut.volume")} (L)</Label>
                      <Input className="h-9 bg-secondary border-border/50 text-[12px]" value={editVolume} onChange={(e) => setEditVolume(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[13px] text-muted-foreground">EC</Label>
                      <Input className="h-9 bg-secondary border-border/50 text-[12px]" value={editEc} onChange={(e) => setEditEc(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[13px] text-muted-foreground">pH</Label>
                      <Input className="h-9 bg-secondary border-border/50 text-[12px]" value={editPh} onChange={(e) => setEditPh(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[13px] text-muted-foreground">{t("common.notes")}</Label>
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
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[13px] text-muted-foreground">{t("nut.volume")}</p>
                      <p className="text-[13px] text-foreground font-medium">{selectedLog.volume_liters ?? "-"} L</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">EC</p>
                      <p className="text-[13px] text-foreground font-medium">{selectedLog.ec_actual ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground">pH</p>
                      <p className="text-[13px] text-foreground font-medium">{selectedLog.ph_actual ?? "-"}</p>
                    </div>
                  </div>

                  {/* Target values if present */}
                  {(selectedLog.ec_target || selectedLog.ph_target) && (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedLog.ec_target && (
                        <div>
                          <p className="text-[13px] text-muted-foreground">{t("nut.ec_target")}</p>
                          <p className="text-[13px] text-foreground font-medium">{selectedLog.ec_target}</p>
                        </div>
                      )}
                      {selectedLog.ph_target && (
                        <div>
                          <p className="text-[13px] text-muted-foreground">{t("nut.ph_target")}</p>
                          <p className="text-[13px] text-foreground font-medium">{selectedLog.ph_target}</p>
                        </div>
                      )}
                    </div>
                  )}

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

                  <Button variant="outline" className="h-9 text-[13px] w-full" onClick={() => setEditMode(true)}>
                    {t("common.edit")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
