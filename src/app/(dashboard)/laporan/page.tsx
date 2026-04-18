"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { FileText, Download, Printer, Camera, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CycleRow {
  id: number;
  hole_canonical: string;
  crop_name: string;
  batch_code: string;
  planted_at: string;
  harvested_at: string | null;
  harvest_weight_g: number | null;
  quality_grade: string | null;
  status: string;
}

interface EnvRow {
  temperature_c: number | null;
  humidity_pct: number | null;
  co2_ppm: number | null;
  vpd_kpa: number | null;
  ppfd_umol: number | null;
  recorded_at: string;
}

interface PhotoEntry {
  dataUrl: string;
  timestamp: Date;
}

/* ------------------------------------------------------------------ */
/*  CSV helper (BOM-prefixed)                                          */
/* ------------------------------------------------------------------ */

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Grade color map                                                    */
/* ------------------------------------------------------------------ */

const GRADE_COLORS: Record<string, string> = {
  A: "bg-emerald-500",
  B: "bg-sky-500",
  C: "bg-amber-500",
  "Tanpa Grade": "bg-zinc-500",
};

function gradeColor(grade: string) {
  return GRADE_COLORS[grade] ?? "bg-zinc-400";
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${g.toFixed(0)} g`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function avg(arr: (number | null)[]): number {
  const nums = arr.filter((v): v is number => v !== null);
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ReportPage() {
  const supabase = createClient();

  /* ---------- active tab ---------- */
  const [activeTab, setActiveTab] = useState("otomatis");

  /* ---------- data state ---------- */
  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [envLogs, setEnvLogs] = useState<EnvRow[]>([]);
  const [batchCount, setBatchCount] = useState(0);
  const [activeHoleCount, setActiveHoleCount] = useState(0);
  const [loading, setLoading] = useState(false);

  /* ---------- filter state (auto report) ---------- */
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* ---------- manual report form ---------- */
  const [manualTitle, setManualTitle] = useState("");
  const [manualFrom, setManualFrom] = useState("");
  const [manualTo, setManualTo] = useState("");
  const [manualSummary, setManualSummary] = useState("");
  const [manualEnvNotes, setManualEnvNotes] = useState("");
  const [manualProdNotes, setManualProdNotes] = useState("");
  const [manualRecommendation, setManualRecommendation] = useState("");
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- report visibility ---------- */
  const [showReport, setShowReport] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Load all data in parallel                                       */
  /* ---------------------------------------------------------------- */

  const loadData = useCallback(async () => {
    setLoading(true);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let cycleQuery = supabase
      .from("planting_cycles")
      .select(
        "id, planted_at, harvested_at, harvest_weight_g, quality_grade, status, holes(canonical_id), crop_catalog(name_id), batches(batch_code)"
      )
      .order("planted_at", { ascending: false })
      .limit(1000);

    if (dateFrom) {
      cycleQuery = cycleQuery.gte("planted_at", new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setDate(end.getDate() + 1);
      cycleQuery = cycleQuery.lt("planted_at", end.toISOString());
    }

    const [cyclesRes, envRes, batchRes, holesRes] = await Promise.all([
      cycleQuery,
      supabase
        .from("environmental_logs")
        .select("temperature_c, humidity_pct, co2_ppm, vpd_kpa, ppfd_umol, recorded_at")
        .gte("recorded_at", sevenDaysAgo.toISOString())
        .order("recorded_at", { ascending: false })
        .limit(500),
      supabase
        .from("batches")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("holes")
        .select("id", { count: "exact", head: true })
        .neq("status", "empty"),
    ]);

    if (cyclesRes.data) {
      const rows: CycleRow[] = cyclesRes.data.map((d) => ({
        id: d.id,
        hole_canonical:
          (d.holes as unknown as { canonical_id: string })?.canonical_id ?? "-",
        crop_name:
          (d.crop_catalog as unknown as { name_id: string })?.name_id ?? "-",
        batch_code:
          (d.batches as unknown as { batch_code: string })?.batch_code ?? "-",
        planted_at: d.planted_at,
        harvested_at: d.harvested_at ?? null,
        harvest_weight_g: d.harvest_weight_g,
        quality_grade: d.quality_grade,
        status: d.status,
      }));
      setCycles(rows);
    }

    if (envRes.data) setEnvLogs(envRes.data as EnvRow[]);
    setBatchCount(batchRes.count ?? 0);
    setActiveHoleCount(holesRes.count ?? 0);

    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Derived data for auto report                                    */
  /* ---------------------------------------------------------------- */

  const harvested = useMemo(
    () => cycles.filter((r) => r.status === "harvested"),
    [cycles]
  );

  const summary = useMemo(() => {
    const totalWeight = harvested.reduce((s, r) => s + (r.harvest_weight_g ?? 0), 0);
    const totalCount = harvested.length;
    const avgWeight = totalCount > 0 ? totalWeight / totalCount : 0;

    const grades: Record<string, number> = {};
    harvested.forEach((r) => {
      const g = r.quality_grade ?? "Tanpa Grade";
      grades[g] = (grades[g] || 0) + 1;
    });

    return { totalWeight, totalCount, avgWeight, grades };
  }, [harvested]);

  const gradeTotal = Object.values(summary.grades).reduce((a, b) => a + b, 0);

  const envSummary = useMemo(() => {
    return {
      avgTemp: avg(envLogs.map((e) => e.temperature_c)),
      avgHumidity: avg(envLogs.map((e) => e.humidity_pct)),
      avgCO2: avg(envLogs.map((e) => e.co2_ppm)),
      avgVPD: avg(envLogs.map((e) => e.vpd_kpa)),
      avgPPFD: avg(envLogs.map((e) => e.ppfd_umol)),
    };
  }, [envLogs]);

  const recentHarvests = useMemo(
    () => harvested.slice(0, 20),
    [harvested]
  );

  /* ---------------------------------------------------------------- */
  /*  CSV export (all sections)                                       */
  /* ---------------------------------------------------------------- */

  const exportCSV = useCallback(() => {
    const exportRows = harvested.map((r) => ({
      Lubang: r.hole_canonical,
      Komoditas: r.crop_name,
      Batch: r.batch_code,
      Tanggal_Tanam: fmtDate(r.planted_at),
      Tanggal_Panen: r.harvested_at ? fmtDate(r.harvested_at) : "",
      Berat_gram: r.harvest_weight_g ?? "",
      Grade: r.quality_grade ?? "",
    }));
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(exportRows, `laporan-otomatis-${dateStr}.csv`);
    toast.success("CSV berhasil diekspor");
  }, [harvested]);

  /* ---------------------------------------------------------------- */
  /*  Photo capture                                                   */
  /* ---------------------------------------------------------------- */

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((prev) => [
        { dataUrl: reader.result as string, timestamp: new Date() },
        ...prev,
      ]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  /* ---------------------------------------------------------------- */
  /*  Stat card component                                             */
  /* ---------------------------------------------------------------- */

  function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
    return (
      <div className="rounded-lg border border-border/40 bg-card p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">
          {value}
          <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
        </p>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          nav, aside, .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-only { display: block !important; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <h1 className="text-lg font-semibold text-foreground no-print">Laporan</h1>

      <Tabs
        value={activeTab}
        onValueChange={(v) => v !== null && setActiveTab(v)}
      >
        <TabsList className="h-10 bg-secondary border border-border/50 no-print">
          <TabsTrigger value="otomatis" className="text-sm">
            <FileText className="w-4 h-4 mr-1.5" />
            Laporan Otomatis
          </TabsTrigger>
          <TabsTrigger value="manual" className="text-sm">
            Laporan Manual
          </TabsTrigger>
          <TabsTrigger value="riwayat" className="text-sm">
            Riwayat Laporan
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/*  TAB 1: Laporan Otomatis                                     */}
        {/* ============================================================ */}
        <TabsContent value="otomatis" className="mt-4 space-y-4">
          {/* Action bar */}
          <div className="flex flex-wrap items-end gap-3 no-print">
            <div className="space-y-1">
              <Label className="text-[13px] text-muted-foreground">Dari Tanggal</Label>
              <Input
                type="date"
                className="h-11 bg-secondary border-border/50 w-40"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[13px] text-muted-foreground">Sampai Tanggal</Label>
              <Input
                type="date"
                className="h-11 bg-secondary border-border/50 w-40"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button
              className="h-9 bg-[oklch(0.65_0.18_260)] text-white text-[13px] hover:bg-[oklch(0.60_0.20_260)]"
              onClick={() => { setShowReport(true); loadData(); }}
              disabled={loading}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              {loading ? "Memuat..." : "Tampilkan Laporan"}
            </Button>
            <Button
              variant="outline"
              className="h-9 text-[13px]"
              onClick={exportCSV}
              disabled={harvested.length === 0}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Ekspor CSV
            </Button>
            <Button
              variant="outline"
              className="h-9 text-[13px]"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Ekspor PDF
            </Button>
          </div>

          {/* Report content area */}
          {showReport && (
            <div className="rounded-xl border border-border/40 bg-card p-6 space-y-6">
              {/* Print header */}
              <div className="hidden print-only">
                <h1 className="text-xl font-bold">Laporan Produksi Plant Factory</h1>
                <p className="text-sm text-muted-foreground">
                  Tanggal cetak: {new Date().toLocaleDateString("id-ID")}
                  {dateFrom && ` | Periode: ${fmtDate(dateFrom)}`}
                  {dateTo && ` - ${fmtDate(dateTo)}`}
                </p>
                <Separator className="my-3" />
              </div>

              {/* Section A: Ringkasan Produksi */}
              <div>
                <h2 className="text-[14px] font-semibold text-foreground mb-3">
                  A. Ringkasan Produksi
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Batch Aktif" value={String(batchCount)} unit="" />
                  <StatCard label="Lubang Aktif" value={String(activeHoleCount)} unit="" />
                  <StatCard label="Total Panen" value={String(summary.totalCount)} unit="siklus" />
                  <StatCard
                    label="Rata-rata Berat Panen"
                    value={summary.totalCount > 0 ? summary.avgWeight.toFixed(0) : "-"}
                    unit={summary.totalCount > 0 ? "g" : ""}
                  />
                </div>

                {/* Grade distribution bar */}
                {gradeTotal > 0 && (
                  <div className="mt-4 rounded-lg border border-border/40 bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-2">Distribusi Grade</p>
                    <div className="flex h-5 w-full rounded overflow-hidden">
                      {Object.entries(summary.grades).map(([grade, count]) => (
                        <div
                          key={grade}
                          className={gradeColor(grade)}
                          style={{ width: `${(count / gradeTotal) * 100}%` }}
                          title={`${grade}: ${count}`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {Object.entries(summary.grades).map(([grade, count]) => (
                        <span
                          key={grade}
                          className="text-[12px] text-muted-foreground flex items-center gap-1.5"
                        >
                          <span className={`inline-block w-2.5 h-2.5 rounded-sm ${gradeColor(grade)}`} />
                          {grade}: {count} ({((count / gradeTotal) * 100).toFixed(0)}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Section B: Kondisi Lingkungan */}
              <div>
                <h2 className="text-[14px] font-semibold text-foreground mb-3">
                  B. Kondisi Lingkungan (7 Hari Terakhir)
                </h2>
                {envLogs.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatCard
                      label="Rata-rata Suhu"
                      value={envSummary.avgTemp.toFixed(1)}
                      unit="°C"
                    />
                    <StatCard
                      label="Rata-rata Kelembaban"
                      value={envSummary.avgHumidity.toFixed(1)}
                      unit="%"
                    />
                    <StatCard
                      label="Rata-rata CO2"
                      value={envSummary.avgCO2.toFixed(0)}
                      unit="ppm"
                    />
                    <StatCard
                      label="Rata-rata VPD"
                      value={envSummary.avgVPD.toFixed(2)}
                      unit="kPa"
                    />
                    <StatCard
                      label="Rata-rata PPFD"
                      value={envSummary.avgPPFD.toFixed(0)}
                      unit="µmol"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Belum ada data lingkungan dalam 7 hari terakhir.
                  </p>
                )}
              </div>

              <Separator />

              {/* Section C: Riwayat Panen */}
              <div>
                <h2 className="text-[14px] font-semibold text-foreground mb-3">
                  C. Riwayat Panen (20 Terakhir)
                </h2>
                {recentHarvests.length > 0 ? (
                  <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[12px] text-muted-foreground">Lubang</TableHead>
                          <TableHead className="text-[12px] text-muted-foreground">Komoditas</TableHead>
                          <TableHead className="text-[12px] text-muted-foreground">Batch</TableHead>
                          <TableHead className="text-[12px] text-muted-foreground">Tanggal Panen</TableHead>
                          <TableHead className="text-[12px] text-muted-foreground">Berat (g)</TableHead>
                          <TableHead className="text-[12px] text-muted-foreground">Grade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentHarvests.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-[13px]">{r.hole_canonical}</TableCell>
                            <TableCell className="text-[13px]">{r.crop_name}</TableCell>
                            <TableCell className="text-[13px]">{r.batch_code}</TableCell>
                            <TableCell className="text-[13px]">
                              {r.harvested_at ? fmtDate(r.harvested_at) : "-"}
                            </TableCell>
                            <TableCell className="text-[13px]">{r.harvest_weight_g ?? "-"}</TableCell>
                            <TableCell className="text-[13px]">{r.quality_grade ?? "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Belum ada data panen.
                  </p>
                )}
              </div>
            </div>
          )}

          {!showReport && !loading && (
            <Card className="rounded-xl border border-border/40 bg-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                Tekan &quot;Tampilkan Laporan&quot; untuk membuat laporan otomatis dari data yang tersedia.
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card className="rounded-xl border border-border/40 bg-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                Memuat data laporan...
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/*  TAB 2: Laporan Manual                                       */}
        {/* ============================================================ */}
        <TabsContent value="manual" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border/40 bg-card p-6 space-y-5">
            <h2 className="text-[14px] font-semibold text-foreground">
              Buat Laporan Manual
            </h2>

            {/* Judul */}
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">
                Judul Laporan <span className="text-red-400">*</span>
              </Label>
              <Input
                className="h-11 bg-secondary border-border/50"
                placeholder="Contoh: Laporan Mingguan Produksi"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
              />
            </div>

            {/* Periode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Periode Dari</Label>
                <Input
                  type="date"
                  className="h-11 bg-secondary border-border/50"
                  value={manualFrom}
                  onChange={(e) => setManualFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Periode Sampai</Label>
                <Input
                  type="date"
                  className="h-11 bg-secondary border-border/50"
                  value={manualTo}
                  onChange={(e) => setManualTo(e.target.value)}
                />
              </div>
            </div>

            {/* Ringkasan/Analisis */}
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">
                Ringkasan / Analisis <span className="text-red-400">*</span>
              </Label>
              <Textarea
                className="min-h-[120px] bg-secondary border-border/50"
                placeholder="Tuliskan ringkasan analisis produksi..."
                value={manualSummary}
                onChange={(e) => setManualSummary(e.target.value)}
              />
            </div>

            {/* Kondisi Lingkungan - Catatan */}
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">
                Kondisi Lingkungan - Catatan
              </Label>
              <Textarea
                className="min-h-[80px] bg-secondary border-border/50"
                placeholder="Catatan terkait suhu, kelembaban, pH, EC, dll..."
                value={manualEnvNotes}
                onChange={(e) => setManualEnvNotes(e.target.value)}
              />
            </div>

            {/* Kondisi Produksi - Catatan */}
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">
                Kondisi Produksi - Catatan
              </Label>
              <Textarea
                className="min-h-[80px] bg-secondary border-border/50"
                placeholder="Catatan terkait pertumbuhan, penyakit, kendala produksi..."
                value={manualProdNotes}
                onChange={(e) => setManualProdNotes(e.target.value)}
              />
            </div>

            {/* Rekomendasi */}
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Rekomendasi</Label>
              <Textarea
                className="min-h-[80px] bg-secondary border-border/50"
                placeholder="Rekomendasi tindak lanjut..."
                value={manualRecommendation}
                onChange={(e) => setManualRecommendation(e.target.value)}
              />
            </div>

            <Separator />

            {/* Foto Dokumentasi */}
            <div className="space-y-3">
              <Label className="text-[13px] text-muted-foreground">Foto Dokumentasi</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="h-9 text-[13px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-1.5" />
                  Ambil Foto
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoCapture}
                />
                <span className="text-[12px] text-muted-foreground italic">
                  Foto disimpan sementara di browser
                </span>
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {photos.map((p, i) => (
                    <div
                      key={i}
                      className="relative rounded-lg border border-border/40 bg-secondary/50 overflow-hidden group"
                    >
                      <img
                        src={p.dataUrl}
                        alt={`Foto ${i + 1}`}
                        className="w-full aspect-square object-cover"
                      />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <p className="text-[11px] text-muted-foreground text-center py-1 px-1 truncate">
                        {p.timestamp.toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                className="h-9 bg-[oklch(0.65_0.18_260)] text-white text-[13px] hover:bg-[oklch(0.60_0.20_260)]"
                onClick={() => {
                  if (!manualTitle.trim() || !manualSummary.trim()) {
                    toast.error("Judul dan Ringkasan wajib diisi");
                    return;
                  }
                  toast.success("Laporan disimpan (fitur penyimpanan akan segera tersedia)");
                }}
              >
                Simpan Laporan
              </Button>
              <Button
                variant="outline"
                className="h-9 text-[13px]"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Ekspor PDF
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/*  TAB 3: Riwayat Laporan                                      */}
        {/* ============================================================ */}
        <TabsContent value="riwayat" className="mt-4">
          <Card className="rounded-xl border border-border/40 bg-card">
            <CardContent className="py-16 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Riwayat laporan akan tersedia setelah fitur penyimpanan diaktifkan.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
