"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Separator } from "@/components/ui/separator";
import type { Hole, PlantingCycle, CropCatalog } from "@/lib/types/database";
import type { HoleStatus } from "@/lib/constants";
import { HOLE_STATUS, QUALITY_GRADES, VISUAL_CONDITIONS, POST_HARVEST_HANDLING } from "@/lib/constants";
import { toast } from "sonner";
import { Sprout, Leaf, Scissors, Wrench, CheckCircle, ArrowLeft, Camera, X } from "lucide-react";

interface HoleDetailPanelProps {
  hole: Hole | null;
  cycle: (PlantingCycle & { crop_catalog?: CropCatalog }) | null;
  crops: CropCatalog[];
  open: boolean;
  onClose: () => void;
}

type PanelView = "detail" | "plant";

export function HoleDetailPanel({ hole, cycle, crops, open, onClose }: HoleDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<PanelView>("detail");
  const router = useRouter();
  const supabase = createClient();

  // Planting form state
  const [selectedCropId, setSelectedCropId] = useState("");
  const [plantNotes, setPlantNotes] = useState("");
  const [plantPhotos, setPlantPhotos] = useState<{ dataUrl: string; timestamp: Date }[]>([]);
  const [plantErrors, setPlantErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Action confirmation state
  const [actionView, setActionView] = useState<string | null>(null);
  const [actionPhotos, setActionPhotos] = useState<{ dataUrl: string; timestamp: Date }[]>([]);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [harvestWeight, setHarvestWeight] = useState("");
  const [harvestGrade, setHarvestGrade] = useState("");
  const [harvestVisual, setHarvestVisual] = useState("");
  const [harvestHandling, setHarvestHandling] = useState("");
  const [harvestDetailNotes, setHarvestDetailNotes] = useState("");
  const [harvestEarlyReason, setHarvestEarlyReason] = useState("");

  if (!hole) return null;

  function handleClose() {
    setView("detail");
    setSelectedCropId("");
    setPlantNotes("");
    setPlantPhotos([]);
    setPlantErrors({});
    setActionView(null);
    setActionPhotos([]);
    setActionErrors({});
    setHarvestWeight("");
    setHarvestGrade("");
    setHarvestVisual("");
    setHarvestHandling("");
    setHarvestDetailNotes("");
    setHarvestEarlyReason("");
    onClose();
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (actionView) {
        setActionPhotos((prev) => [...prev, { dataUrl: reader.result as string, timestamp: new Date() }]);
        setActionErrors((prev) => ({ ...prev, photos: "" }));
      } else {
        setPlantPhotos((prev) => [...prev, { dataUrl: reader.result as string, timestamp: new Date() }]);
        setPlantErrors((prev) => ({ ...prev, photos: "" }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function updateHoleStatus(newStatus: HoleStatus) {
    if (!hole) return;
    setLoading(true);
    const { error } = await supabase
      .from("holes")
      .update({ status: newStatus })
      .eq("id", hole.id);

    if (error) {
      toast.error("Gagal mengubah status: " + error.message);
    } else {
      toast.success(`Status diubah ke ${HOLE_STATUS[newStatus].label}`);
      router.refresh();
    }
    setLoading(false);
  }

  async function updateCycleStatus(newStatus: "growing" | "ready_harvest") {
    if (!hole || !cycle) return;
    setLoading(true);

    const holeStatusMap: Record<string, HoleStatus> = {
      growing: "growing",
      ready_harvest: "ready_harvest",
    };

    await supabase.from("planting_cycles").update({ status: newStatus }).eq("id", cycle.id);
    await supabase.from("holes").update({ status: holeStatusMap[newStatus] }).eq("id", hole.id);

    toast.success(`Status diubah ke ${HOLE_STATUS[holeStatusMap[newStatus]].label}`);
    router.refresh();
    setLoading(false);
  }

  async function handlePlant() {
    const errs: Record<string, string> = {};
    if (!selectedCropId) errs.crop = "Pilih komoditas";
    if (plantPhotos.length === 0) errs.photos = "Ambil minimal 1 foto";
    if (Object.keys(errs).length > 0) {
      setPlantErrors(errs);
      return;
    }
    if (!hole) return;

    setLoading(true);
    const crop = crops.find((c) => c.id === Number(selectedCropId));
    if (!crop) { setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();

    // Create batch
    const { data: batch, error: batchErr } = await supabase
      .from("batches")
      .insert({ crop_catalog_id: crop.id, notes: plantNotes || null, created_by: user?.id })
      .select()
      .single();

    if (batchErr || !batch) {
      toast.error("Gagal membuat batch");
      setLoading(false);
      return;
    }

    const plantedAt = new Date();
    const expectedHarvest = new Date(plantedAt);
    expectedHarvest.setDate(expectedHarvest.getDate() + crop.grow_duration_days);

    // Create cycle
    const { data: newCycle, error: cycleErr } = await supabase
      .from("planting_cycles")
      .insert({
        hole_id: hole.id,
        batch_id: batch.id,
        crop_catalog_id: crop.id,
        planted_at: plantedAt.toISOString(),
        expected_harvest_at: expectedHarvest.toISOString(),
        created_by: user?.id,
      })
      .select()
      .single();

    if (cycleErr || !newCycle) {
      toast.error("Gagal membuat siklus tanam");
      setLoading(false);
      return;
    }

    // Update hole
    await supabase
      .from("holes")
      .update({ status: "planted" as const, current_cycle_id: newCycle.id })
      .eq("id", hole.id);

    toast.success(`Berhasil menanam ${crop.name_id} di ${hole.canonical_id}`);
    setView("detail");
    setSelectedCropId("");
    setPlantNotes("");
    router.refresh();
    setLoading(false);
  }

  const ACTION_NAMES: Record<string, string> = {
    planted: "Ubah ke Ditanam",
    growing: "Tandai Tumbuh",
    ready_harvest: "Tandai Siap Panen",
    harvest: "Catat Panen",
    maintenance: "Mode Perawatan",
    end_maintenance: "Selesai Perawatan",
    empty: "Kosongkan Lubang",
  };

  function resetActionView() {
    setActionView(null);
    setActionPhotos([]);
    setActionErrors({});
    setHarvestWeight("");
    setHarvestGrade("");
    setHarvestVisual("");
    setHarvestHandling("");
    setHarvestDetailNotes("");
    setHarvestEarlyReason("");
  }

  async function handleActionConfirm() {
    if (!actionView) return;

    const errs: Record<string, string> = {};
    if (actionPhotos.length === 0) errs.photos = "Ambil minimal 1 foto";
    if (actionView === "harvest") {
      if (!harvestWeight) errs.weight = "Masukkan berat panen";
      if (!harvestGrade) errs.grade = "Pilih grade";
    }
    if (Object.keys(errs).length > 0) {
      setActionErrors(errs);
      return;
    }

    setLoading(true);

    if (actionView === "planted" || actionView === "growing" || actionView === "ready_harvest") {
      // Update cycle status + hole status
      if (cycle) {
        await supabase.from("planting_cycles").update({ status: actionView as "planted" | "growing" | "ready_harvest" }).eq("id", cycle.id);
      }
      await supabase.from("holes").update({ status: actionView as HoleStatus }).eq("id", hole!.id);
      toast.success(`Status diubah ke ${HOLE_STATUS[actionView as HoleStatus].label}`);
      router.refresh();
    } else if (actionView === "harvest") {
      if (!hole || !cycle) { setLoading(false); return; }

      await supabase.from("planting_cycles").update({
        status: "harvested",
        harvested_at: new Date().toISOString(),
        harvest_weight_g: Number(harvestWeight),
        quality_grade: harvestGrade,
        visual_condition: harvestVisual || null,
        post_harvest_handling: harvestHandling || null,
        harvest_notes: harvestDetailNotes || null,
        early_harvest_reason: harvestEarlyReason || null,
      }).eq("id", cycle.id);

      await supabase.from("holes").update({ status: "harvested" as HoleStatus, current_cycle_id: null }).eq("id", hole.id);

      toast.success("Panen berhasil dicatat");
      router.refresh();
    } else if (actionView === "maintenance") {
      await updateHoleStatus("maintenance");
    } else if (actionView === "end_maintenance" || actionView === "empty") {
      await updateHoleStatus("empty");
    }

    setLoading(false);
    resetActionView();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent showCloseButton={true} className="sm:max-w-[420px] bg-card border-border/50 p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            {view === "plant" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground -ml-1"
                onClick={() => setView("detail")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                {view === "detail" ? hole.canonical_id : `Tanam di ${hole.canonical_id}`}
              </DialogTitle>
              {view === "detail" && (
                <div className="mt-1.5">
                  <StatusBadge status={hole.status as HoleStatus} />
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <Separator className="bg-border/30" />

        {/* Shared hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {view === "detail" ? (
            <>
              {/* Location info */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Rak", value: hole.rack },
                  { label: "Tingkat", value: hole.tier },
                  { label: "Lajur", value: hole.lane },
                  { label: "Lubang", value: `#${hole.hole_number}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-secondary/50 p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Active cycle info */}
              {cycle && (
                <>
                  <Separator className="bg-border/30" />
                  <div>
                    <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Siklus Tanam Aktif</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-secondary/50 p-2.5">
                        <p className="text-[10px] text-muted-foreground">Komoditas</p>
                        <p className="text-[13px] font-medium text-foreground">{cycle.crop_catalog?.name_id ?? "-"}</p>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-2.5">
                        <p className="text-[10px] text-muted-foreground">Ditanam</p>
                        <p className="text-[13px] font-medium text-foreground">
                          {new Date(cycle.planted_at).toLocaleDateString("id-ID")}
                        </p>
                      </div>
                      {cycle.expected_harvest_at && (
                        <div className="rounded-lg bg-secondary/50 p-2.5 col-span-2">
                          <p className="text-[10px] text-muted-foreground">Target Panen</p>
                          <p className="text-[13px] font-medium text-foreground">
                            {new Date(cycle.expected_harvest_at).toLocaleDateString("id-ID")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Actions */}
              <Separator className="bg-border/30" />
              <div>
                <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Aksi</h4>
                <div className="flex flex-col gap-2">
                  {/* Primary action based on current status */}
                  {hole.status === "empty" && (
                    <Button className="h-11 bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white"
                      onClick={() => setView("plant")}>
                      <Sprout className="h-4 w-4 mr-2" /> Mulai Tanam
                    </Button>
                  )}
                  {hole.status === "planted" && (
                    <Button className="h-11 bg-[oklch(0.45_0.16_150)] hover:bg-[oklch(0.50_0.18_150)] text-white"
                      onClick={() => setActionView("growing")} disabled={loading || actionView !== null}>
                      <Leaf className="h-4 w-4 mr-2" /> Tandai Tumbuh
                    </Button>
                  )}
                  {hole.status === "growing" && (
                    <Button className="h-11 bg-[oklch(0.55_0.15_80)] hover:bg-[oklch(0.60_0.17_80)] text-white"
                      onClick={() => setActionView("ready_harvest")} disabled={loading || actionView !== null}>
                      <Leaf className="h-4 w-4 mr-2" /> Siap Panen
                    </Button>
                  )}
                  {hole.status === "ready_harvest" && (
                    <Button className="h-11 bg-[oklch(0.50_0.12_180)] hover:bg-[oklch(0.55_0.14_180)] text-white"
                      onClick={() => setActionView("harvest")} disabled={loading || actionView !== null}>
                      <Scissors className="h-4 w-4 mr-2" /> Catat Panen
                    </Button>
                  )}

                  {/* Flexible status change — always shown for non-empty holes */}
                  {hole.status !== "empty" && (
                    <div className="rounded-lg bg-secondary/30 p-2.5 mt-1">
                      <p className="text-[11px] text-muted-foreground mb-2">Ubah status manual:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(["planted", "growing", "ready_harvest", "maintenance", "empty"] as HoleStatus[])
                          .filter((s) => s !== hole.status)
                          .map((targetStatus) => (
                            <Button
                              key={targetStatus}
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] border-border/50 px-2"
                              disabled={loading || actionView !== null}
                              onClick={() => setActionView(targetStatus === "empty" ? "end_maintenance" : targetStatus)}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full mr-1 ${HOLE_STATUS[targetStatus].dotColor}`} />
                              {HOLE_STATUS[targetStatus].label}
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Action confirmation mini-form */}
                  {actionView && (
                    <div className="rounded-lg bg-secondary/30 p-3 space-y-3 mt-2">
                      <p className="text-[12px] font-medium text-foreground">
                        Konfirmasi: {ACTION_NAMES[actionView]}
                      </p>

                      {/* Photo capture */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[13px] text-muted-foreground">
                            Ambil Foto <span className="text-destructive">*</span>
                          </Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] border-border/50"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Camera className="h-3 w-3 mr-1" />
                            Ambil Foto
                          </Button>
                        </div>
                        {actionPhotos.length > 0 ? (
                          <div className="grid grid-cols-4 gap-1.5">
                            {actionPhotos.map((photo, i) => (
                              <div key={i} className="relative rounded-lg overflow-hidden bg-secondary aspect-square group">
                                <img src={photo.dataUrl} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setActionPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-2.5 w-2.5 text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={`text-[11px] ${actionErrors.photos ? "text-destructive" : "text-muted-foreground"}`}>
                            {actionErrors.photos || "Ambil minimal 1 foto sebagai bukti."}
                          </p>
                        )}
                      </div>

                      {/* Harvest-specific fields */}
                      {actionView === "harvest" && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-[13px] text-muted-foreground">
                              Berat Panen (gram) <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              type="number"
                              placeholder="Contoh: 250"
                              className={`h-9 bg-secondary border-border/50 text-[12px] ${actionErrors.weight ? "border-destructive" : ""}`}
                              value={harvestWeight}
                              onChange={(e) => { setHarvestWeight(e.target.value); setActionErrors((p) => ({ ...p, weight: "" })); }}
                            />
                            {actionErrors.weight && <p className="text-[11px] text-destructive">{actionErrors.weight}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[13px] text-muted-foreground">
                              Grade <span className="text-destructive">*</span>
                            </Label>
                            <Select value={harvestGrade} onValueChange={(v) => { if (v !== null) { setHarvestGrade(v); setActionErrors((p) => ({ ...p, grade: "" })); } }}>
                              <SelectTrigger className={`h-9 bg-secondary border-border/50 text-[12px] ${actionErrors.grade ? "border-destructive" : ""}`}>
                                <SelectValue placeholder="Grade">{harvestGrade ? `Grade ${harvestGrade}` : undefined}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {QUALITY_GRADES.map((g) => (
                                  <SelectItem key={g.value} value={g.value}>
                                    {g.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {actionErrors.grade && <p className="text-[11px] text-destructive">{actionErrors.grade}</p>}
                          </div>

                          {/* Visual condition */}
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Kondisi Visual</Label>
                            <Select value={harvestVisual} onValueChange={(v) => v !== null && setHarvestVisual(v)}>
                              <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px]">
                                <SelectValue placeholder="Pilih kondisi...">{harvestVisual ? VISUAL_CONDITIONS.find(c => c.value === harvestVisual)?.label : undefined}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {VISUAL_CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Post harvest handling */}
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Penanganan Pasca Panen</Label>
                            <Select value={harvestHandling} onValueChange={(v) => v !== null && setHarvestHandling(v)}>
                              <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px]">
                                <SelectValue placeholder="Pilih penanganan...">{harvestHandling ? POST_HARVEST_HANDLING.find(c => c.value === harvestHandling)?.label : undefined}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {POST_HARVEST_HANDLING.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Harvest notes */}
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Catatan Panen</Label>
                            <Textarea className="bg-secondary border-border/50 text-[12px]" rows={2} placeholder="Observasi saat panen..."
                              value={harvestDetailNotes} onChange={(e) => setHarvestDetailNotes(e.target.value)} />
                          </div>

                          {/* Early harvest reason — shown only if harvesting before expected date */}
                          {cycle && cycle.expected_harvest_at && new Date() < new Date(cycle.expected_harvest_at) && (
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Alasan Panen Dini</Label>
                              <Textarea className="bg-secondary border-border/50 text-[12px]" rows={2} placeholder="Mengapa dipanen sebelum target..."
                                value={harvestEarlyReason} onChange={(e) => setHarvestEarlyReason(e.target.value)} />
                            </div>
                          )}
                        </>
                      )}

                      {/* Confirm / Cancel buttons */}
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 h-9 bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white"
                          onClick={handleActionConfirm}
                          disabled={loading}
                        >
                          {loading ? "Memproses..." : "Konfirmasi"}
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-9"
                          onClick={resetActionView}
                          disabled={loading}
                        >
                          Batal
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* ========== INLINE PLANTING FORM ========== */
            <div className="space-y-4">
              {/* Crop selection */}
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">
                  Komoditas <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedCropId} onValueChange={(v) => { if (v !== null) { setSelectedCropId(v); setPlantErrors((p) => ({ ...p, crop: "" })); } }}>
                  <SelectTrigger className={`h-11 bg-secondary border-border/50 ${plantErrors.crop ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Pilih komoditas...">
                      {selectedCropId
                        ? (() => {
                            const c = crops.find((cr) => String(cr.id) === selectedCropId);
                            return c ? `${c.name_id} (${c.grow_duration_days} hari)` : selectedCropId;
                          })()
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {crops.map((crop) => (
                      <SelectItem key={crop.id} value={String(crop.id)}>
                        {crop.name_id} ({crop.grow_duration_days} hari)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {plantErrors.crop && <p className="text-[11px] text-destructive">{plantErrors.crop}</p>}
              </div>

              {/* Crop info preview */}
              {selectedCropId && (() => {
                const crop = crops.find((c) => c.id === Number(selectedCropId));
                if (!crop) return null;
                return (
                  <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
                    <p className="text-[12px] font-medium text-foreground">{crop.name_id}</p>
                    {crop.name_latin && (
                      <p className="text-[11px] italic text-muted-foreground">{crop.name_latin}</p>
                    )}
                    <div className="flex gap-4 text-[11px] text-muted-foreground mt-1">
                      <span>Durasi: {crop.grow_duration_days} hari</span>
                      {crop.ec_min !== null && crop.ec_max !== null && (
                        <span>EC: {crop.ec_min}–{crop.ec_max}</span>
                      )}
                      {crop.ph_min !== null && crop.ph_max !== null && (
                        <span>pH: {crop.ph_min}–{crop.ph_max}</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Photo capture */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[13px] text-muted-foreground">
                    Foto Dokumentasi <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] border-border/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-3 w-3 mr-1" />
                    Ambil Foto
                  </Button>
                </div>
                {plantPhotos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {plantPhotos.map((photo, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden bg-secondary aspect-square group">
                        <img src={photo.dataUrl} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPlantPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-2.5 w-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-[11px] ${plantErrors.photos ? "text-destructive" : "text-muted-foreground"}`}>
                    {plantErrors.photos || "Ambil minimal 1 foto sebagai bukti."}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">Catatan (opsional)</Label>
                <Textarea
                  className="bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="Catatan penanaman..."
                  value={plantNotes}
                  onChange={(e) => setPlantNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                className="w-full h-11 bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white"
                onClick={handlePlant}
                disabled={loading}
              >
                {loading ? "Memproses..." : "Mulai Tanam"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
