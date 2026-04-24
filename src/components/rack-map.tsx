"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/role-gate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HoleCell } from "@/components/hole-cell";
import { HoleDetailPanel } from "@/components/hole-detail-panel";
import { HOLE_STATUS, RACK_CONFIG, type HoleStatus } from "@/lib/constants";
import type { Hole, PlantingCycle, CropCatalog } from "@/lib/types/database";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";
import { MousePointerClick, X, Sprout, Camera, ChevronLeft, ChevronRight, Check, RotateCcw } from "lucide-react";
import { useRef } from "react";

interface RackMapProps {
  holes: Hole[];
  cycles: (PlantingCycle & { crop_catalog: CropCatalog })[];
  crops: CropCatalog[];
  researchAllocations?: Record<number, string>;   // holeId -> tooltip text
}

export function RackMap({ holes, cycles, crops, researchAllocations = {} }: RackMapProps) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLang();

  // Single select (detail view)
  const [selectedHoleId, setSelectedHoleId] = useState<number | null>(null);

  // Multi-select mode
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<number>>(new Set());

  // Bulk planting dialog — multi-step flow: setup → capture → review
  type BulkPhoto = { dataUrl: string; file: File; timestamp: Date };
  const [showBulkPlant, setShowBulkPlant] = useState(false);
  const [bulkStep, setBulkStep] = useState<"setup" | "capture" | "review">("setup");
  const [bulkCaptureIndex, setBulkCaptureIndex] = useState(0);
  const [bulkCropId, setBulkCropId] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkPhotoMap, setBulkPhotoMap] = useState<Map<number, BulkPhoto>>(new Map());
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stable ordered list of selected hole IDs (sorted by canonical_id).
  const bulkOrderedHoleIds = Array.from(multiSelectedIds)
    .map((id) => holes.find((h) => h.id === id))
    .filter((h): h is Hole => !!h)
    .sort((a, b) => a.canonical_id.localeCompare(b.canonical_id, undefined, { numeric: true }))
    .map((h) => h.id);

  function resetBulkPlant() {
    setBulkStep("setup");
    setBulkCaptureIndex(0);
    setBulkCropId("");
    setBulkNotes("");
    setBulkPhotoMap(new Map());
    setBulkErrors({});
  }

  // Bulk action (status update) — per-hole photo flow (capture → review)
  const [bulkAction, setBulkAction] = useState("");
  const [showBulkAction, setShowBulkAction] = useState(false);
  const [bulkActionStep, setBulkActionStep] = useState<"capture" | "review">("capture");
  const [bulkActionCaptureIndex, setBulkActionCaptureIndex] = useState(0);
  const [bulkActionPhotoMap, setBulkActionPhotoMap] = useState<Map<number, BulkPhoto>>(new Map());
  const [bulkActionErrors, setBulkActionErrors] = useState<Record<string, string>>({});
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const actionFileInputRef = useRef<HTMLInputElement>(null);

  const bulkActionOrderedHoleIds = bulkOrderedHoleIds; // same ordering as plant flow

  function resetBulkAction() {
    setBulkAction("");
    setBulkActionStep("capture");
    setBulkActionCaptureIndex(0);
    setBulkActionPhotoMap(new Map());
    setBulkActionErrors({});
  }

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
      toast.error(t("rmap.select_min_one"));
      return;
    }
    resetBulkPlant();
    setShowBulkPlant(true);
  }

  function handleBulkPhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetHoleId = bulkOrderedHoleIds[bulkCaptureIndex];
    if (!targetHoleId) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBulkPhotoMap((prev) => {
        const next = new Map(prev);
        next.set(targetHoleId, {
          dataUrl: reader.result as string,
          file,
          timestamp: new Date(),
        });
        return next;
      });
      setBulkErrors((p) => ({ ...p, photos: "" }));
      // Auto-advance to next uncaptured hole
      setTimeout(() => {
        const nextIdx = findNextUncapturedIndex(bulkCaptureIndex, targetHoleId);
        if (nextIdx !== -1) setBulkCaptureIndex(nextIdx);
        else setBulkStep("review");
      }, 600);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function findNextUncapturedIndex(fromIdx: number, justCapturedId: number): number {
    for (let i = fromIdx + 1; i < bulkOrderedHoleIds.length; i++) {
      const id = bulkOrderedHoleIds[i];
      if (id !== justCapturedId && !bulkPhotoMap.has(id)) return i;
    }
    for (let i = 0; i < fromIdx; i++) {
      const id = bulkOrderedHoleIds[i];
      if (!bulkPhotoMap.has(id)) return i;
    }
    return -1;
  }

  function retakePhoto(holeId: number) {
    setBulkPhotoMap((prev) => {
      const next = new Map(prev);
      next.delete(holeId);
      return next;
    });
    const idx = bulkOrderedHoleIds.indexOf(holeId);
    if (idx >= 0) {
      setBulkCaptureIndex(idx);
      setBulkStep("capture");
    }
  }

  function getCropDisplayName() {
    if (!bulkCropId) return undefined;
    const crop = crops.find((c) => String(c.id) === bulkCropId);
    return crop ? `${crop.name_id} (${crop.grow_duration_days} ${t("unit.days")})` : undefined;
  }

  async function handleBulkPlant() {
    const errs: Record<string, string> = {};
    if (!bulkCropId) errs.crop = t("rmap.choose_commodity");
    const missingPhotos = bulkOrderedHoleIds.filter((id) => !bulkPhotoMap.has(id));
    if (missingPhotos.length > 0) errs.photos = t("rmap.n_holes_no_photo").replace("{n}", String(missingPhotos.length));
    if (Object.keys(errs).length > 0) { setBulkErrors(errs); return; }

    setBulkLoading(true);
    const crop = crops.find((c) => c.id === Number(bulkCropId));
    if (!crop) { setBulkLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();

    // 1. Create batch
    const { data: batch, error: batchErr } = await supabase
      .from("batches")
      .insert({ crop_catalog_id: crop.id, notes: bulkNotes || null, created_by: user?.id })
      .select().single();

    if (batchErr || !batch) {
      console.error("[bulk-plant] batch insert failed:", batchErr);
      toast.error(`${t("rmap.create_batch_failed")} ${batchErr?.message ?? "unknown"}`);
      setBulkLoading(false);
      return;
    }

    // 2. Create cycles
    const plantedAt = new Date();
    const expectedHarvest = new Date(plantedAt);
    expectedHarvest.setDate(expectedHarvest.getDate() + crop.grow_duration_days);

    const cycleInserts = bulkOrderedHoleIds.map((holeId) => ({
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
      const e = cycleErr as { message?: string; details?: string; hint?: string; code?: string };
      console.error(`[bulk-plant] cycle insert failed: code=${e.code} message=${e.message} details=${e.details} hint=${e.hint}`, { cycleInserts });
      toast.error(`${t("rmap.create_cycle_failed")} ${e.message ?? e.details ?? "unknown"}`);
      setBulkLoading(false);
      return;
    }

    // 3. Upload each photo to Storage + insert planting_photos row
    const photoRows: { cycle_id: number; storage_path: string; captured_at: string; captured_by: string | null }[] = [];
    const uploadErrors: string[] = [];

    await Promise.all((newCycles ?? []).map(async (cycle) => {
      const photo = bulkPhotoMap.get(cycle.hole_id);
      if (!photo) return;
      const ext = photo.file.name.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `${cycle.id}/${photo.timestamp.getTime()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("planting-photos")
        .upload(storagePath, photo.file, { contentType: photo.file.type || "image/jpeg", upsert: false });
      if (uploadErr) {
        console.error(`[bulk-plant] upload failed cycle=${cycle.id}:`, uploadErr);
        uploadErrors.push(`${cycle.hole_id}: ${uploadErr.message}`);
        return;
      }
      photoRows.push({
        cycle_id: cycle.id,
        storage_path: storagePath,
        captured_at: photo.timestamp.toISOString(),
        captured_by: user?.id ?? null,
      });
    }));

    if (photoRows.length > 0) {
      const { error: photoErr } = await supabase.from("planting_photos").insert(photoRows);
      if (photoErr) {
        console.error("[bulk-plant] planting_photos insert failed:", photoErr);
        uploadErrors.push(`DB: ${photoErr.message}`);
      }
    }

    // 4. Sync holes (redundant with trigger, but safe)
    if (newCycles) {
      for (const cycle of newCycles) {
        await supabase.from("holes")
          .update({ status: "planted" as const, current_cycle_id: cycle.id })
          .eq("id", cycle.hole_id);
      }
    }

    if (uploadErrors.length > 0) {
      toast.warning(t("rmap.bulk_plant_partial").replace("{n}", String(uploadErrors.length)));
    } else {
      toast.success(t("rmap.bulk_plant_success").replace("{n}", String(bulkOrderedHoleIds.length)).replace("{batch}", batch.batch_code));
    }

    setShowBulkPlant(false);
    resetBulkPlant();
    exitMultiSelect();
    setBulkLoading(false);
    router.refresh();
  }

  function handleBulkActionPhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetHoleId = bulkActionOrderedHoleIds[bulkActionCaptureIndex];
    if (!targetHoleId) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBulkActionPhotoMap((prev) => {
        const next = new Map(prev);
        next.set(targetHoleId, {
          dataUrl: reader.result as string,
          file,
          timestamp: new Date(),
        });
        return next;
      });
      setBulkActionErrors((p) => ({ ...p, photos: "" }));
      setTimeout(() => {
        const nextIdx = findNextUncapturedIndexInMap(bulkActionPhotoMap, bulkActionOrderedHoleIds, bulkActionCaptureIndex, targetHoleId);
        if (nextIdx !== -1) setBulkActionCaptureIndex(nextIdx);
        else setBulkActionStep("review");
      }, 600);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function retakeActionPhoto(holeId: number) {
    setBulkActionPhotoMap((prev) => {
      const next = new Map(prev);
      next.delete(holeId);
      return next;
    });
    const idx = bulkActionOrderedHoleIds.indexOf(holeId);
    if (idx >= 0) {
      setBulkActionCaptureIndex(idx);
      setBulkActionStep("capture");
    }
  }

  async function handleBulkActionSubmit() {
    const missing = bulkActionOrderedHoleIds.filter((id) => !bulkActionPhotoMap.has(id));
    if (missing.length > 0) {
      setBulkActionErrors({ photos: t("rmap.n_holes_no_photo").replace("{n}", String(missing.length)) });
      return;
    }

    setBulkActionLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const targetStatus = bulkAction as HoleStatus;
    const photoKind: "planting" | "maintenance" | "harvest" =
      targetStatus === "harvested" ? "harvest" : "maintenance";

    // 1. Update holes & cycles
    const cycleIdsByHole = new Map<number, number>();
    for (const holeId of bulkActionOrderedHoleIds) {
      const hole = holes.find((h) => h.id === holeId);
      await supabase.from("holes").update({ status: targetStatus }).eq("id", holeId);
      if (hole?.current_cycle_id) {
        cycleIdsByHole.set(holeId, hole.current_cycle_id);
        if (targetStatus === "planted" || targetStatus === "growing" || targetStatus === "ready_harvest") {
          await supabase.from("planting_cycles").update({ status: targetStatus }).eq("id", hole.current_cycle_id);
        }
      }
      if (targetStatus === "empty" && hole?.current_cycle_id) {
        await supabase.from("holes").update({ current_cycle_id: null }).eq("id", holeId);
      }
    }

    // 2. Upload photos for holes that have an attached cycle
    const photoRows: { cycle_id: number; storage_path: string; kind: "planting" | "maintenance" | "harvest"; captured_at: string; captured_by: string | null }[] = [];
    const uploadErrors: string[] = [];
    let skippedNoCycle = 0;

    await Promise.all(bulkActionOrderedHoleIds.map(async (holeId) => {
      const photo = bulkActionPhotoMap.get(holeId);
      const cycleId = cycleIdsByHole.get(holeId);
      if (!photo) return;
      if (!cycleId) { skippedNoCycle += 1; return; }
      const ext = photo.file.name.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `${cycleId}/${photo.timestamp.getTime()}-${photoKind}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("planting-photos")
        .upload(storagePath, photo.file, { contentType: photo.file.type || "image/jpeg", upsert: false });
      if (uploadErr) {
        console.error(`[bulk-action] upload failed cycle=${cycleId}:`, uploadErr);
        uploadErrors.push(`${holeId}: ${uploadErr.message}`);
        return;
      }
      photoRows.push({
        cycle_id: cycleId,
        storage_path: storagePath,
        kind: photoKind,
        captured_at: photo.timestamp.toISOString(),
        captured_by: user?.id ?? null,
      });
    }));

    if (photoRows.length > 0) {
      const { error: photoErr } = await supabase.from("planting_photos").insert(photoRows);
      if (photoErr) {
        console.error("[bulk-action] planting_photos insert failed:", photoErr);
        uploadErrors.push(`DB: ${photoErr.message}`);
      }
    }

    const statusLabel = t(HOLE_STATUS[targetStatus].labelKey);
    if (uploadErrors.length > 0) {
      toast.warning(t("rmap.bulk_action_partial").replace("{n}", String(uploadErrors.length)));
    } else if (skippedNoCycle > 0) {
      toast.success(
        t("rmap.bulk_action_skipped")
          .replace("{n}", String(bulkActionOrderedHoleIds.length))
          .replace("{status}", statusLabel)
          .replace("{skipped}", String(skippedNoCycle))
      );
    } else {
      toast.success(
        t("rmap.bulk_action_success")
          .replace("{n}", String(bulkActionOrderedHoleIds.length))
          .replace("{status}", statusLabel)
      );
    }

    setShowBulkAction(false);
    resetBulkAction();
    exitMultiSelect();
    setBulkActionLoading(false);
    router.refresh();
  }

  // Shared helper: find next uncaptured hole index, wrapping around.
  function findNextUncapturedIndexInMap(
    map: Map<number, BulkPhoto>,
    orderedIds: number[],
    fromIdx: number,
    justCapturedId: number
  ): number {
    for (let i = fromIdx + 1; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (id !== justCapturedId && !map.has(id)) return i;
    }
    for (let i = 0; i < fromIdx; i++) {
      const id = orderedIds[i];
      if (!map.has(id)) return i;
    }
    return -1;
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}>
      {/* Multi-select toolbar — admin+operator only (bulk write actions) */}
      <RoleGate roles={["admin", "operator"]} fallback={<div className="mb-3" />}>
      <div className="flex items-center justify-between mb-3">
        {multiSelectMode ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] text-[oklch(0.75_0.17_150)] font-medium">
              {multiSelectedIds.size} {t("rmap.holes_selected")}
            </span>
            {/* Show "Tanam" if any empty holes selected */}
            {Array.from(multiSelectedIds).some((id) => holes.find((h) => h.id === id)?.status === "empty") && (
              <Button size="sm" className="h-8 text-[12px] bg-primary hover:bg-primary/90 text-white"
                onClick={openBulkPlant} disabled={multiSelectedIds.size === 0}>
                <Sprout className="h-3.5 w-3.5 mr-1" /> {t("rmap.plant_btn")}
              </Button>
            )}
            {/* Show "Ubah Status" dropdown for bulk status change */}
            <Select value={bulkAction} onValueChange={(v) => {
              if (v !== null) {
                setBulkAction(v);
                if (multiSelectedIds.size > 0) {
                  setBulkActionStep("capture");
                  setBulkActionCaptureIndex(0);
                  setBulkActionPhotoMap(new Map());
                  setBulkActionErrors({});
                  setShowBulkAction(true);
                }
              }
            }}>
              <SelectTrigger className="h-8 bg-secondary border-border/50 text-[12px] w-[140px]">
                <SelectValue placeholder={t("rmap.change_status")}>{bulkAction ? t(HOLE_STATUS[bulkAction as HoleStatus]?.labelKey) : undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(HOLE_STATUS) as HoleStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${HOLE_STATUS[s].dotColor}`} />
                      {t(HOLE_STATUS[s].labelKey)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-8 text-[12px] text-muted-foreground" onClick={exitMultiSelect}>
              <X className="h-3.5 w-3.5 mr-1" />
              {t("rmap.cancel")}
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
            {t("rmap.select_multi")}
          </Button>
        )}
      </div>
      </RoleGate>

      <Tabs defaultValue="A" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-10 bg-secondary border border-border/50">
          <TabsTrigger value="A" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-white">{t("rmap.rack_a")}</TabsTrigger>
          <TabsTrigger value="B" className="text-sm data-[state=active]:bg-primary data-[state=active]:text-white">{t("rmap.rack_b")}</TabsTrigger>
        </TabsList>

        {RACK_CONFIG.racks.map((rack) => (
          <TabsContent key={rack} value={rack} className="mt-4 space-y-3">
            {[...RACK_CONFIG.tiers].reverse().map((tier) => {
              const tierHoles = holes.filter((h) => h.rack === rack && h.tier === tier);
              const tierTotal = tierHoles.length;
              const tierActive = tierHoles.filter((h) => h.status === "planted" || h.status === "growing" || h.status === "ready_harvest").length;
              const tierBreakdown: Record<HoleStatus, number> = {
                empty: 0, planted: 0, growing: 0, ready_harvest: 0, harvested: 0, maintenance: 0,
              };
              tierHoles.forEach((h) => { tierBreakdown[h.status as HoleStatus] = (tierBreakdown[h.status as HoleStatus] ?? 0) + 1; });
              const TIER_STATUS_HEX: Record<HoleStatus, string> = {
                empty: "#3a3d45", planted: "#638cff", growing: "#4ade80",
                ready_harvest: "#f59e0b", harvested: "#2dd4bf", maintenance: "#ef4444",
              };
              return (
              <div key={tier} className="rounded-lg border border-border/50 bg-card">
                <div className="px-4 py-2.5 border-b border-border/30 bg-secondary/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <h3 className="text-[13px] font-medium text-foreground shrink-0">{t("rmap.tier")} {tier}</h3>
                    {/* Per-tier mini summary (desktop only to avoid clutter on mobile) */}
                    <div className="hidden md:flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        <span className="text-foreground font-semibold">{tierActive}</span>
                        <span className="mx-1 opacity-50">/</span>
                        <span>{tierTotal} {t("rmap.active_suffix")}</span>
                      </span>
                      <div className="h-1.5 w-[140px] rounded-full overflow-hidden flex bg-secondary/40">
                        {(Object.keys(tierBreakdown) as HoleStatus[]).map((k) => {
                          const pct = tierTotal > 0 ? (tierBreakdown[k] / tierTotal) * 100 : 0;
                          if (pct === 0) return null;
                          return (
                            <div
                              key={k}
                              title={`${t(HOLE_STATUS[k].labelKey)}: ${tierBreakdown[k]}`}
                              style={{ width: `${pct}%`, backgroundColor: TIER_STATUS_HEX[k] }}
                              className="h-full"
                            />
                          );
                        })}
                      </div>
                      <div className="flex gap-1.5 ml-1">
                        {(["planted", "growing", "ready_harvest", "maintenance"] as HoleStatus[]).map((k) => (
                          tierBreakdown[k] > 0 && (
                            <span key={k} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TIER_STATUS_HEX[k] }} />
                              {tierBreakdown[k]}
                            </span>
                          )
                        ))}
                      </div>
                    </div>
                  </div>
                  {multiSelectMode && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-muted-foreground shrink-0"
                      onClick={() => {
                        setMultiSelectedIds((prev) => {
                          const next = new Set(prev);
                          const allSelected = tierHoles.every((h) => next.has(h.id));
                          tierHoles.forEach((h) => allSelected ? next.delete(h.id) : next.add(h.id));
                          return next;
                        });
                      }}
                    >
                      {t("rmap.select_all_tier")}
                    </Button>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  {RACK_CONFIG.lanes.map((lane) => {
                    const laneHoles = getHolesForLane(rack, tier, lane);
                    const laneActive = laneHoles.filter((h) => h.status === "planted" || h.status === "growing" || h.status === "ready_harvest").length;
                    const laneBreakdown: Record<HoleStatus, number> = {
                      empty: 0, planted: 0, growing: 0, ready_harvest: 0, harvested: 0, maintenance: 0,
                    };
                    laneHoles.forEach((h) => { laneBreakdown[h.status as HoleStatus] = (laneBreakdown[h.status as HoleStatus] ?? 0) + 1; });
                    const LANE_STATUS_HEX: Record<HoleStatus, string> = {
                      empty: "#3a3d45", planted: "#638cff", growing: "#4ade80",
                      ready_harvest: "#f59e0b", harvested: "#2dd4bf", maintenance: "#ef4444",
                    };
                    const laneTotal = laneHoles.length || 1;
                    const activePct = Math.round((laneActive / laneTotal) * 100);

                    return (
                      <div key={lane} className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground w-6 shrink-0 font-medium">L{lane}</span>
                        <div className="overflow-x-auto scrollbar-none">
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
                                  researchTag={researchAllocations[hole.id]}
                                  onClick={() => handleCellClick(hole)}
                                  onDragStart={handleDragStart}
                                  onDragEnter={handleDragEnter}
                                />
                              ))}
                          </div>
                        </div>
                        {/* Per-lane status indicator (fills dead space at right) */}
                        <div className="hidden xl:flex items-center gap-2 flex-1 min-w-0 justify-end pl-3">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden flex bg-secondary/40 max-w-[120px]">
                            {(Object.keys(laneBreakdown) as HoleStatus[]).map((k) => {
                              const pct = (laneBreakdown[k] / laneTotal) * 100;
                              if (pct === 0) return null;
                              return (
                                <div
                                  key={k}
                                  title={`${t(HOLE_STATUS[k].labelKey)}: ${laneBreakdown[k]}`}
                                  style={{ width: `${pct}%`, backgroundColor: LANE_STATUS_HEX[k] }}
                                  className="h-full"
                                />
                              );
                            })}
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap w-14 text-right">
                            <span className="text-foreground font-medium">{laneActive}</span>
                            <span className="opacity-60">/{laneTotal} ({activePct}%)</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
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

      {/* Bulk planting dialog — 3 step flow */}
      <Dialog open={showBulkPlant} onOpenChange={(v) => { if (!v) { setShowBulkPlant(false); resetBulkPlant(); } }}>
        <DialogContent showCloseButton={true} className="sm:max-w-[480px] bg-card border-border/50 p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-base font-semibold text-foreground">
              {bulkStep === "setup" && t("rmap.bulk_plant_title").replace("{n}", String(bulkOrderedHoleIds.length))}
              {bulkStep === "capture" && t("rmap.photo_evidence_title")}
              {bulkStep === "review" && t("rmap.review_confirm")}
            </DialogTitle>
            <p className="text-[12px] text-muted-foreground mt-1">
              {bulkStep === "setup" && (
                <>
                  {bulkOrderedHoleIds.slice(0, 5).map((id) => holes.find((h) => h.id === id)?.canonical_id).join(", ")}
                  {bulkOrderedHoleIds.length > 5 && ` ${t("rmap.n_others").replace("{n}", String(bulkOrderedHoleIds.length - 5))}`}
                </>
              )}
              {bulkStep === "capture" && t("rmap.capture_hint")}
              {bulkStep === "review" && t("rmap.review_hint")}
            </p>
          </DialogHeader>
          <Separator className="bg-border/30" />

          {/* ===== STEP 1: SETUP ===== */}
          {bulkStep === "setup" && (
            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">{t("rmap.commodity")} <span className="text-destructive">*</span></Label>
                <Select value={bulkCropId} onValueChange={(v) => { if (v !== null) { setBulkCropId(v); setBulkErrors((p) => ({ ...p, crop: "" })); } }}>
                  <SelectTrigger className={`h-11 bg-secondary border-border/50 ${bulkErrors.crop ? "border-destructive" : ""}`}>
                    <SelectValue placeholder={t("rmap.select_commodity")}>{getCropDisplayName()}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {crops.map((crop) => (
                      <SelectItem key={crop.id} value={String(crop.id)}>
                        {crop.name_id} ({crop.grow_duration_days} {t("unit.days")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bulkErrors.crop && <p className="text-[11px] text-destructive">{bulkErrors.crop}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">{t("rmap.notes_general")}</Label>
                <Textarea className="bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50"
                  placeholder={t("rmap.notes_placeholder")} value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} rows={2} />
              </div>

              <div className="rounded-md bg-secondary/30 border border-border/30 p-3 text-[12px] text-muted-foreground">
                <span className="text-foreground">{t("rmap.next_step")}</span> {t("rmap.photo_evidence_for")}
                {" "}<span className="text-foreground font-medium">{bulkOrderedHoleIds.length} {t("rmap.holes_word")}</span>
                {" "}{t("rmap.in_order")}{Math.max(5, bulkOrderedHoleIds.length * 6)} {t("rmap.seconds")}
              </div>

              <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white"
                onClick={() => {
                  if (!bulkCropId) { setBulkErrors({ crop: t("rmap.choose_commodity") }); return; }
                  setBulkStep("capture");
                  setBulkCaptureIndex(0);
                }}>
                {t("rmap.next_to_photo")}
              </Button>
            </div>
          )}

          {/* ===== STEP 2: CAPTURE ===== */}
          {bulkStep === "capture" && (() => {
            const currentHoleId = bulkOrderedHoleIds[bulkCaptureIndex];
            const currentHole = holes.find((h) => h.id === currentHoleId);
            const currentPhoto = currentHoleId != null ? bulkPhotoMap.get(currentHoleId) : undefined;
            const capturedCount = bulkPhotoMap.size;
            return (
              <div className="px-5 py-4 space-y-4">
                {/* Progress dots */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {bulkOrderedHoleIds.map((id, i) => {
                    const hasPhoto = bulkPhotoMap.has(id);
                    const isActive = i === bulkCaptureIndex;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setBulkCaptureIndex(i)}
                        className={`h-2 w-2 rounded-full transition-all ${
                          isActive ? "w-6 bg-primary" : hasPhoto ? "bg-emerald-400" : "bg-border/60"
                        }`}
                        aria-label={t("rmap.hole_aria") + " " + (i + 1)}
                      />
                    );
                  })}
                </div>

                <div className="text-center space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {t("rmap.photo_n_of").replace(/\s*$/, "")} {bulkCaptureIndex + 1} {t("rmap.of")} {bulkOrderedHoleIds.length}
                    {capturedCount > 0 && ` · ${capturedCount} ${t("rmap.already_photo")}`}
                  </p>
                  <p className="text-xl font-semibold text-foreground tabular-nums">
                    {currentHole?.canonical_id ?? "-"}
                  </p>
                </div>

                {/* Preview */}
                <div className="aspect-[4/3] rounded-lg bg-secondary/40 border border-dashed border-border/40 overflow-hidden flex items-center justify-center">
                  {currentPhoto ? (
                    <img src={currentPhoto.dataUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Camera className="h-8 w-8" />
                      <p className="text-[12px]">{t("rmap.no_photo")}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {currentPhoto ? (
                    <>
                      <Button type="button" variant="outline" className="flex-1 h-11 border-border/50"
                        onClick={() => fileInputRef.current?.click()}>
                        <RotateCcw className="h-4 w-4 mr-2" /> {t("rmap.retake")}
                      </Button>
                      <Button type="button" className="flex-1 h-11 bg-primary hover:bg-primary/90 text-white"
                        onClick={() => {
                          const nextIdx = findNextUncapturedIndex(bulkCaptureIndex, currentHoleId!);
                          if (nextIdx !== -1) setBulkCaptureIndex(nextIdx);
                          else setBulkStep("review");
                        }}>
                        {findNextUncapturedIndex(bulkCaptureIndex, currentHoleId!) === -1 ? t("rmap.done") : t("rmap.next")}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" className="flex-1 h-11 bg-primary hover:bg-primary/90 text-white"
                      onClick={() => fileInputRef.current?.click()}>
                      <Camera className="h-4 w-4 mr-2" /> {t("hole.take_photo")}
                    </Button>
                  )}
                </div>

                {/* Nav */}
                <div className="flex items-center justify-between pt-1">
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-[12px] text-muted-foreground"
                    disabled={bulkCaptureIndex === 0}
                    onClick={() => setBulkCaptureIndex((i) => Math.max(0, i - 1))}>
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> {t("rmap.previous")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-[12px] text-muted-foreground"
                    onClick={() => setBulkStep("review")}>
                    {t("rmap.review_all")} ({capturedCount}/{bulkOrderedHoleIds.length})
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-[12px] text-muted-foreground"
                    disabled={bulkCaptureIndex === bulkOrderedHoleIds.length - 1}
                    onClick={() => setBulkCaptureIndex((i) => Math.min(bulkOrderedHoleIds.length - 1, i + 1))}>
                    {t("rmap.next_btn")} <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* ===== STEP 3: REVIEW ===== */}
          {bulkStep === "review" && (
            <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {bulkOrderedHoleIds.map((id) => {
                  const h = holes.find((x) => x.id === id);
                  const photo = bulkPhotoMap.get(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => retakePhoto(id)}
                      className="relative rounded-lg overflow-hidden bg-secondary aspect-square group border border-border/40 hover:border-primary/60 transition-colors"
                    >
                      {photo ? (
                        <>
                          <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
                          <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera className="h-5 w-5 text-destructive" />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                        <p className="text-[10px] text-white font-medium tabular-nums truncate">
                          {h?.canonical_id}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {bulkErrors.photos && (
                <p className="text-[12px] text-destructive text-center">{bulkErrors.photos}</p>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1 h-11 border-border/50"
                  onClick={() => setBulkStep("capture")} disabled={bulkLoading}>
                  {t("rmap.back_to_photo")}
                </Button>
                <Button type="button" className="flex-[2] h-11 bg-primary hover:bg-primary/90 text-white"
                  onClick={handleBulkPlant}
                  disabled={bulkLoading || bulkPhotoMap.size < bulkOrderedHoleIds.length}>
                  {bulkLoading
                    ? t("rmap.processing")
                    : bulkPhotoMap.size < bulkOrderedHoleIds.length
                      ? `${bulkOrderedHoleIds.length - bulkPhotoMap.size} ${t("rmap.photos_short")}`
                      : t("rmap.plant_n_holes").replace("{n}", String(bulkOrderedHoleIds.length))}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden file input for bulk action photos */}
      <input ref={actionFileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleBulkActionPhotoCapture} />

      {/* Bulk action (status change) dialog — per-hole photo capture */}
      <Dialog open={showBulkAction} onOpenChange={(v) => { if (!v) { setShowBulkAction(false); resetBulkAction(); } }}>
        <DialogContent showCloseButton={true} className="sm:max-w-[480px] bg-card border-border/50 p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-base font-semibold text-foreground">
              {bulkActionStep === "capture"
                ? t("rmap.photo_status").replace("{status}", bulkAction ? t(HOLE_STATUS[bulkAction as HoleStatus].labelKey) : "")
                : t("rmap.review_change")
                    .replace("{n}", String(bulkActionOrderedHoleIds.length))
                    .replace("{status}", bulkAction ? t(HOLE_STATUS[bulkAction as HoleStatus].labelKey) : "")}
            </DialogTitle>
            <p className="text-[12px] text-muted-foreground mt-1">
              {bulkActionStep === "capture"
                ? t("rmap.capture_status_hint")
                : t("rmap.review_hint")}
            </p>
          </DialogHeader>
          <Separator className="bg-border/30" />

          {/* ===== CAPTURE ===== */}
          {bulkActionStep === "capture" && (() => {
            const currentHoleId = bulkActionOrderedHoleIds[bulkActionCaptureIndex];
            const currentHole = holes.find((h) => h.id === currentHoleId);
            const currentPhoto = currentHoleId != null ? bulkActionPhotoMap.get(currentHoleId) : undefined;
            const capturedCount = bulkActionPhotoMap.size;
            const isLastUncaptured = findNextUncapturedIndexInMap(bulkActionPhotoMap, bulkActionOrderedHoleIds, bulkActionCaptureIndex, currentHoleId!) === -1;
            return (
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {bulkActionOrderedHoleIds.map((id, i) => {
                    const hasPhoto = bulkActionPhotoMap.has(id);
                    const isActive = i === bulkActionCaptureIndex;
                    return (
                      <button key={id} type="button" onClick={() => setBulkActionCaptureIndex(i)}
                        className={`h-2 w-2 rounded-full transition-all ${
                          isActive ? "w-6 bg-primary" : hasPhoto ? "bg-emerald-400" : "bg-border/60"
                        }`}
                        aria-label={t("rmap.hole_aria") + " " + (i + 1)}
                      />
                    );
                  })}
                </div>

                <div className="text-center space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {t("rmap.photo_n_of").replace(/\s*$/, "")} {bulkActionCaptureIndex + 1} {t("rmap.of")} {bulkActionOrderedHoleIds.length}
                    {capturedCount > 0 && ` · ${capturedCount} ${t("rmap.already_photo")}`}
                  </p>
                  <p className="text-xl font-semibold text-foreground tabular-nums">
                    {currentHole?.canonical_id ?? "-"}
                  </p>
                </div>

                <div className="aspect-[4/3] rounded-lg bg-secondary/40 border border-dashed border-border/40 overflow-hidden flex items-center justify-center">
                  {currentPhoto ? (
                    <img src={currentPhoto.dataUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Camera className="h-8 w-8" />
                      <p className="text-[12px]">{t("rmap.no_photo")}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {currentPhoto ? (
                    <>
                      <Button type="button" variant="outline" className="flex-1 h-11 border-border/50"
                        onClick={() => actionFileInputRef.current?.click()}>
                        <RotateCcw className="h-4 w-4 mr-2" /> {t("rmap.retake")}
                      </Button>
                      <Button type="button" className="flex-1 h-11 bg-primary hover:bg-primary/90 text-white"
                        onClick={() => {
                          const nextIdx = findNextUncapturedIndexInMap(bulkActionPhotoMap, bulkActionOrderedHoleIds, bulkActionCaptureIndex, currentHoleId!);
                          if (nextIdx !== -1) setBulkActionCaptureIndex(nextIdx);
                          else setBulkActionStep("review");
                        }}>
                        {isLastUncaptured ? t("rmap.done") : t("rmap.next")}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" className="flex-1 h-11 bg-primary hover:bg-primary/90 text-white"
                      onClick={() => actionFileInputRef.current?.click()}>
                      <Camera className="h-4 w-4 mr-2" /> {t("hole.take_photo")}
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-[12px] text-muted-foreground"
                    disabled={bulkActionCaptureIndex === 0}
                    onClick={() => setBulkActionCaptureIndex((i) => Math.max(0, i - 1))}>
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> {t("rmap.previous")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-[12px] text-muted-foreground"
                    onClick={() => setBulkActionStep("review")}>
                    {t("rmap.review_all")} ({capturedCount}/{bulkActionOrderedHoleIds.length})
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-[12px] text-muted-foreground"
                    disabled={bulkActionCaptureIndex === bulkActionOrderedHoleIds.length - 1}
                    onClick={() => setBulkActionCaptureIndex((i) => Math.min(bulkActionOrderedHoleIds.length - 1, i + 1))}>
                    {t("rmap.next_btn")} <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* ===== REVIEW ===== */}
          {bulkActionStep === "review" && (
            <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {bulkActionOrderedHoleIds.map((id) => {
                  const h = holes.find((x) => x.id === id);
                  const photo = bulkActionPhotoMap.get(id);
                  return (
                    <button key={id} type="button" onClick={() => retakeActionPhoto(id)}
                      className="relative rounded-lg overflow-hidden bg-secondary aspect-square group border border-border/40 hover:border-primary/60 transition-colors">
                      {photo ? (
                        <>
                          <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
                          <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera className="h-5 w-5 text-destructive" />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                        <p className="text-[10px] text-white font-medium tabular-nums truncate">
                          {h?.canonical_id}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {bulkActionErrors.photos && (
                <p className="text-[12px] text-destructive text-center">{bulkActionErrors.photos}</p>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1 h-11 border-border/50"
                  onClick={() => setBulkActionStep("capture")} disabled={bulkActionLoading}>
                  {t("rmap.back_to_photo")}
                </Button>
                <Button type="button" className="flex-[2] h-11 bg-primary hover:bg-primary/90 text-white"
                  onClick={handleBulkActionSubmit}
                  disabled={bulkActionLoading || bulkActionPhotoMap.size < bulkActionOrderedHoleIds.length}>
                  {bulkActionLoading
                    ? t("rmap.processing")
                    : bulkActionPhotoMap.size < bulkActionOrderedHoleIds.length
                      ? `${bulkActionOrderedHoleIds.length - bulkActionPhotoMap.size} ${t("rmap.photos_short")}`
                      : t("rmap.change_n_holes").replace("{n}", String(bulkActionOrderedHoleIds.length))}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
