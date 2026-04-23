"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { QUALITY_GRADES } from "@/lib/constants";
import { toast } from "sonner";
import type { PlantingCycle, CropCatalog, Hole } from "@/lib/types/database";

export default function CycleDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const isHarvestMode = searchParams.get("action") === "harvest";

  const [cycle, setCycle] = useState<(PlantingCycle & { crop_catalog: CropCatalog; holes: Hole }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Harvest form
  const [harvestWeight, setHarvestWeight] = useState("");
  const [qualityGrade, setQualityGrade] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("planting_cycles")
        .select("*, crop_catalog(*), holes!planting_cycles_hole_id_fkey(*)")
        .eq("id", Number(params.id))
        .single();

      if (error) {
        console.error("Failed to load cycle:", error);
      }
      setCycle(data as never);
      setLoading(false);
    }
    load();
  }, [params.id]);

  async function handleHarvest(e: React.FormEvent) {
    e.preventDefault();
    if (!cycle) return;
    setSaving(true);

    const { error: cycleError } = await supabase
      .from("planting_cycles")
      .update({
        status: "harvested",
        harvested_at: new Date().toISOString(),
        harvest_weight_g: harvestWeight ? Number(harvestWeight) : null,
        quality_grade: qualityGrade || null,
        notes: notes || null,
      })
      .eq("id", cycle.id);

    const { error: holeError } = await supabase
      .from("holes")
      .update({ status: "harvested" as const, current_cycle_id: null })
      .eq("id", cycle.hole_id);

    if (cycleError || holeError) {
      toast.error("Gagal mencatat panen");
    } else {
      toast.success("Panen berhasil dicatat!");
      router.push("/tanam");
      router.refresh();
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-muted-foreground">Memuat...</div>;
  }

  if (!cycle) {
    return <div className="text-center py-12 text-[13px] text-muted-foreground">Log tanam tidak ditemukan.</div>;
  }

  const hole = cycle.holes as unknown as Hole;
  const crop = cycle.crop_catalog;

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-lg font-semibold text-foreground mb-4">Detail Log Tanam</h1>

      <Card className="mb-4 rounded-lg border border-border/40 bg-card">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Lubang</span>
            <span className="text-[13px] font-medium text-foreground">{hole?.canonical_id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Komoditas</span>
            <span className="text-[13px] font-medium text-foreground">{crop?.name_id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Status</span>
            <StatusBadge status={cycle.status as never} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Ditanam</span>
            <span className="text-[13px] text-foreground">{new Date(cycle.planted_at).toLocaleDateString("id-ID")}</span>
          </div>
          {cycle.expected_harvest_at && (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Target Panen</span>
              <span className="text-[13px] text-foreground">{new Date(cycle.expected_harvest_at).toLocaleDateString("id-ID")}</span>
            </div>
          )}
          {cycle.harvested_at && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Tanggal Panen</span>
                <span className="text-[13px] text-foreground">{new Date(cycle.harvested_at).toLocaleDateString("id-ID")}</span>
              </div>
              {cycle.harvest_weight_g && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Berat Panen</span>
                  <span className="text-[13px] text-foreground">{cycle.harvest_weight_g} gram</span>
                </div>
              )}
              {cycle.quality_grade && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Kualitas</span>
                  <span className="text-[13px] text-foreground">Grade {cycle.quality_grade}</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {isHarvestMode && cycle.status === "ready_harvest" && (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardHeader>
            <CardTitle className="text-[14px]">Catat Panen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleHarvest} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">Berat Panen (gram)</Label>
                <Input
                  type="number"
                  className="h-11 bg-secondary border-border/50"
                  placeholder="Contoh: 250"
                  value={harvestWeight}
                  onChange={(e) => setHarvestWeight(e.target.value)}
                  step="0.1"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">Kualitas</Label>
                <Select value={qualityGrade} onValueChange={(v) => v !== null && setQualityGrade(v)}>
                  <SelectTrigger className="h-11 bg-secondary border-border/50">
                    <SelectValue placeholder="Pilih grade..." />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITY_GRADES.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">Catatan (opsional)</Label>
                <Textarea
                  placeholder="Catatan panen..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white" disabled={saving}>
                {saving ? "Menyimpan..." : "Catat Panen"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
