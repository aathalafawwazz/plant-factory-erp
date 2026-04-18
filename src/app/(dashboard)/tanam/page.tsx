"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { HOLE_STATUS, QUALITY_GRADES, type HoleStatus } from "@/lib/constants";
import { toast } from "sonner";
import {
  Sprout, List, LayoutGrid, ArrowUpDown, Camera, X,
  ChevronDown, Pencil, Check,
} from "lucide-react";
import type { Batch, PlantingCycle, CropCatalog } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BatchWithRelations extends Batch {
  crop_catalog: CropCatalog | null;
  planting_cycles: (PlantingCycle & { holes: { canonical_id: string } | null })[];
}

type SortKey = "date_desc" | "date_asc" | "crop" | "holes_desc";
type ViewMode = "list" | "grid";

interface PhotoEntry {
  dataUrl: string;
  timestamp: Date;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function PlantingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [batches, setBatches] = useState<BatchWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Detail dialog
  const [selectedBatch, setSelectedBatch] = useState<BatchWithRelations | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Photo state
  const [photos, setPhotos] = useState<Record<number, PhotoEntry[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoTargetBatch, setPhotoTargetBatch] = useState<number | null>(null);

  // Harvest inline
  const [harvestCycleId, setHarvestCycleId] = useState<number | null>(null);
  const [harvestWeight, setHarvestWeight] = useState("");
  const [harvestGrade, setHarvestGrade] = useState("");
  const [harvestNotes, setHarvestNotes] = useState("");
  const [savingHarvest, setSavingHarvest] = useState(false);

  /* ---------- Load data ---------- */
  async function loadBatches() {
    const { data } = await supabase
      .from("batches")
      .select("*, crop_catalog(*), planting_cycles(*, holes!planting_cycles_hole_id_fkey(canonical_id))")
      .order("created_at", { ascending: false })
      .limit(100);
    setBatches((data as unknown as BatchWithRelations[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadBatches(); }, []);

  /* ---------- Sorting ---------- */
  const sortedBatches = useMemo(() => {
    const arr = [...batches];
    switch (sortKey) {
      case "date_desc": return arr.sort((a, b) => b.planted_at.localeCompare(a.planted_at));
      case "date_asc": return arr.sort((a, b) => a.planted_at.localeCompare(b.planted_at));
      case "crop": return arr.sort((a, b) => (a.crop_catalog?.name_id ?? "").localeCompare(b.crop_catalog?.name_id ?? ""));
      case "holes_desc": return arr.sort((a, b) => b.planting_cycles.length - a.planting_cycles.length);
      default: return arr;
    }
  }, [batches, sortKey]);

  /* ---------- Batch name edit ---------- */
  async function saveBatchName() {
    if (!selectedBatch) return;
    setSavingName(true);
    const newCode = batchName.trim() || selectedBatch.batch_code;
    const { error } = await supabase
      .from("batches")
      .update({ batch_code: newCode })
      .eq("id", selectedBatch.id);
    if (error) {
      toast.error("Gagal menyimpan nama batch");
    } else {
      toast.success("Nama batch diperbarui");
      setEditingName(false);
      await loadBatches();
      setSelectedBatch((prev) => prev ? { ...prev, batch_code: newCode } : null);
    }
    setSavingName(false);
  }

  /* ---------- Status update ---------- */
  async function updateCycleStatus(cycleId: number, holeId: number, newStatus: string) {
    const holeStatusMap: Record<string, string> = {
      growing: "growing",
      ready_harvest: "ready_harvest",
    };
    await supabase.from("planting_cycles").update({ status: newStatus as "growing" | "ready_harvest" }).eq("id", cycleId);
    if (holeStatusMap[newStatus]) {
      await supabase.from("holes").update({ status: holeStatusMap[newStatus] as HoleStatus }).eq("id", holeId);
    }
    toast.success(`Status diubah`);
    await loadBatches();
    // Refresh selected batch
    if (selectedBatch) {
      const updated = batches.find((b) => b.id === selectedBatch.id);
      if (updated) setSelectedBatch(updated);
    }
  }

  /* ---------- Harvest inline ---------- */
  async function handleHarvest(cycleId: number, holeId: number) {
    setSavingHarvest(true);
    await supabase.from("planting_cycles").update({
      status: "harvested",
      harvested_at: new Date().toISOString(),
      harvest_weight_g: harvestWeight ? Number(harvestWeight) : null,
      quality_grade: harvestGrade || null,
      notes: harvestNotes || null,
    }).eq("id", cycleId);
    await supabase.from("holes").update({ status: "harvested" as const, current_cycle_id: null }).eq("id", holeId);
    toast.success("Panen berhasil dicatat");
    setHarvestCycleId(null);
    setHarvestWeight("");
    setHarvestGrade("");
    setHarvestNotes("");
    setSavingHarvest(false);
    await loadBatches();
  }

  /* ---------- Photo capture ---------- */
  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || photoTargetBatch === null) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((prev) => ({
        ...prev,
        [photoTargetBatch]: [
          ...(prev[photoTargetBatch] ?? []),
          { dataUrl: reader.result as string, timestamp: new Date() },
        ],
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  /* ---------- Helpers ---------- */
  function getStatusBreakdown(cycles: PlantingCycle[]) {
    const breakdown: Record<string, number> = {};
    cycles.forEach((c) => { breakdown[c.status] = (breakdown[c.status] || 0) + 1; });
    return breakdown;
  }

  function getBatchDisplayName(batch: BatchWithRelations) {
    return batch.batch_code;
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Memuat...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-foreground">Log Tanam</h1>
        <Link href="/tanam/baru">
          <Button className="h-9 bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white text-[13px]">
            <Sprout className="mr-1.5 h-4 w-4" />
            Tanam Baru
          </Button>
        </Link>
      </div>

      {/* Toolbar: sort + view mode */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={sortKey} onValueChange={(v) => v !== null && setSortKey(v as SortKey)}>
            <SelectTrigger className="h-8 bg-secondary border-border/50 text-[12px] w-[160px]">
              <SelectValue>
                {({ date_desc: "Terbaru", date_asc: "Terlama", crop: "Komoditas A-Z", holes_desc: "Jumlah Lubang" } as Record<string, string>)[sortKey]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Terbaru</SelectItem>
              <SelectItem value="date_asc">Terlama</SelectItem>
              <SelectItem value="crop">Komoditas A-Z</SelectItem>
              <SelectItem value="holes_desc">Jumlah Lubang</SelectItem>
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

      {/* Batch list/grid */}
      {sortedBatches.length === 0 ? (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="py-12 text-center text-[13px] text-muted-foreground">
            Belum ada data siklus tanam. Mulai dengan menanam komoditas baru.
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">Batch Code</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Komoditas</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Lubang</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Tanggal Tanam</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Status</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBatches.map((batch) => {
                const cycles = batch.planting_cycles ?? [];
                const statusBreakdown = getStatusBreakdown(cycles);

                return (
                  <TableRow
                    key={batch.id}
                    className="cursor-pointer hover:bg-secondary/30"
                    onClick={() => { setSelectedBatch(batch); setBatchName(batch.batch_code); }}
                  >
                    <TableCell className="text-[13px] font-medium">{getBatchDisplayName(batch)}</TableCell>
                    <TableCell className="text-[13px]">{batch.crop_catalog?.name_id ?? "-"}</TableCell>
                    <TableCell className="text-[13px]">{cycles.length}</TableCell>
                    <TableCell className="text-[13px]">{new Date(batch.planted_at).toLocaleDateString("id-ID")}</TableCell>
                    <TableCell className="text-[13px]">
                      <div className="flex gap-1">
                        {Object.entries(statusBreakdown).map(([status]) => (
                          <StatusBadge key={status} status={status as HoleStatus} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] max-w-[200px] truncate">{batch.notes || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {sortedBatches.map((batch) => {
            const cycles = batch.planting_cycles ?? [];
            const totalHoles = cycles.length;
            const statusBreakdown = getStatusBreakdown(cycles);
            const batchPhotos = photos[batch.id] ?? [];

            return (
              <div
                key={batch.id}
                className="rounded-lg border border-border/40 bg-card p-3 cursor-pointer hover:border-border/70 transition-colors"
                onClick={() => { setSelectedBatch(batch); setBatchName(batch.batch_code); }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium text-foreground">{getBatchDisplayName(batch)}</span>
                  <Badge variant={batch.status === "active" ? "default" : "secondary"} className="text-[10px]">
                    {batch.status === "active" ? "Aktif" : "Selesai"}
                  </Badge>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {batch.crop_catalog?.name_id ?? "-"} — {totalHoles} lubang
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(batch.planted_at).toLocaleDateString("id-ID")}
                </p>
                <div className="flex gap-1 mt-2">
                  {Object.entries(statusBreakdown).map(([status, count]) => (
                    <StatusBadge key={status} status={status as HoleStatus} />
                  ))}
                </div>
                {batchPhotos.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    <Camera className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{batchPhotos.length} foto</span>
                  </div>
                )}
                {batch.notes && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 border-t border-border/20 pt-1.5">Catatan: {batch.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden file input for photos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {/* ============ BATCH DETAIL DIALOG ============ */}
      <Dialog open={selectedBatch !== null} onOpenChange={(v) => { if (!v) { setSelectedBatch(null); setHarvestCycleId(null); } }}>
        <DialogContent showCloseButton={true} className="sm:max-w-[520px] bg-card border-border/50 p-0 gap-0 max-h-[80vh]">
          {selectedBatch && (() => {
            const batch = selectedBatch;
            const cycles = batch.planting_cycles ?? [];
            const batchPhotos = photos[batch.id] ?? [];

            return (
              <>
                <DialogHeader className="px-5 pt-5 pb-3">
                  <div className="flex items-center gap-2">
                    {editingName ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          className="h-8 bg-secondary border-border/50 text-sm"
                          value={batchName}
                          onChange={(e) => setBatchName(e.target.value)}
                          placeholder={batch.batch_code}
                          autoFocus
                        />
                        <Button size="sm" className="h-8 px-2" onClick={saveBatchName} disabled={savingName}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingName(false)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <DialogTitle className="text-base font-semibold text-foreground">
                          {getBatchDisplayName(batch)}
                        </DialogTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground"
                          onClick={() => setEditingName(true)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    {batch.crop_catalog?.name_id ?? "-"} — {cycles.length} lubang —{" "}
                    {new Date(batch.planted_at).toLocaleDateString("id-ID")}
                  </p>
                </DialogHeader>

                <Separator className="bg-border/30" />

                <div className="overflow-y-auto max-h-[60vh] px-5 py-4 space-y-4">
                  {/* Cycle list */}
                  <div>
                    <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Lubang ({cycles.length})
                    </h4>
                    <div className="space-y-1.5">
                      {cycles.map((cycle) => {
                        const holeId = cycle.hole_id;
                        const holeName = cycle.holes?.canonical_id ?? `#${cycle.hole_id}`;
                        const isHarvesting = harvestCycleId === cycle.id;

                        return (
                          <div key={cycle.id} className="rounded-lg bg-secondary/40 p-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-medium text-foreground">{holeName}</span>
                                <StatusBadge status={cycle.status as HoleStatus} />
                              </div>
                              <div className="flex gap-1">
                                {cycle.status === "planted" && (
                                  <Button size="sm" className="h-7 text-[11px] px-2 bg-[oklch(0.45_0.16_150)] hover:bg-[oklch(0.50_0.18_150)] text-white"
                                    onClick={(e) => { e.stopPropagation(); updateCycleStatus(cycle.id, holeId, "growing"); }}>
                                    Tumbuh
                                  </Button>
                                )}
                                {cycle.status === "growing" && (
                                  <Button size="sm" className="h-7 text-[11px] px-2 bg-[oklch(0.55_0.15_80)] hover:bg-[oklch(0.60_0.17_80)] text-white"
                                    onClick={(e) => { e.stopPropagation(); updateCycleStatus(cycle.id, holeId, "ready_harvest"); }}>
                                    Siap Panen
                                  </Button>
                                )}
                                {cycle.status === "ready_harvest" && (
                                  <Button size="sm" className="h-7 text-[11px] px-2 bg-[oklch(0.50_0.12_180)] hover:bg-[oklch(0.55_0.14_180)] text-white"
                                    onClick={(e) => { e.stopPropagation(); setHarvestCycleId(isHarvesting ? null : cycle.id); }}>
                                    {isHarvesting ? "Batal" : "Panen"}
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Inline harvest form */}
                            {isHarvesting && (
                              <div className="mt-2 pt-2 border-t border-border/20 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-[11px] text-muted-foreground">Berat (gram)</Label>
                                    <Input type="number" className="h-9 bg-secondary border-border/50 text-[12px] mt-1" placeholder="250"
                                      value={harvestWeight} onChange={(e) => setHarvestWeight(e.target.value)} step="0.1" />
                                  </div>
                                  <div>
                                    <Label className="text-[11px] text-muted-foreground">Kualitas</Label>
                                    <Select value={harvestGrade} onValueChange={(v) => v !== null && setHarvestGrade(v)}>
                                      <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] mt-1">
                                        <SelectValue placeholder="Grade">
                                          {harvestGrade ? `Grade ${harvestGrade}` : undefined}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {QUALITY_GRADES.map((g) => (
                                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <Button size="sm" className="w-full h-8 text-[12px] bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white"
                                  disabled={savingHarvest}
                                  onClick={() => handleHarvest(cycle.id, holeId)}>
                                  {savingHarvest ? "Menyimpan..." : "Simpan Panen"}
                                </Button>
                              </div>
                            )}

                            {/* Harvested info */}
                            {cycle.status === "harvested" && cycle.harvest_weight_g && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {cycle.harvest_weight_g}g {cycle.quality_grade && `— Grade ${cycle.quality_grade}`}
                                {cycle.harvested_at && ` — ${new Date(cycle.harvested_at).toLocaleDateString("id-ID")}`}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Photos section */}
                  <Separator className="bg-border/30" />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                        Dokumentasi Foto ({batchPhotos.length})
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] border-border/50"
                        onClick={() => {
                          setPhotoTargetBatch(batch.id);
                          fileInputRef.current?.click();
                        }}
                      >
                        <Camera className="h-3 w-3 mr-1" />
                        Ambil Foto
                      </Button>
                    </div>
                    {batchPhotos.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {batchPhotos.map((photo, i) => (
                          <div key={i} className="relative rounded-lg overflow-hidden bg-secondary aspect-square">
                            <img src={photo.dataUrl} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-white px-1.5 py-0.5 text-center">
                              {photo.timestamp.toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">Belum ada foto. Gunakan tombol di atas untuk mengambil foto.</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2">Foto disimpan sementara di sesi ini.</p>
                  </div>

                  {/* Notes section */}
                  {batch.notes && (
                    <>
                      <Separator className="bg-border/30" />
                      <div>
                        <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Catatan</h4>
                        <p className="text-[13px] text-foreground">{batch.notes}</p>
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
