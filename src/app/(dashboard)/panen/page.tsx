"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUpDown, List, LayoutGrid, Scissors, Camera, X, ChevronDown } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { VISUAL_CONDITIONS, POST_HARVEST_HANDLING, QUALITY_GRADES } from "@/lib/constants";
import { useChartTheme } from "@/lib/use-chart-theme";
import { useRef } from "react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { translateCommodity, formatDateLocale } from "@/lib/translate-helpers";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HarvestEntry {
  id: number;
  hole_canonical: string;
  rack: string;
  crop_name: string;
  batch_code: string;
  planted_at: string;
  harvested_at: string;
  expected_harvest_at: string | null;
  harvest_weight_g: number | null;
  quality_grade: string | null;
  visual_condition: string | null;
  post_harvest_handling: string | null;
  harvest_notes: string | null;
  early_harvest_reason: string | null;
  grow_duration_days: number;
  actual_days: number;
}

type SortKey = "date_desc" | "date_asc" | "weight_desc" | "weight_asc" | "crop" | "condition" | "handling";
type ViewMode = "list" | "grid";

const SORT_LABEL_KEYS: Record<SortKey, string> = {
  date_desc: "harvest.sort_newest",
  date_asc: "harvest.sort_oldest",
  weight_desc: "harvest.sort_weight_desc",
  weight_asc: "harvest.sort_weight_asc",
  crop: "harvest.sort_crop",
  condition: "harvest.sort_condition",
  handling: "harvest.sort_handling",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string, lang: "id" | "en" = "id") {
  return formatDateLocale(iso, lang, { day: "numeric", month: "short", year: "numeric" });
}

function formatWeight(g: number | null): string {
  if (g === null) return "-";
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${g} g`;
}

function gradeColor(grade: string | null) {
  switch (grade) {
    case "A":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "B":
      return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    case "C":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    default:
      return "bg-secondary text-muted-foreground border-border/30";
  }
}

function conditionLabel(value: string | null, t: (k: string) => string) {
  if (!value) return "-";
  const c = VISUAL_CONDITIONS.find((v) => v.value === value);
  return c ? t(c.labelKey) : value;
}

function handlingLabel(value: string | null, t: (k: string) => string) {
  if (!value) return "-";
  const h = POST_HARVEST_HANDLING.find((x) => x.value === value);
  return h ? t(h.labelKey) : value;
}

function daysDiffLabel(actual: number, target: number, t: (k: string) => string) {
  const diff = actual - target;
  if (diff === 0) return { text: t("cult.exact"), color: "text-emerald-400" };
  if (diff < 0)
    return { text: `${Math.abs(diff)} ${t("unit.day")}`, color: "text-emerald-400" };
  return { text: `+${diff} ${t("unit.day")}`, color: "text-amber-400" };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function HarvestPage() {
  const supabase = createClient();
  const chartTheme = useChartTheme();
  const { t, lang } = useLang();

  const [entries, setEntries] = useState<HarvestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedEntry, setSelectedEntry] = useState<HarvestEntry | null>(null);

  // Ready to harvest
  const [readyToHarvest, setReadyToHarvest] = useState<any[]>([]);
  const [showReadySection, setShowReadySection] = useState(true);

  // Harvest form state
  const [harvestTarget, setHarvestTarget] = useState<any | null>(null);
  const [hWeight, setHWeight] = useState("");
  const [hGrade, setHGrade] = useState("");
  const [hVisual, setHVisual] = useState("");
  const [hHandling, setHHandling] = useState("");
  const [hNotes, setHNotes] = useState("");
  const [hEarlyReason, setHEarlyReason] = useState("");
  const [hPhotos, setHPhotos] = useState<{ dataUrl: string; timestamp: Date }[]>([]);
  const [hErrors, setHErrors] = useState<Record<string, string>>({});
  const [hSaving, setHSaving] = useState(false);
  const hFileRef = useRef<HTMLInputElement>(null);

  function resetHarvestForm() {
    setHarvestTarget(null);
    setHWeight(""); setHGrade(""); setHVisual(""); setHHandling("");
    setHNotes(""); setHEarlyReason(""); setHPhotos([]); setHErrors({});
  }

  function handleHarvestPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setHPhotos((prev) => [...prev, { dataUrl: reader.result as string, timestamp: new Date() }]);
      setHErrors((p) => ({ ...p, photos: "" }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function submitHarvest() {
    const errs: Record<string, string> = {};
    if (!hWeight) errs.weight = t("form.required");
    if (!hGrade) errs.grade = t("form.required");
    if (hPhotos.length === 0) errs.photos = t("cult.min_one_photo");
    if (Object.keys(errs).length > 0) { setHErrors(errs); return; }

    setHSaving(true);
    await supabase.from("planting_cycles").update({
      status: "harvested",
      harvested_at: new Date().toISOString(),
      harvest_weight_g: Number(hWeight),
      quality_grade: hGrade,
      visual_condition: hVisual || null,
      post_harvest_handling: hHandling || null,
      harvest_notes: hNotes || null,
      early_harvest_reason: hEarlyReason || null,
    }).eq("id", harvestTarget.id);

    await supabase.from("holes").update({ status: "harvested" as any, current_cycle_id: null }).eq("id", harvestTarget.hole_id);

    toast.success(`${t("cult.harvest")} ${harvestTarget.holes?.canonical_id} ${t("cult.harvest_recorded")}`);
    resetHarvestForm();
    setHSaving(false);
    loadData();
  }

  /* ---------- Load data ---------- */
  async function loadData() {
    const [harvestedRes, readyRes] = await Promise.all([
      supabase
        .from("planting_cycles")
        .select("*, holes!planting_cycles_hole_id_fkey(canonical_id, rack, tier, lane, hole_number), crop_catalog(name_id, grow_duration_days), batches(batch_code)")
        .eq("status", "harvested")
        .order("harvested_at", { ascending: false })
        .limit(100),
      supabase
        .from("planting_cycles")
        .select("*, holes!planting_cycles_hole_id_fkey(canonical_id, rack), crop_catalog(name_id, grow_duration_days), batches(batch_code)")
        .eq("status", "ready_harvest")
        .order("expected_harvest_at", { ascending: true }),
    ]);

    const data = harvestedRes.data;
    setReadyToHarvest(readyRes.data ?? []);

      if (data) {
        const mapped: HarvestEntry[] = data.map((row: any) => {
          const plantedMs = new Date(row.planted_at).getTime();
          const harvestedMs = new Date(row.harvested_at).getTime();
          const actualDays = Math.round(
            (harvestedMs - plantedMs) / (1000 * 60 * 60 * 24)
          );
          return {
            id: row.id,
            hole_canonical: row.holes?.canonical_id ?? "-",
            rack: row.holes?.rack ?? "-",
            crop_name: row.crop_catalog?.name_id ?? "-",
            batch_code: row.batches?.batch_code ?? "-",
            planted_at: row.planted_at,
            harvested_at: row.harvested_at,
            expected_harvest_at: row.expected_harvest_at ?? null,
            harvest_weight_g: row.harvest_weight_g ?? null,
            quality_grade: row.quality_grade ?? null,
            visual_condition: row.visual_condition ?? null,
            post_harvest_handling: row.post_harvest_handling ?? null,
            harvest_notes: row.harvest_notes ?? null,
            early_harvest_reason: row.early_harvest_reason ?? null,
            grow_duration_days: row.crop_catalog?.grow_duration_days ?? 0,
            actual_days: actualDays,
          };
        });
        setEntries(mapped);
      }
      setLoading(false);
    }

  useEffect(() => { loadData(); }, []);

  /* ---------- Sorting ---------- */
  const sorted = useMemo(() => {
    const arr = [...entries];
    switch (sortKey) {
      case "date_desc":
        return arr.sort(
          (a, b) => b.harvested_at.localeCompare(a.harvested_at)
        );
      case "date_asc":
        return arr.sort(
          (a, b) => a.harvested_at.localeCompare(b.harvested_at)
        );
      case "weight_desc":
        return arr.sort(
          (a, b) => (b.harvest_weight_g ?? 0) - (a.harvest_weight_g ?? 0)
        );
      case "weight_asc":
        return arr.sort(
          (a, b) => (a.harvest_weight_g ?? 0) - (b.harvest_weight_g ?? 0)
        );
      case "crop":
        return arr.sort((a, b) => a.crop_name.localeCompare(b.crop_name));
      case "condition":
        return arr.sort((a, b) => (a.visual_condition ?? "z").localeCompare(b.visual_condition ?? "z"));
      case "handling":
        return arr.sort((a, b) => (a.post_harvest_handling ?? "z").localeCompare(b.post_harvest_handling ?? "z"));
      default:
        return arr;
    }
  }, [entries, sortKey]);

  /* ---------- Summary ---------- */
  const summary = useMemo(() => {
    const totalCount = entries.length;
    const totalWeight = entries.reduce(
      (sum, e) => sum + (e.harvest_weight_g ?? 0),
      0
    );
    const withWeight = entries.filter((e) => e.harvest_weight_g !== null);
    const avgWeight =
      withWeight.length > 0
        ? withWeight.reduce((s, e) => s + (e.harvest_weight_g ?? 0), 0) /
          withWeight.length
        : 0;
    const grades: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.quality_grade) {
        grades[e.quality_grade] = (grades[e.quality_grade] || 0) + 1;
      }
    });
    return { totalCount, totalWeight, avgWeight, grades };
  }, [entries]);

  /* ---------- Chart data ---------- */
  const cropChartData = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      const display = translateCommodity(e.crop_name, lang);
      map[display] = (map[display] ?? 0) + (e.harvest_weight_g ?? 0);
    });
    return Object.entries(map)
      .map(([name, weight]) => ({ name, weight: Math.round(weight) }))
      .sort((a, b) => b.weight - a.weight);
  }, [entries, lang]);

  const trendData = useMemo(() => {
    const map: Record<string, { date: string; count: number; weight: number }> = {};
    entries.forEach((e) => {
      const day = e.harvested_at.slice(0, 10);
      if (!map[day]) map[day] = { date: day, count: 0, weight: 0 };
      map[day].count++;
      map[day].weight += e.harvest_weight_g ?? 0;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      date: formatDateLocale(d.date, lang, { day: "2-digit", month: "short" }),
      weight: Math.round(d.weight),
    }));
  }, [entries, lang]);

  const gradeData = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      const g = e.quality_grade ?? t("cult.no_grade");
      map[g] = (map[g] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name: `Grade ${name}`, value }));
  }, [entries, t]);

  const GRADE_PIE_COLORS = ["#4ade80", "#38bdf8", "#f59e0b", "#71717a"];

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">{t("page.harvest.header")}</h1>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            {t("cult.total_harvest")}
          </p>
          <p className="text-xl font-semibold text-foreground">
            {summary.totalCount}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            {t("cult.total_weight")}
          </p>
          <p className="text-xl font-semibold text-foreground">
            {formatWeight(summary.totalWeight)}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            {t("cult.avg_weight")}
          </p>
          <p className="text-xl font-semibold text-foreground">
            {summary.avgWeight > 0 ? `${Math.round(summary.avgWeight)} g` : "-"}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            {t("cult.grade_distribution")}
          </p>
          <div className="flex gap-1.5 mt-1">
            {["A", "B", "C"].map((g) => (
              <Badge
                key={g}
                variant="outline"
                className={`text-[11px] px-1.5 py-0 ${gradeColor(g)}`}
              >
                {g}: {summary.grades[g] ?? 0}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Charts section */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Chart 1: Harvest by Crop */}
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <h3 className="text-[13px] font-semibold text-foreground mb-3">{t("cult.harvest_by_crop")}</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, cropChartData.length * 40)}>
            <BarChart data={cropChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: chartTheme.axis }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: chartTheme.axis }} width={100} />
              <Tooltip
                contentStyle={chartTheme.tooltip}
                formatter={(v) => [`${v} g`, t("cult.harvest_weight_short")]}
              />
              <Bar dataKey="weight" fill="#2dd4bf" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Grade distribution pie */}
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <h3 className="text-[13px] font-semibold text-foreground mb-3">{t("cult.grade_distribution")}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={gradeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0} label={({ name, percent }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {gradeData.map((_, i) => <Cell key={i} fill={GRADE_PIE_COLORS[i % GRADE_PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={chartTheme.tooltip} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Harvest trend over time */}
      <div className="rounded-lg border border-border/40 bg-card p-4 mb-4">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">{t("cult.harvest_trend_daily")}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="panenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: chartTheme.axis }} />
            <YAxis tick={{ fontSize: 10, fill: chartTheme.axis }} />
            <Tooltip
              contentStyle={chartTheme.tooltip}
              formatter={(v) => [String(v), '']}
            />
            <Area type="monotone" dataKey="weight" stroke="#2dd4bf" strokeWidth={2} fill="url(#panenGrad)" name={`${t("cult.harvest_weight_short")} (g)`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Hidden file input for harvest photos */}
      <input ref={hFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleHarvestPhoto} />

      {/* Ready to Harvest section */}
      {readyToHarvest.length > 0 && (
        <div className="mb-4">
          <button
            className="flex items-center gap-2 text-[13px] font-medium text-[oklch(0.80_0.14_80)] mb-2 hover:underline"
            onClick={() => setShowReadySection(!showReadySection)}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showReadySection ? "" : "-rotate-90"}`} />
            {t("hole_status.ready_harvest")} ({readyToHarvest.length})
          </button>
          {showReadySection && (
            <div className="space-y-2">
              {readyToHarvest.map((cycle: any) => (
                <div key={cycle.id} className="rounded-lg border border-[oklch(0.55_0.15_80/0.4)] bg-[oklch(0.60_0.17_80/0.10)] dark:border-[oklch(0.55_0.15_80/0.3)] dark:bg-[oklch(0.55_0.15_80/0.06)] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[13px] font-medium text-foreground">{cycle.holes?.canonical_id ?? "-"}</span>
                      <span className="text-[12px] text-muted-foreground ml-2">{translateCommodity(cycle.crop_catalog?.name_id ?? "-", lang)}</span>
                      <span className="text-[11px] text-muted-foreground ml-2">({cycle.batches?.batch_code})</span>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-[12px] bg-[oklch(0.62_0.17_70)] hover:bg-[oklch(0.57_0.18_70)] dark:bg-[oklch(0.55_0.15_80)] dark:hover:bg-[oklch(0.60_0.17_80)] text-white"
                      onClick={() => setHarvestTarget(cycle)}
                    >
                      <Scissors className="h-3 w-3 mr-1" /> {t("cult.harvest")}
                    </Button>
                  </div>
                  {cycle.expected_harvest_at && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t("cult.harvest_target")}: {formatDate(cycle.expected_harvest_at, lang)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Harvest input dialog */}
      <Dialog open={harvestTarget !== null} onOpenChange={(v) => { if (!v) resetHarvestForm(); }}>
        <DialogContent showCloseButton={true} className="sm:max-w-[420px] bg-card border-border/50 p-0 gap-0">
          {harvestTarget && (
            <>
              <DialogHeader className="px-5 pt-5 pb-3">
                <DialogTitle className="text-base font-semibold text-foreground">
                  {t("cult.harvest")} {harvestTarget.holes?.canonical_id}
                </DialogTitle>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {translateCommodity(harvestTarget.crop_catalog?.name_id ?? "", lang)} — {harvestTarget.batches?.batch_code}
                </p>
              </DialogHeader>
              <Separator className="bg-border/30" />
              <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t("cult.weight_grams")} *</Label>
                    <Input type="number" className={`h-9 bg-secondary border-border/50 text-[12px] ${hErrors.weight ? "border-destructive" : ""}`}
                      placeholder="250" value={hWeight} onChange={(e) => { setHWeight(e.target.value); setHErrors((p) => ({ ...p, weight: "" })); }} step="0.1" />
                    {hErrors.weight && <p className="text-[10px] text-destructive">{hErrors.weight}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Grade *</Label>
                    <Select value={hGrade} onValueChange={(v) => { if (v !== null) { setHGrade(v); setHErrors((p) => ({ ...p, grade: "" })); } }}>
                      <SelectTrigger className={`h-9 bg-secondary border-border/50 text-[12px] ${hErrors.grade ? "border-destructive" : ""}`}>
                        <SelectValue placeholder="Grade">{hGrade ? `Grade ${hGrade}` : undefined}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {QUALITY_GRADES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {hErrors.grade && <p className="text-[10px] text-destructive">{hErrors.grade}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t("cult.visual_condition")}</Label>
                    <Select value={hVisual} onValueChange={(v) => v !== null && setHVisual(v)}>
                      <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px]">
                        <SelectValue placeholder={`${t("common.select")}...`}>{hVisual ? (() => { const c = VISUAL_CONDITIONS.find(v => v.value === hVisual); return c ? t(c.labelKey) : undefined; })() : undefined}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {VISUAL_CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t("cult.handling")}</Label>
                    <Select value={hHandling} onValueChange={(v) => v !== null && setHHandling(v)}>
                      <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px]">
                        <SelectValue placeholder={`${t("common.select")}...`}>{hHandling ? (() => { const c = POST_HARVEST_HANDLING.find(h => h.value === hHandling); return c ? t(c.labelKey) : undefined; })() : undefined}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {POST_HARVEST_HANDLING.map((c) => <SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Photo */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground">{t("cult.harvest_photo")} *</Label>
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] border-border/50"
                      onClick={() => hFileRef.current?.click()}>
                      <Camera className="h-3 w-3 mr-1" /> {t("cult.photo")}
                    </Button>
                  </div>
                  {hPhotos.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1">
                      {hPhotos.map((p, i) => (
                        <div key={i} className="relative rounded overflow-hidden bg-secondary aspect-square group">
                          <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setHPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <X className="h-2.5 w-2.5 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-[10px] ${hErrors.photos ? "text-destructive" : "text-muted-foreground"}`}>
                      {hErrors.photos || t("cult.min_one_photo")}
                    </p>
                  )}
                </div>
                {/* Notes */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{t("cult.harvest_notes")}</Label>
                  <Textarea className="bg-secondary border-border/50 text-[12px]" rows={2} placeholder={t("cult.observation_placeholder")}
                    value={hNotes} onChange={(e) => setHNotes(e.target.value)} />
                </div>
                {/* Early reason */}
                {harvestTarget.expected_harvest_at && new Date() < new Date(harvestTarget.expected_harvest_at) && (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t("cult.early_harvest_reason")}</Label>
                    <Textarea className="bg-secondary border-border/50 text-[12px]" rows={2} placeholder={t("cult.early_reason_placeholder")}
                      value={hEarlyReason} onChange={(e) => setHEarlyReason(e.target.value)} />
                  </div>
                )}
                <Button className="w-full h-10 bg-primary hover:bg-primary/90 text-white text-[13px]"
                  onClick={submitHarvest} disabled={hSaving}>
                  {hSaving ? t("common.saving") : t("cult.record_harvest")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Toolbar: sort + view mode */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={sortKey}
            onValueChange={(v) => v !== null && setSortKey(v as SortKey)}
          >
            <SelectTrigger className="h-8 bg-secondary border-border/50 text-[12px] w-[180px]">
              <SelectValue>{t(SORT_LABEL_KEYS[sortKey])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_LABEL_KEYS).map(([k, key]) => (
                <SelectItem key={k} value={k}>{t(key)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {sorted.length === 0 ? (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="py-12 text-center text-[13px] text-muted-foreground">
            {t("cult.no_harvest_data")}
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        /* ---------- TABLE VIEW ---------- */
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("common.date")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("cult.hole")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("cult.commodity")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("cult.batch")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("cult.duration_days")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("cult.harvest_weight_short")} (g)
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  Grade
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("cult.condition")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("cult.handling")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("common.notes")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="cursor-pointer hover:bg-secondary/30"
                  onClick={() => setSelectedEntry(entry)}
                >
                  <TableCell className="text-[13px]">
                    {formatDate(entry.harvested_at, lang)}
                  </TableCell>
                  <TableCell className="text-[13px] font-medium">
                    {entry.hole_canonical}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {translateCommodity(entry.crop_name, lang)}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {entry.batch_code}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {entry.actual_days}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {entry.harvest_weight_g ?? "-"}
                  </TableCell>
                  <TableCell>
                    {entry.quality_grade ? (
                      <Badge
                        variant="outline"
                        className={`text-[11px] px-1.5 py-0 ${gradeColor(entry.quality_grade)}`}
                      >
                        {entry.quality_grade}
                      </Badge>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">
                        -
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {conditionLabel(entry.visual_condition, t)}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {handlingLabel(entry.post_harvest_handling, t)}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground max-w-[150px] truncate">
                    {entry.harvest_notes ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* ---------- GRID / TILE VIEW ---------- */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map((entry) => {
            const diff = daysDiffLabel(
              entry.actual_days,
              entry.grow_duration_days,
              t
            );
            return (
              <div
                key={entry.id}
                className="rounded-lg border border-border/40 bg-card p-4 space-y-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => setSelectedEntry(entry)}
              >
                {/* Row 1: Date + location */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-foreground">
                    {formatDate(entry.harvested_at, lang)}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[11px] border-border/50"
                  >
                    {entry.hole_canonical}
                  </Badge>
                </div>

                {/* Row 2: Crop + batch */}
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-foreground">
                    {translateCommodity(entry.crop_name, lang)}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {entry.batch_code}
                  </span>
                </div>

                {/* Row 3: 4-column metrics grid */}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("cult.harvest_weight_short")}
                    </p>
                    <p className="text-[15px] font-semibold text-foreground">
                      {entry.harvest_weight_g ?? "-"}
                      {entry.harvest_weight_g !== null && (
                        <span className="text-[11px] font-normal text-muted-foreground">
                          g
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Grade
                    </p>
                    <p className="text-[15px] font-semibold text-foreground">
                      {entry.quality_grade ? (
                        <Badge
                          variant="outline"
                          className={`text-[12px] px-1.5 py-0 ${gradeColor(entry.quality_grade)}`}
                        >
                          {entry.quality_grade}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("cult.duration")}
                    </p>
                    <p className="text-[15px] font-semibold text-foreground">
                      {entry.actual_days}
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {t("unit.day")}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("cult.diff")}
                    </p>
                    <p className={`text-[15px] font-semibold ${diff.color}`}>
                      {entry.grow_duration_days > 0 ? diff.text : "-"}
                    </p>
                  </div>
                </div>

                {/* Row 4: Condition + handling badges */}
                {(entry.visual_condition || entry.post_harvest_handling) && (
                  <div className="flex gap-1.5 flex-wrap">
                    {entry.visual_condition && (
                      <Badge
                        variant="secondary"
                        className="text-[11px] px-1.5 py-0"
                      >
                        {conditionLabel(entry.visual_condition, t)}
                      </Badge>
                    )}
                    {entry.post_harvest_handling && (
                      <Badge
                        variant="secondary"
                        className="text-[11px] px-1.5 py-0"
                      >
                        {handlingLabel(entry.post_harvest_handling, t)}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Row 5: Notes */}
                {entry.harvest_notes && (
                  <p className="text-[12px] text-muted-foreground border-t border-border/20 pt-2">
                    {entry.harvest_notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============ DETAIL DIALOG ============ */}
      <Dialog
        open={selectedEntry !== null}
        onOpenChange={(v) => {
          if (!v) setSelectedEntry(null);
        }}
      >
        <DialogContent
          showCloseButton={true}
          className="sm:max-w-[480px] bg-card border-border/50 p-0 gap-0 max-h-[80vh]"
        >
          {selectedEntry && (() => {
            const e = selectedEntry;
            const diff = daysDiffLabel(e.actual_days, e.grow_duration_days, t);

            return (
              <>
                <DialogHeader className="px-5 pt-5 pb-3">
                  <DialogTitle className="text-base font-semibold text-foreground">
                    {e.hole_canonical} — {translateCommodity(e.crop_name, lang)}
                  </DialogTitle>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    {t("cult.harvest_detail")}
                  </p>
                </DialogHeader>

                <Separator className="bg-border/30" />

                <div className="overflow-y-auto max-h-[60vh] px-5 py-4 space-y-5">
                  {/* Section 1: Info Tanam */}
                  <div>
                    <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      {t("cult.harvest_info")}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[13px] text-muted-foreground">
                          {t("cult.batch")}
                        </span>
                        <span className="text-[13px] text-foreground font-medium">
                          {e.batch_code}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[13px] text-muted-foreground">
                          {t("cult.planted_date")}
                        </span>
                        <span className="text-[13px] text-foreground">
                          {formatDate(e.planted_at, lang)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[13px] text-muted-foreground">
                          {t("cult.harvest_date")}
                        </span>
                        <span className="text-[13px] text-foreground">
                          {formatDate(e.harvested_at, lang)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[13px] text-muted-foreground">
                          {t("cult.actual_duration")}
                        </span>
                        <span className="text-[13px] text-foreground">
                          {e.actual_days} {t("unit.day")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[13px] text-muted-foreground">
                          {t("cult.target_duration")}
                        </span>
                        <span className="text-[13px] text-foreground">
                          {e.grow_duration_days > 0
                            ? `${e.grow_duration_days} ${t("unit.day")}`
                            : "-"}
                        </span>
                      </div>
                      {e.grow_duration_days > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[13px] text-muted-foreground">
                            {t("cult.diff")}
                          </span>
                          <span
                            className={`text-[13px] font-medium ${diff.color}`}
                          >
                            {diff.text}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-border/30" />

                  {/* Section 2: Hasil Panen */}
                  <div>
                    <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      {t("cult.harvest_result")}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] text-muted-foreground">
                          {t("cult.harvest_weight_short")}
                        </span>
                        <span className="text-[13px] text-foreground font-medium">
                          {formatWeight(e.harvest_weight_g)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] text-muted-foreground">
                          Grade
                        </span>
                        {e.quality_grade ? (
                          <Badge
                            variant="outline"
                            className={`text-[11px] px-1.5 py-0 ${gradeColor(e.quality_grade)}`}
                          >
                            Grade {e.quality_grade}
                          </Badge>
                        ) : (
                          <span className="text-[13px] text-muted-foreground">
                            -
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[13px] text-muted-foreground">
                          {t("cult.visual_condition")}
                        </span>
                        <span className="text-[13px] text-foreground">
                          {conditionLabel(e.visual_condition, t)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[13px] text-muted-foreground">
                          {t("cult.post_harvest")}
                        </span>
                        <span className="text-[13px] text-foreground">
                          {handlingLabel(e.post_harvest_handling, t)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Catatan */}
                  {(e.harvest_notes || e.early_harvest_reason) && (
                    <>
                      <Separator className="bg-border/30" />
                      <div>
                        <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                          {t("common.notes")}
                        </h4>
                        <div className="space-y-2">
                          {e.harvest_notes && (
                            <div>
                              <p className="text-[12px] text-muted-foreground mb-0.5">
                                {t("cult.harvest_notes")}
                              </p>
                              <p className="text-[13px] text-foreground">
                                {e.harvest_notes}
                              </p>
                            </div>
                          )}
                          {e.early_harvest_reason && (
                            <div>
                              <p className="text-[12px] text-muted-foreground mb-0.5">
                                {t("cult.early_harvest_reason")}
                              </p>
                              <p className="text-[13px] text-foreground">
                                {e.early_harvest_reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
