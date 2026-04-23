"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FloatingForm } from "@/components/floating-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";
import type { CropCatalog, Hole } from "@/lib/types/database";
import { RACK_CONFIG } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import { translateCommodity } from "@/lib/translate-helpers";

interface PhotoEntry {
  dataUrl: string;
  timestamp: Date;
}

export default function NewPlantingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedHoleId = searchParams.get("hole");
  const { t, lang } = useLang();

  const supabase = createClient();
  const [crops, setCrops] = useState<CropCatalog[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [cropId, setCropId] = useState("");
  const [selectionMode, setSelectionMode] = useState<"individual" | "lane" | "tier">("individual");
  const [selectedRack, setSelectedRack] = useState("A");
  const [selectedTier, setSelectedTier] = useState("1");
  const [selectedLane, setSelectedLane] = useState("1");
  const [individualHoleIds, setIndividualHoleIds] = useState<string>(preselectedHoleId ?? "");
  const [notes, setNotes] = useState("");

  // Photo state
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadCrops() {
      const { data } = await supabase.from("crop_catalog").select("*").order("name_id");
      setCrops(data ?? []);
    }
    loadCrops();
  }, []);

  // Get selected crop display name
  function getCropDisplayName() {
    if (!cropId) return undefined;
    const crop = crops.find((c) => String(c.id) === cropId);
    return crop ? `${translateCommodity(crop.name_id, lang)} (${crop.grow_duration_days} ${t("unit.day")})` : undefined;
  }

  function getSelectionModeDisplay() {
    const labels: Record<string, string> = {
      individual: t("cult.hole_individual"),
      lane: t("cult.lane_full"),
      tier: t("cult.tier_full"),
    };
    return labels[selectionMode];
  }

  // Photo capture
  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((prev) => [...prev, { dataUrl: reader.result as string, timestamp: new Date() }]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // Validation
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!cropId) errs.crop = t("cult.commodity_first");
    if (selectionMode === "individual" && !individualHoleIds.trim()) {
      errs.holes = t("cult.input_hole_id");
    }
    if (photos.length === 0) errs.photos = t("cult.min_one_photo_proof");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const crop = crops.find((c) => c.id === Number(cropId));
    if (!crop) { setLoading(false); return; }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      let holesToPlant: Hole[] = [];

      if (selectionMode === "individual" && individualHoleIds) {
        const ids = individualHoleIds.split(",").map((s) => Number(s.trim())).filter(Boolean);
        const { data } = await supabase.from("holes").select("*").in("id", ids).eq("status", "empty");
        holesToPlant = data ?? [];
      } else if (selectionMode === "lane") {
        const { data } = await supabase.from("holes").select("*")
          .eq("rack", selectedRack).eq("tier", Number(selectedTier))
          .eq("lane", Number(selectedLane)).eq("status", "empty");
        holesToPlant = data ?? [];
      } else if (selectionMode === "tier") {
        const { data } = await supabase.from("holes").select("*")
          .eq("rack", selectedRack).eq("tier", Number(selectedTier)).eq("status", "empty");
        holesToPlant = data ?? [];
      }

      if (holesToPlant.length === 0) {
        toast.error(t("cult.no_empty_holes"));
        setLoading(false);
        return;
      }

      // Create batch — notes is catatan, NOT batch name
      const { data: batch, error: batchError } = await supabase
        .from("batches")
        .insert({
          crop_catalog_id: crop.id,
          notes: notes.trim() || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (batchError || !batch) {
        toast.error(t("cult.batch_create_failed") + ": " + (batchError?.message ?? ""));
        setLoading(false);
        return;
      }

      const plantedAt = new Date();
      const expectedHarvest = new Date(plantedAt);
      expectedHarvest.setDate(expectedHarvest.getDate() + crop.grow_duration_days);

      const cycleInserts = holesToPlant.map((hole) => ({
        hole_id: hole.id,
        batch_id: batch.id,
        crop_catalog_id: crop.id,
        planted_at: plantedAt.toISOString(),
        expected_harvest_at: expectedHarvest.toISOString(),
        created_by: user?.id,
      }));

      const { data: cycles, error: cycleError } = await supabase
        .from("planting_cycles").insert(cycleInserts).select();

      if (cycleError) {
        toast.error(t("cult.cycle_create_failed") + ": " + cycleError.message);
        setLoading(false);
        return;
      }

      if (cycles) {
        for (const cycle of cycles) {
          await supabase.from("holes")
            .update({ status: "planted" as const, current_cycle_id: cycle.id })
            .eq("id", cycle.hole_id);
        }
      }

      toast.success(`${t("cult.planted_n_holes")} ${holesToPlant.length} ${t("unit.holes")} — ${batch.batch_code}`);
      router.push("/tanam");
      router.refresh();
    } catch {
      toast.error(t("toast.error_generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <FloatingForm title={t("cult.new_plant")} backHref="/tanam">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Crop selection */}
        <div className="space-y-2">
          <Label className="text-[13px] text-muted-foreground">
            {t("cult.commodity")} <span className="text-destructive">*</span>
          </Label>
          <Select value={cropId} onValueChange={(v) => { if (v !== null) { setCropId(v); setErrors((e) => ({ ...e, crop: "" })); } }}>
            <SelectTrigger className={`h-11 bg-secondary border-border/50 ${errors.crop ? "border-destructive" : ""}`}>
              <SelectValue placeholder={`${t("common.select")} ${t("cult.commodity").toLowerCase()}...`}>
                {getCropDisplayName()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {crops.map((crop) => (
                <SelectItem key={crop.id} value={String(crop.id)}>
                  {translateCommodity(crop.name_id, lang)} ({crop.grow_duration_days} {t("unit.day")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.crop && <p className="text-[11px] text-destructive">{errors.crop}</p>}
        </div>

        {/* Selection mode */}
        <div className="space-y-2">
          <Label className="text-[13px] text-muted-foreground">
            {t("cult.hole_selection_mode")} <span className="text-destructive">*</span>
          </Label>
          <Select value={selectionMode} onValueChange={(v) => v !== null && setSelectionMode(v as "individual" | "lane" | "tier")}>
            <SelectTrigger className="h-11 bg-secondary border-border/50">
              <SelectValue>{getSelectionModeDisplay()}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">{t("cult.hole_individual")}</SelectItem>
              <SelectItem value="lane">{t("cult.lane_full")}</SelectItem>
              <SelectItem value="tier">{t("cult.tier_full")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conditional fields */}
        {selectionMode === "individual" && (
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">
              {t("cult.hole_id_comma")} <span className="text-destructive">*</span>
            </Label>
            <Input
              className={`h-11 bg-secondary border-border/50 ${errors.holes ? "border-destructive" : ""}`}
              placeholder={t("cult.hole_id_example")}
              value={individualHoleIds}
              onChange={(e) => { setIndividualHoleIds(e.target.value); setErrors((er) => ({ ...er, holes: "" })); }}
            />
            {errors.holes && <p className="text-[11px] text-destructive">{errors.holes}</p>}
          </div>
        )}

        {(selectionMode === "lane" || selectionMode === "tier") && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("cult.rack")}</Label>
              <Select value={selectedRack} onValueChange={(v) => v !== null && setSelectedRack(v)}>
                <SelectTrigger className="h-11 bg-secondary border-border/50">
                  <SelectValue>{`${t("cult.rack")} ${selectedRack}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RACK_CONFIG.racks.map((r) => (<SelectItem key={r} value={r}>{t("cult.rack")} {r}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("cult.tier")}</Label>
              <Select value={selectedTier} onValueChange={(v) => v !== null && setSelectedTier(v)}>
                <SelectTrigger className="h-11 bg-secondary border-border/50">
                  <SelectValue>{`${t("cult.tier")} ${selectedTier}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RACK_CONFIG.tiers.map((tier) => (<SelectItem key={tier} value={String(tier)}>{t("cult.tier")} {tier}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {selectionMode === "lane" && (
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">{t("cult.lane")}</Label>
            <Select value={selectedLane} onValueChange={(v) => v !== null && setSelectedLane(v)}>
              <SelectTrigger className="h-11 bg-secondary border-border/50">
                <SelectValue>{`${t("cult.lane")} ${selectedLane}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {RACK_CONFIG.lanes.map((l) => (<SelectItem key={l} value={String(l)}>{t("cult.lane")} {l}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label className="text-[13px] text-muted-foreground">{t("common.notes_optional")}</Label>
          <Textarea
            className="bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50"
            placeholder={t("cult.notes_placeholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Photo capture */}
        <Separator className="bg-border/30" />
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-[13px] text-muted-foreground">
              {t("cult.photo_documentation")} <span className="text-destructive">*</span>
            </Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px] border-border/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-3 w-3 mr-1" />
              {t("cult.take_photo")}
            </Button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
          {photos.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((photo, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden bg-secondary aspect-square group">
                  <img src={photo.dataUrl} alt={`${t("cult.photo")} ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-[11px] ${errors.photos ? "text-destructive" : "text-muted-foreground"}`}>
              {errors.photos || t("cult.min_one_photo_proof")}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white" disabled={loading}>
          {loading ? t("common.processing") : t("cult.start_planting")}
        </Button>
      </form>
    </FloatingForm>
  );
}
