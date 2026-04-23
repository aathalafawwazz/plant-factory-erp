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
import { useLang } from "@/lib/i18n";

export default function NewNutrientLogPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLang();
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
      toast.error(t("nut.save_failed") + error.message);
    } else {
      toast.success(t("nut.save_success"));
      router.push("/nutrisi");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <FloatingForm title={t("nut.form_title")} backHref="/nutrisi">
      <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("cult.rack")}</Label>
              <Select value={selectedRack} onValueChange={(v) => v !== null && setSelectedRack(v)}>
                <SelectTrigger className="h-11 bg-secondary border-border/50 text-foreground">
                  <SelectValue>{`${t("cult.rack")} ${selectedRack}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">{t("cult.rack")} A</SelectItem>
                  <SelectItem value="B">{t("cult.rack")} B</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("nut.formula_name")}</Label>
              <Input
                className="h-11 bg-secondary border-border/50"
                placeholder={t("nut.formula_placeholder")}
                value={formulaName}
                onChange={(e) => setFormulaName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("nut.volume_liter")}</Label>
              <Input
                type="number"
                className="h-11 bg-secondary border-border/50"
                placeholder={t("nut.volume_placeholder")}
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
              <Label className="text-[13px] text-muted-foreground">{t("nut.solution_temp")}</Label>
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
              <Label className="text-[13px] text-muted-foreground">{t("common.notes_optional")}</Label>
              <Textarea
                className="bg-secondary border-border/50"
                placeholder={t("nut.notes_placeholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white" disabled={loading}>
              {loading ? t("common.saving") : t("nut.save_log_btn")}
            </Button>
      </form>
    </FloatingForm>
  );
}
