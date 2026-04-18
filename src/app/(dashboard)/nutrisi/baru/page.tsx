"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FloatingForm } from "@/components/floating-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function NewNutrientLogPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [selectedRack, setSelectedRack] = useState("A");
  const [formulaName, setFormulaName] = useState("");
  const [volumeLiters, setVolumeLiters] = useState("");
  const [ec, setEc] = useState("");
  const [ph, setPh] = useState("");
  const [solutionTemp, setSolutionTemp] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("nutrient_logs").insert({
      formula_name: formulaName || null,
      volume_liters: volumeLiters ? Number(volumeLiters) : null,
      ec_target: null,
      ph_target: null,
      ec_actual: ec ? Number(ec) : null,
      ph_actual: ph ? Number(ph) : null,
      mixed_by: user?.id,
      notes: notes || null,
      // TODO: add rack column (selectedRack) to nutrient_logs table
      // TODO: add solution_temp column (solutionTemp) to nutrient_logs table
    });

    if (error) {
      toast.error("Gagal menyimpan: " + error.message);
    } else {
      toast.success("Log nutrisi berhasil dicatat");
      router.push("/nutrisi");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <FloatingForm title="Catat Log Nutrisi" backHref="/nutrisi">
      <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Rak</Label>
              <Select value={selectedRack} onValueChange={(v) => v !== null && setSelectedRack(v)}>
                <SelectTrigger className="h-11 bg-secondary border-border/50 text-foreground">
                  <SelectValue>{`Rak ${selectedRack}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Rak A</SelectItem>
                  <SelectItem value="B">Rak B</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Nama Formula / Merek Nutrisi</Label>
              <Input
                className="h-11 bg-secondary border-border/50"
                placeholder="Contoh: AB Mix Sayuran Daun"
                value={formulaName}
                onChange={(e) => setFormulaName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Volume Larutan (Liter)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="Contoh: 100"
                value={volumeLiters}
                onChange={(e) => setVolumeLiters(e.target.value)}
                step="0.1"
                min="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">EC (mS/cm)</Label>
                <Input
                  type="number"
                  className="h-11 bg-secondary border-border/50"
                  placeholder="1.5"
                  value={ec}
                  onChange={(e) => setEc(e.target.value)}
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">pH</Label>
                <Input
                  type="number"
                  className="h-11 bg-secondary border-border/50"
                  placeholder="6.0"
                  value={ph}
                  onChange={(e) => setPh(e.target.value)}
                  step="0.1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Suhu Larutan (°C)</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder="25"
                value={solutionTemp}
                onChange={(e) => setSolutionTemp(e.target.value)}
                step="0.1"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Catatan (opsional)</Label>
              <Textarea
                className="bg-secondary border-border/50"
                placeholder="Catatan tambahan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full h-11 bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Log"}
            </Button>
      </form>
    </FloatingForm>
  );
}
