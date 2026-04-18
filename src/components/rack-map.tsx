"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HoleCell } from "@/components/hole-cell";
import { HoleDetailPanel } from "@/components/hole-detail-panel";
import { HOLE_STATUS, RACK_CONFIG, type HoleStatus } from "@/lib/constants";
import type { Hole, PlantingCycle, CropCatalog } from "@/lib/types/database";
import { toast } from "sonner";
import { MousePointerClick, X, Sprout, Camera } from "lucide-react";
import { useRef } from "react";

interface RackMapProps {
  holes: Hole[];
  cycles: (PlantingCycle & { crop_catalog: CropCatalog })[];
  crops: CropCatalog[];
}

export function RackMap({ holes, cycles, crops }: RackMapProps) {
  const router = useRouter();
  const supabase = createClient();

  // Single select (detail view)
  const [selectedHoleId, setSelectedHoleId] = useState<number | null>(null);

  // Multi-select mode
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<number>>(new Set());

  // Bulk planting dialog
  const [showBulkPlant, setShowBulkPlant] = useState(false);
  const [bulkCropId, setBulkCropId] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkPhotos, setBulkPhotos] = useState<{ dataUrl: string; timestamp: Date }[]>([]);
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk action (status update)
  const [bulkAction, setBulkAction] = useState("");
  const [showBulkAction, setShowBulkAction] = useState(false);
  const [bulkActionPhotos, setBulkActionPhotos] = useState<{ dataUrl: string; timestamp: Date }[]>([]);
  const [bulkActionErrors, setBulkActionErrors] = useState<Record<string, string>>({});
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const actionFileInputRef = useRef<HTMLInputElement>(null);

  // Drag select/deselect
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"select" | "deselect">("select");
  const [dragStartId, setDragStartId] = useState<number | null>(null);
  const [dragMoved, setDragMoved] = useState(false);

  function handleDragStart(id: number) {
    setDragStartId(id);
    setDragMoved(false);
    const isAlreadySelected = multiSelectedIds.has(id);
    setDragMode(isAlreadySelected ? "deselect" : "select");
  }

  function handleDragEnter(id: number) {
    if (dragStartId === null) return;
    if (id === dragStartId) return;

    // First move to a different cell — start the drag and apply to BOTH start + current
    if (!dragMoved) {
      setDragMoved(true);
      setIsDragging(true);
      setMultiSelectedIds((prev) => {
        const next = new Set(prev);
        if (dragMode === "deselect") { next.delete(dragStartId!); next.delete(id); }
        else { next.add(dragStartId!); next.add(id); }
        return next;
      });
      return;
    }

    // Subsequent cells during drag
    setMultiSelectedIds((prev) => {
      const next = new Set(prev);
      if (dragMode === "deselect") next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDragEnd() {
    setIsDragging(false);
    setDragStartId(null);
    setDragMoved(false);
  }

  const selectedHole = holes.find((h) => h.id === selectedHoleId) ?? null;
  const selectedCycle = selectedHole?.current_cycle_id
    ? cycles.find((c) => c.id === selectedHole.current_cycle_id) ?? null
    : null;

  const getHolesForLane = useCallback(
    (rack: string, tier: number, lane: number) =>
      holes.filter((h) => h.rack === rack && h.tier === tier && h.lane === lane),
    [holes]
  );

  const statusCounts = holes.reduce(
    (acc, h) => {
      acc[h.status as HoleStatus] = (acc[h.status as HoleStatus] || 0) + 1;
      return acc;
    },
    {} as Record<HoleStatus, number>
  );

  function handleCellClick(hole: Hole) {
    if (multiSelectMode) {
      setMultiSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(hole.id)) next.delete(hole.id);
        else next.add(hole.id);
        return next;
      });
    } else {
      setSelectedHoleId(hole.id);
    }
  }

  function exitMultiSelect() {
    setMultiSelectMode(false);
    setMultiSelectedIds(new Set());
    setBulkAction("");
  }

  // Determine what statuses are selected
  function getSelectedStatuses(): Set<HoleStatus> {
    const statuses = new Set<HoleStatus>();
    multiSelectedIds.forEach((id) => {
      const h = holes.find((x) => x.id === id);
      if (h) statuses.add(h.status as HoleStatus);
    });
    return statuses;
  }

  function openBulkPlant() {
    if (multiSelectedIds.size === 0) {
      toast.error("Pilih minimal 1 lubang");
      return;
    }
    setShowBulkPlant(true);
  }

  function handleBulkPhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBulkPhotos((prev) => [...prev, { dataUrl: reader.result as string, timestamp: new Date() }]);
      setBulkErrors((p) => ({ ...p, photos: "" }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function getCropDisplayName() {
    if (!bulkCropId) return undefined;
    const crop = crops.find((c) => String(c.id) === bulkCropId);
    return crop ? `${crop.name_id} (${crop.grow_duration_days} hari)` : undefined;
  }

  async function handleBulkPlant() {
    const errs: Record<string, string> = {};
    if (!bulkCropId) errs.crop = "Pilih komoditas";
    if (bulkPhotos.length === 0) errs.photos = "Ambil minimal 1 foto";
    if (Object.keys(errs).length > 0) { setBulkErrors(errs); return; }

    setBulkLoading(true);
    const crop = crops.find((c) => c.id === Number(bulkCropId));
    if (!crop) { setBulkLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();

    // Create batch
    const { data: batch, error: batchErr } = await supabase
      .from("batches")
      .insert({ crop_catalog_id: crop.id, notes: bulkNotes || null, created_by: user?.id })
      .select().single();

    if (batchErr || !batch) {
      toast.error("Gagal membuat batch");
      setBulkLoading(false);
      return;
    }

    const plantedAt = new Date();
    const expectedHarvest = new Date(plantedAt);
    expectedHarvest.setDate(expectedHarvest.getDate() + crop.grow_duration_days);

    const holeIds = Array.from(multiSelectedIds);
    const cycleInserts = holeIds.map((holeId) => ({
      hole_id: holeId,
      batch_id: batch.id,
      crop_catalog_id: crop.id,
      planted_at: plantedAt.toISOString(),
      expected_harvest_at: expectedHarvest.toISOString(),
      created_by: user?.id,
    }));

    const { data: newCycles, error: cycleErr } = await supabase
      .from("planting_cycles").insert(cycleInserts).select();

    if (cycleErr) {
      toast.error("Gagal membuat siklus tanam");
      setBulkLoading(false);
      return;
    }

    if (newCycles) {
      for (const cycle of newCycles) {
        await supabase.from("holes")
          .update({ status: "planted" as const, current_cycle_id: cycle.id })
          .eq("id", cycle.hole_id);
      }
    }

    toast.success(`Berhasil menanam ${holeIds.length} lubang — ${batch.batch_code}`);
    setShowBulkPlant(false);
    setBulkCropId("");
    setBulkNotes("");
    setBulkPhotos([]);
    setBulkErrors({});
    exitMultiSelect();
    setBulkLoading(false);
    router.refresh();
  }

  function handleBulkActionPhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBulkActionPhotos((prev) => [...prev, { dataUrl: reader.result as string, timestamp: new Date() }]);
      setBulkActionErrors((p) => ({ ...p, photos: "" }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleBulkActionSubmit() {
    const errs: Record<string, string> = {};
    if (bulkActionPhotos.length === 0) errs.photos = "Ambil minimal 1 foto";
    if (Object.keys(errs).length > 0) { setBulkActionErrors(errs); return; }

    setBulkActionLoading(true);
    const holeIds = Array.from(multiSelectedIds);
    const targetStatus = bulkAction as HoleStatus;

    // Update holes
    for (const holeId of holeIds) {
      await supabase.from("holes").update({ status: targetStatus }).eq("id", holeId);
      // Update cycle if exists
      const hole = holes.find((h) => h.id === holeId);
      if (hole?.current_cycle_id && (targetStatus === "planted" || targetStatus === "growing" || targetStatus === "ready_harvest")) {
        await supabase.from("planting_cycles").update({ status: targetStatus }).eq("id", hole.current_cycle_id);
      }
      if (targetStatus === "empty" && hole?.current_cycle_id) {
        await supabase.from("holes").update({ current_cycle_id: null }).eq("id", holeId);
      }
    }

    toast.success(`${holeIds.length} lubang diubah ke ${HOLE_STATUS[targetStatus].label}`);
    setShowBulkAction(false);
    setBulkAction("");
    setBulkActionPhotos([]);
    setBulkActionErrors({});
    exitMultiSelect();
    setBulkActionLoading(false);
    router.refresh();
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}>
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4">
        {Object.entries(HOLE_STATUS).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5 text-[12px]">
            <span className={`h-2.5 w-2.5 rounded ${config.dotColor}`} />
            <span className="text-muted-foreground">{config.label}</span>
            <span className="text-foreground font-medium">{statusCounts[key as HoleStatus] || 0}</span>
          </div>
        ))}
      </div>

      {/* Multi-select toolbar */}
      <div className="flex items-center justify-between mb-3">
        {multiSelectMode ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] text-[oklch(0.75_0.17_150)] font-medium">
              {multiSelectedIds.size} lubang dipilih
            </span>
            {/* Show "Tanam" if any empty holes selected */}
            {Array.from(multiSelectedIds).some((id) => holes.find((h) => h.id === id)?.status === "empty") && (
              <Button size="sm" className="h-8 text-[12px] bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white"
                onClick={openBulkPlant} disabled={multiSelectedIds.size === 0}>
                <Sprout className="h-3.5 w-3.5 mr-1" /> Tanam
              </Button>
            )}
            {/* Show "Ubah Status" dropdown for bulk status change */}
            <Select value={bulkAction} onValueChange={(v) => {
              if (v !== null) {
                setBulkAction(v);
                if (multiSelectedIds.size > 0) setShowBulkAction(true);
              }
            }}>
              <SelectTrigger className="h-8 bg-secondary border-border/50 text-[12px] w-[140px]">
                <SelectValue placeholder="Ubah Status...">{bulkAction ? HOLE_STATUS[bulkAction as HoleStatus]?.label : undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(HOLE_STATUS) as HoleStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${HOLE_STATUS[s].dotColor}`} />
                      {HOLE_STATUS[s].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-8 text-[12px] text-muted-foreground" onClick={exitMultiSelect}>
              <X className="h-3.5 w-3.5 mr-1" />
              Batal
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[12px] border-border/50"
            onClick={() => setMultiSelectMode(true)}
          >
            <MousePointerClick className="h-3.5 w-3.5 mr-1.5" />
            Pilih Beberapa Lubang
          </Button>
        )}
      </div>

      <Tabs defaultValue="A" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-10 bg-secondary border border-border/50">
          <TabsTrigger value="A" className="text-sm data-[state=active]:bg-[oklch(0.65_0.18_260)] data-[state=active]:text-white">Rak A</TabsTrigger>
          <TabsTrigger value="B" className="text-sm data-[state=active]:bg-[oklch(0.65_0.18_260)] data-[state=active]:text-white">Rak B</TabsTrigger>
        </TabsList>

        {RACK_CONFIG.racks.map((rack) => (
          <TabsContent key={rack} value={rack} className="mt-4 space-y-3">
            {[...RACK_CONFIG.tiers].reverse().map((tier) => (
              <div key={tier} className="rounded-lg border border-border/50 bg-card">
                <div className="px-4 py-2.5 border-b border-border/30 bg-secondary/30 flex items-center justify-between">
                  <h3 className="text-[13px] font-medium text-foreground">Tingkat {tier}</h3>
                  {multiSelectMode && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-muted-foreground"
                      onClick={() => {
                        const tierHoles = holes.filter((h) => h.rack === rack && h.tier === tier);
                        setMultiSelectedIds((prev) => {
                          const next = new Set(prev);
                          const allSelected = tierHoles.every((h) => next.has(h.id));
                          tierHoles.forEach((h) => allSelected ? next.delete(h.id) : next.add(h.id));
                          return next;
                        });
                      }}
                    >
                      Pilih Semua Tingkat
                    </Button>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  {RACK_CONFIG.lanes.map((lane) => {
                    const laneHoles = getHolesForLane(rack, tier, lane);
                    return (
                      <div key={lane} className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground w-6 shrink-0 font-medium">L{lane}</span>
                        <div className="flex-1 overflow-x-auto scrollbar-none">
                          <div className="flex gap-1 min-w-max">
                            {laneHoles
                              .sort((a, b) => a.hole_number - b.hole_number)
                              .map((hole) => (
                                <HoleCell
                                  key={hole.id}
                                  holeId={hole.id}
                                  holeNumber={hole.hole_number}
                                  status={hole.status as HoleStatus}
                                  isSelected={selectedHoleId === hole.id}
                                  isMultiSelected={multiSelectedIds.has(hole.id)}
                                  multiSelectMode={multiSelectMode}
                                  onClick={() => handleCellClick(hole)}
                                  onDragStart={handleDragStart}
                                  onDragEnter={handleDragEnter}
                                />
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </TabsContent>
        ))}
      </Tabs>
      </div>{/* end drag container */}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleBulkPhotoCapture} />

      {/* Single hole detail */}
      <HoleDetailPanel
        hole={selectedHole}
        cycle={selectedCycle}
        crops={crops}
        open={selectedHoleId !== null && !multiSelectMode}
        onClose={() => setSelectedHoleId(null)}
      />

      {/* Bulk planting dialog */}
      <Dialog open={showBulkPlant} onOpenChange={(v) => { if (!v) setShowBulkPlant(false); }}>
        <DialogContent showCloseButton={true} className="sm:max-w-[420px] bg-card border-border/50 p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-base font-semibold text-foreground">
              Tanam {multiSelectedIds.size} Lubang Sekaligus
            </DialogTitle>
            <p className="text-[12px] text-muted-foreground mt-1">
              {Array.from(multiSelectedIds).slice(0, 5).map((id) => {
                const h = holes.find((x) => x.id === id);
                return h?.canonical_id;
              }).join(", ")}
              {multiSelectedIds.size > 5 && ` +${multiSelectedIds.size - 5} lainnya`}
            </p>
          </DialogHeader>
          <Separator className="bg-border/30" />
          <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Crop */}
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Komoditas <span className="text-destructive">*</span></Label>
              <Select value={bulkCropId} onValueChange={(v) => { if (v !== null) { setBulkCropId(v); setBulkErrors((p) => ({ ...p, crop: "" })); } }}>
                <SelectTrigger className={`h-11 bg-secondary border-border/50 ${bulkErrors.crop ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Pilih komoditas...">{getCropDisplayName()}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {crops.map((crop) => (
                    <SelectItem key={crop.id} value={String(crop.id)}>
                      {crop.name_id} ({crop.grow_duration_days} hari)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bulkErrors.crop && <p className="text-[11px] text-destructive">{bulkErrors.crop}</p>}
            </div>

            {/* Photo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] text-muted-foreground">Foto <span className="text-destructive">*</span></Label>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] border-border/50"
                  onClick={() => fileInputRef.current?.click()}>
                  <Camera className="h-3 w-3 mr-1" /> Ambil Foto
                </Button>
              </div>
              {bulkPhotos.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {bulkPhotos.map((p, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden bg-secondary aspect-square group">
                      <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setBulkPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-2.5 w-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-[11px] ${bulkErrors.photos ? "text-destructive" : "text-muted-foreground"}`}>
                  {bulkErrors.photos || "Ambil minimal 1 foto sebagai bukti."}
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Catatan (opsional)</Label>
              <Textarea className="bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50"
                placeholder="Catatan penanaman..." value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} rows={2} />
            </div>

            <Button className="w-full h-11 bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white"
              onClick={handleBulkPlant} disabled={bulkLoading}>
              {bulkLoading ? "Memproses..." : `Tanam ${multiSelectedIds.size} Lubang`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for bulk action photos */}
      <input ref={actionFileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleBulkActionPhotoCapture} />

      {/* Bulk action (status change) dialog */}
      <Dialog open={showBulkAction} onOpenChange={(v) => { if (!v) { setShowBulkAction(false); setBulkAction(""); setBulkActionPhotos([]); setBulkActionErrors({}); } }}>
        <DialogContent showCloseButton={true} className="sm:max-w-[420px] bg-card border-border/50 p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-base font-semibold text-foreground">
              Ubah {multiSelectedIds.size} Lubang ke {HOLE_STATUS[bulkAction as HoleStatus]?.label ?? ""}
            </DialogTitle>
            <p className="text-[12px] text-muted-foreground mt-1">
              {Array.from(multiSelectedIds).slice(0, 5).map((id) => holes.find((x) => x.id === id)?.canonical_id).join(", ")}
              {multiSelectedIds.size > 5 && ` +${multiSelectedIds.size - 5} lainnya`}
            </p>
          </DialogHeader>
          <Separator className="bg-border/30" />
          <div className="px-5 py-4 space-y-4">
            {/* Photo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] text-muted-foreground">Foto Konfirmasi <span className="text-destructive">*</span></Label>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] border-border/50"
                  onClick={() => actionFileInputRef.current?.click()}>
                  <Camera className="h-3 w-3 mr-1" /> Ambil Foto
                </Button>
              </div>
              {bulkActionPhotos.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {bulkActionPhotos.map((p, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden bg-secondary aspect-square group">
                      <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setBulkActionPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-2.5 w-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-[11px] ${bulkActionErrors.photos ? "text-destructive" : "text-muted-foreground"}`}>
                  {bulkActionErrors.photos || "Ambil minimal 1 foto sebagai bukti."}
                </p>
              )}
            </div>

            <Button className="w-full h-11 bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white"
              onClick={handleBulkActionSubmit} disabled={bulkActionLoading}>
              {bulkActionLoading ? "Memproses..." : `Ubah ${multiSelectedIds.size} Lubang`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
