"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { CropCatalog } from "@/lib/types/database";

interface CropFormProps {
  crop?: CropCatalog;
}

export function CropForm({ crop }: CropFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!crop;
  const [loading, setLoading] = useState(false);

  const [nameId, setNameId] = useState(crop?.name_id ?? "");
  const [nameLatin, setNameLatin] = useState(crop?.name_latin ?? "");
  const [growDays, setGrowDays] = useState(String(crop?.grow_duration_days ?? ""));
  const [ecMin, setEcMin] = useState(crop?.ec_min != null ? String(crop.ec_min) : "");
  const [ecMax, setEcMax] = useState(crop?.ec_max != null ? String(crop.ec_max) : "");
  const [phMin, setPhMin] = useState(crop?.ph_min != null ? String(crop.ph_min) : "");
  const [phMax, setPhMax] = useState(crop?.ph_max != null ? String(crop.ph_max) : "");
  const [co2Min, setCo2Min] = useState(crop?.co2_min != null ? String(crop.co2_min) : "");
  const [co2Max, setCo2Max] = useState(crop?.co2_max != null ? String(crop.co2_max) : "");
  const [vpdMin, setVpdMin] = useState(crop?.vpd_min != null ? String(crop.vpd_min) : "");
  const [vpdMax, setVpdMax] = useState(crop?.vpd_max != null ? String(crop.vpd_max) : "");
  const [ppfdMin, setPpfdMin] = useState(crop?.ppfd_min != null ? String(crop.ppfd_min) : "");
  const [ppfdMax, setPpfdMax] = useState(crop?.ppfd_max != null ? String(crop.ppfd_max) : "");
  const [solTempMin, setSolTempMin] = useState(crop?.solution_temp_min != null ? String(crop.solution_temp_min) : "");
  const [solTempMax, setSolTempMax] = useState(crop?.solution_temp_max != null ? String(crop.solution_temp_max) : "");
  const [densityNotes, setDensityNotes] = useState(crop?.density_notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameId.trim()) {
      toast.error("Nama komoditas wajib diisi");
      return;
    }
    setLoading(true);

    const payload = {
      name_id: nameId.trim(),
      name_latin: nameLatin.trim() || null,
      grow_duration_days: growDays ? Number(growDays) : 30,
      ec_min: ecMin ? Number(ecMin) : null,
      ec_max: ecMax ? Number(ecMax) : null,
      ph_min: phMin ? Number(phMin) : null,
      ph_max: phMax ? Number(phMax) : null,
      co2_min: co2Min ? Number(co2Min) : null,
      co2_max: co2Max ? Number(co2Max) : null,
      vpd_min: vpdMin ? Number(vpdMin) : null,
      vpd_max: vpdMax ? Number(vpdMax) : null,
      ppfd_min: ppfdMin ? Number(ppfdMin) : null,
      ppfd_max: ppfdMax ? Number(ppfdMax) : null,
      solution_temp_min: solTempMin ? Number(solTempMin) : null,
      solution_temp_max: solTempMax ? Number(solTempMax) : null,
      density_notes: densityNotes.trim() || null,
    };

    let error;
    if (isEdit && crop) {
      ({ error } = await supabase
        .from("crop_catalog")
        .update(payload)
        .eq("id", crop.id));
    } else {
      ({ error } = await supabase
        .from("crop_catalog")
        .insert(payload));
    }

    if (error) {
      toast.error("Gagal menyimpan: " + error.message);
    } else {
      toast.success(isEdit ? "Komoditas berhasil diperbarui" : "Komoditas berhasil ditambahkan");
      router.push("/komoditas");
      router.refresh();
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!crop) return;
    if (!confirm("Hapus komoditas ini? Data yang terkait dengan siklus tanam tidak akan terhapus.")) return;

    setLoading(true);
    const { error } = await supabase.from("crop_catalog").delete().eq("id", crop.id);
    if (error) {
      toast.error("Gagal menghapus: " + error.message);
    } else {
      toast.success("Komoditas berhasil dihapus");
      router.push("/komoditas");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="rounded-xl border border-border/40 bg-card">
        <CardHeader>
          <CardTitle className="text-base">
            {isEdit ? "Edit Komoditas" : "Tambah Komoditas Baru"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Nama Komoditas (Indonesia)</Label>
            <Input
              className="h-11 bg-secondary border-border/50"
              placeholder="Contoh: Selada Keriting"
              value={nameId}
              onChange={(e) => setNameId(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Nama Latin (opsional)</Label>
            <Input
              className="h-11 bg-secondary border-border/50"
              placeholder="Contoh: Lactuca sativa"
              value={nameLatin}
              onChange={(e) => setNameLatin(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Durasi Tumbuh (hari)</Label>
            <Input
              type="number"
              className="h-11 bg-secondary border-border/50"
              placeholder="30"
              value={growDays}
              onChange={(e) => setGrowDays(e.target.value)}
              min="1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">EC Minimum (mS/cm)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="1.0"
                value={ecMin}
                onChange={(e) => setEcMin(e.target.value)}
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">EC Maksimum (mS/cm)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="1.5"
                value={ecMax}
                onChange={(e) => setEcMax(e.target.value)}
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">pH Minimum</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="5.5"
                value={phMin}
                onChange={(e) => setPhMin(e.target.value)}
                step="0.1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">pH Maksimum</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="6.5"
                value={phMax}
                onChange={(e) => setPhMax(e.target.value)}
                step="0.1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">CO2 Minimum (ppm)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="400"
                value={co2Min}
                onChange={(e) => setCo2Min(e.target.value)}
                step="1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">CO2 Maksimum (ppm)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="1200"
                value={co2Max}
                onChange={(e) => setCo2Max(e.target.value)}
                step="1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">VPD Minimum (kPa)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="0.80"
                value={vpdMin}
                onChange={(e) => setVpdMin(e.target.value)}
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">VPD Maksimum (kPa)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="1.20"
                value={vpdMax}
                onChange={(e) => setVpdMax(e.target.value)}
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">PPFD Minimum (umol/m2/s)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="200"
                value={ppfdMin}
                onChange={(e) => setPpfdMin(e.target.value)}
                step="1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">PPFD Maksimum (umol/m2/s)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="400"
                value={ppfdMax}
                onChange={(e) => setPpfdMax(e.target.value)}
                step="1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Suhu Larutan Min (°C)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="18.0"
                value={solTempMin}
                onChange={(e) => setSolTempMin(e.target.value)}
                step="0.1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Suhu Larutan Max (°C)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="24.0"
                value={solTempMax}
                onChange={(e) => setSolTempMax(e.target.value)}
                step="0.1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Keterangan Kepadatan Tanam</Label>
            <Textarea
              className="bg-secondary border-border/50"
              placeholder="Contoh: 1 tanaman per lubang, jarak ideal 15cm"
              value={densityNotes}
              onChange={(e) => setDensityNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1 h-11 bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white" disabled={loading}>
              {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Komoditas"}
            </Button>
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                className="h-11"
                onClick={handleDelete}
                disabled={loading}
              >
                Hapus
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
