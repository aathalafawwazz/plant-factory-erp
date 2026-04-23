"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FloatingForm } from "@/components/floating-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RACK_CONFIG } from "@/lib/constants";
import { useLang } from "@/lib/i18n";

export default function NewEnvironmentalLogPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLang();
  const [loading, setLoading] = useState(false);

  // Scope
  const [scope, setScope] = useState<"room" | "rack">("room");
  const [rack, setRack] = useState("A");
  const [tier, setTier] = useState("1");

  // Readings
  const [tempC, setTempC] = useState("");
  const [humidity, setHumidity] = useState("");
  const [co2, setCo2] = useState("");
  const [ppfd, setPpfd] = useState("");

  // VPD otomatis dari suhu & RH (rumus Tetens).
  // SVP = 610.78 × e^(17.2694·T / (T + 237.3))  [Pa]
  // VPD = SVP × (1 − RH/100)                     [Pa]
  const vpdKpa = (() => {
    const tVal = Number(tempC);
    const rh = Number(humidity);
    if (!tempC || !humidity || !Number.isFinite(tVal) || !Number.isFinite(rh)) return null;
    if (rh < 0 || rh > 100) return null;
    const svp = 610.78 * Math.exp((17.2694 * tVal) / (tVal + 237.3));
    const vpdPa = svp * (1 - rh / 100);
    return vpdPa / 1000;
  })();

  // Equipment
  const [growlightOn, setGrowlightOn] = useState(true);
  const [acOn, setAcOn] = useState(true);
  const [fanOn, setFanOn] = useState(true);

  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("environmental_logs").insert({
      rack: scope === "rack" ? rack : null,
      tier: scope === "rack" ? Number(tier) : null,
      temperature_c: tempC ? Number(tempC) : null,
      humidity_pct: humidity ? Number(humidity) : null,
      co2_ppm: co2 ? Number(co2) : null,
      vpd_kpa: vpdKpa != null ? Number(vpdKpa.toFixed(2)) : null,
      ppfd_umol: ppfd ? Number(ppfd) : null,
      growlight_on: growlightOn,
      ac_on: acOn,
      fan_on: fanOn,
      notes: notes || null,
      recorded_by: user?.id,
    });

    if (error) {
      toast.error(t("env.save_failed") + error.message);
    } else {
      toast.success(t("env.save_success"));
      router.push("/lingkungan");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <FloatingForm title={t("env.form_title")} backHref="/lingkungan">
      <form onSubmit={handleSubmit} className="space-y-4">
            {/* Scope */}
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("env.location_measurement")}</Label>
              <Select value={scope} onValueChange={(v) => v !== null && setScope(v as "room" | "rack")}>
                <SelectTrigger className="h-11 bg-secondary border-border/50 text-foreground">
                  <SelectValue>{scope === "room" ? t("env.entire_room") : t("env.specific_rack")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">{t("env.entire_room")}</SelectItem>
                  <SelectItem value="rack">{t("env.specific_rack")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === "rack" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[13px] text-muted-foreground">{t("cult.rack")}</Label>
                  <Select value={rack} onValueChange={(v) => v !== null && setRack(v)}>
                    <SelectTrigger className="h-11 bg-secondary border-border/50 text-foreground">
                      <SelectValue>{`${t("cult.rack")} ${rack}`}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {RACK_CONFIG.racks.map((r) => (
                        <SelectItem key={r} value={r}>{t("cult.rack")} {r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] text-muted-foreground">{t("cult.tier")}</Label>
                  <Select value={tier} onValueChange={(v) => v !== null && setTier(v)}>
                    <SelectTrigger className="h-11 bg-secondary border-border/50 text-foreground">
                      <SelectValue>{`${t("cult.tier")} ${tier}`}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {RACK_CONFIG.tiers.map((tr) => (
                        <SelectItem key={tr} value={String(tr)}>{t("cult.tier")} {tr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Environmental readings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">{t("env.temperature_air")}</Label>
                <Input
                  type="number"
                  className="h-11 bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="25.0"
                  value={tempC}
                  onChange={(e) => setTempC(e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">{t("env.humidity_rh")}</Label>
                <Input
                  type="number"
                  className="h-11 bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="70"
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">CO2 (ppm)</Label>
                <Input
                  type="number"
                  className="h-11 bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="800"
                  value={co2}
                  onChange={(e) => setCo2(e.target.value)}
                  step="1"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground inline-flex items-center gap-1.5">
                  VPD (kPa)
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">auto</span>
                </Label>
                <div className="h-11 px-3 rounded-md bg-secondary/40 border border-border/30 border-dashed flex items-center justify-between text-foreground">
                  <span className={vpdKpa != null ? "tabular-nums" : "text-muted-foreground/60 text-[13px]"}>
                    {vpdKpa != null ? vpdKpa.toFixed(2) : t("env.vpd_auto_hint")}
                  </span>
                  {vpdKpa != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {t("env.vpd_from")} {Number(tempC).toFixed(1)}°C · {Number(humidity).toFixed(0)}%RH
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">PPFD (μmol/m²/s)</Label>
                <Input
                  type="number"
                  className="h-11 bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="200"
                  value={ppfd}
                  onChange={(e) => setPpfd(e.target.value)}
                  step="1"
                />
              </div>
            </div>

            {/* Equipment status */}
            <div className="space-y-3">
              <Label className="text-[13px] text-muted-foreground">{t("env.equipment_status")}</Label>
              <div className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50">
                <span className="text-[13px] text-foreground">{t("env.growlight")}</span>
                <Switch checked={growlightOn} onCheckedChange={setGrowlightOn} />
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50">
                <span className="text-[13px] text-foreground">{t("env.ac")}</span>
                <Switch checked={acOn} onCheckedChange={setAcOn} />
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50">
                <span className="text-[13px] text-foreground">{t("env.fan_circulation")}</span>
                <Switch checked={fanOn} onCheckedChange={setFanOn} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("common.notes_optional")}</Label>
              <Textarea
                className="bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50"
                placeholder={t("env.notes_placeholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white" disabled={loading}>
              {loading ? t("common.saving") : t("env.save_log_btn")}
            </Button>
      </form>
    </FloatingForm>
  );
}
