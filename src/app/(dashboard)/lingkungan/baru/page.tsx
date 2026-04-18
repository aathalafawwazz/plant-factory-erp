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

export default function NewEnvironmentalLogPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // Scope
  const [scope, setScope] = useState<"room" | "rack">("room");
  const [rack, setRack] = useState("A");
  const [tier, setTier] = useState("1");

  // Readings
  const [tempC, setTempC] = useState("");
  const [humidity, setHumidity] = useState("");
  const [co2, setCo2] = useState("");
  const [vpd, setVpd] = useState("");
  const [ppfd, setPpfd] = useState("");

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
      vpd_kpa: vpd ? Number(vpd) : null,
      ppfd_umol: ppfd ? Number(ppfd) : null,
      growlight_on: growlightOn,
      ac_on: acOn,
      fan_on: fanOn,
      notes: notes || null,
      recorded_by: user?.id,
    });

    if (error) {
      toast.error("Gagal menyimpan: " + error.message);
    } else {
      toast.success("Log lingkungan berhasil dicatat");
      router.push("/lingkungan");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <FloatingForm title="Catat Log Lingkungan" backHref="/lingkungan">
      <form onSubmit={handleSubmit} className="space-y-4">
            {/* Scope */}
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Lokasi Pengukuran</Label>
              <Select value={scope} onValueChange={(v) => v !== null && setScope(v as "room" | "rack")}>
                <SelectTrigger className="h-11 bg-secondary border-border/50 text-foreground">
                  <SelectValue>{scope === "room" ? "Seluruh Ruangan" : "Rak Tertentu"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">Seluruh Ruangan</SelectItem>
                  <SelectItem value="rack">Rak Tertentu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === "rack" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[13px] text-muted-foreground">Rak</Label>
                  <Select value={rack} onValueChange={(v) => v !== null && setRack(v)}>
                    <SelectTrigger className="h-11 bg-secondary border-border/50 text-foreground">
                      <SelectValue>{`Rak ${rack}`}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {RACK_CONFIG.racks.map((r) => (
                        <SelectItem key={r} value={r}>Rak {r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] text-muted-foreground">Tingkat</Label>
                  <Select value={tier} onValueChange={(v) => v !== null && setTier(v)}>
                    <SelectTrigger className="h-11 bg-secondary border-border/50 text-foreground">
                      <SelectValue>{`Tingkat ${tier}`}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {RACK_CONFIG.tiers.map((t) => (
                        <SelectItem key={t} value={String(t)}>Tingkat {t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Environmental readings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">Suhu Udara (°C)</Label>
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
                <Label className="text-[13px] text-muted-foreground">Kelembaban (%RH)</Label>
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
                <Label className="text-[13px] text-muted-foreground">VPD (kPa)</Label>
                <Input
                  type="number"
                  className="h-11 bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="1.2"
                  value={vpd}
                  onChange={(e) => setVpd(e.target.value)}
                  step="0.01"
                />
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
              <Label className="text-[13px] text-muted-foreground">Status Peralatan</Label>
              <div className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50">
                <span className="text-[13px] text-foreground">Growlight</span>
                <Switch checked={growlightOn} onCheckedChange={setGrowlightOn} />
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50">
                <span className="text-[13px] text-foreground">AC</span>
                <Switch checked={acOn} onCheckedChange={setAcOn} />
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50">
                <span className="text-[13px] text-foreground">Kipas Sirkulasi</span>
                <Switch checked={fanOn} onCheckedChange={setFanOn} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Catatan (opsional)</Label>
              <Textarea
                className="bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground/50"
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
