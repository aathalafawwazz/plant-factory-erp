"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Lock, Search, Sprout, Wrench, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

export interface HolePickerOption {
  id: number;
  canonical_id: string;
  rack: string;
  tier: number;
  lane: number;
  hole_number: number;
  status: string;            // empty / planted / growing / ready_harvest / harvested / maintenance
  reservedByOther: boolean;  // reservasi riset milik proyek lain
}

interface Props {
  open: boolean;
  onClose: () => void;
  allHoles: HolePickerOption[];
  selectedIds: Set<number>;
  onChange: (next: Set<number>) => void;
  /** IDs yang sudah menjadi milik proyek yang sedang dibuka. Ditampilkan sebagai "terpilih sebelumnya". */
  ownedByThisProject?: Set<number>;
}

function isSelectable(h: HolePickerOption, ownedByThisProject?: Set<number>): boolean {
  if (ownedByThisProject?.has(h.id)) return false;   // sudah dipakai proyek ini (display only)
  if (h.reservedByOther) return false;
  return h.status === "empty";
}

export function ResearchHolePicker({
  open, onClose, allHoles, selectedIds, onChange, ownedByThisProject,
}: Props) {
  const { t } = useLang();
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<Set<number>>(selectedIds);

  useEffect(() => { if (open) setDraft(new Set(selectedIds)); }, [open, selectedIds]);

  // Statistik global
  const stats = useMemo(() => {
    let available = 0, planted = 0, reserved = 0, maintenance = 0;
    for (const h of allHoles) {
      if (ownedByThisProject?.has(h.id)) continue;
      if (h.reservedByOther) reserved++;
      else if (h.status === "empty") available++;
      else if (h.status === "maintenance") maintenance++;
      else planted++;
    }
    return { total: allHoles.length, available, planted, reserved, maintenance };
  }, [allHoles, ownedByThisProject]);

  const filtered = useMemo(() => {
    if (!filter) return allHoles;
    const q = filter.toLowerCase();
    return allHoles.filter((h) => h.canonical_id.toLowerCase().includes(q));
  }, [allHoles, filter]);

  // Grouping rack → tier → lane → holes (semua lubang, bukan cuma yang cocok filter — filter cuma highlight)
  type Grouped = Record<string, Record<number, Record<number, HolePickerOption[]>>>;
  const grouped: Grouped = useMemo(() => {
    const out: Grouped = {};
    for (const h of allHoles) {
      out[h.rack] ??= {};
      out[h.rack][h.tier] ??= {};
      out[h.rack][h.tier][h.lane] ??= [];
      out[h.rack][h.tier][h.lane].push(h);
    }
    for (const r of Object.values(out)) {
      for (const t of Object.values(r)) {
        for (const l of Object.values(t)) l.sort((a, b) => a.hole_number - b.hole_number);
      }
    }
    return out;
  }, [allHoles]);

  const filteredIds = useMemo(() => new Set(filtered.map((h) => h.id)), [filtered]);

  function toggle(id: number) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleLane(holes: HolePickerOption[]) {
    const selectable = holes.filter((h) => isSelectable(h, ownedByThisProject));
    if (selectable.length === 0) return;
    setDraft((prev) => {
      const next = new Set(prev);
      const allSelected = selectable.every((h) => next.has(h.id));
      if (allSelected) selectable.forEach((h) => next.delete(h.id));
      else selectable.forEach((h) => next.add(h.id));
      return next;
    });
  }

  function toggleTier(tierHoles: HolePickerOption[]) {
    const selectable = tierHoles.filter((h) => isSelectable(h, ownedByThisProject));
    if (selectable.length === 0) return;
    setDraft((prev) => {
      const next = new Set(prev);
      const allSelected = selectable.every((h) => next.has(h.id));
      if (allSelected) selectable.forEach((h) => next.delete(h.id));
      else selectable.forEach((h) => next.add(h.id));
      return next;
    });
  }

  function clearAll() { setDraft(new Set()); }
  function apply() { onChange(draft); onClose(); }

  const rackNames = Object.keys(grouped).sort();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[880px] bg-card border-border/50 p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="inline-flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            {t("rhp.title")}
          </DialogTitle>
          <p className="text-[12px] text-muted-foreground mt-1">
            {t("rhp.hint")}
          </p>
        </DialogHeader>

        {/* Stats bar */}
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap shrink-0">
          <Chip tone="emerald" label={t("rhp.available")} value={stats.available} icon={<Sprout className="h-3 w-3" />} />
          <Chip tone="violet" label={t("rhp.other_research")} value={stats.reserved} icon={<FlaskConical className="h-3 w-3" />} />
          <Chip tone="blue" label={t("rhp.planted")} value={stats.planted} icon={<Sprout className="h-3 w-3" />} />
          <Chip tone="rose" label={t("rhp.maintenance")} value={stats.maintenance} icon={<Wrench className="h-3 w-3" />} />
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{t("rhp.selected_label")}</span>
            <span className="px-1.5 py-0.5 rounded bg-primary text-white text-[11px] font-semibold tabular-nums">
              {draft.size}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-9 bg-secondary border-border/50 pl-8"
              placeholder={t("rhp.search_placeholder")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Body: rack panels side-by-side */}
        <div className="px-5 pb-3 flex-1 overflow-y-auto">
          <div className="space-y-4">
            {rackNames.map((rackName) => {
              const tiers = Object.entries(grouped[rackName])
                .map(([t, lanes]) => ({
                  tier: Number(t),
                  lanes: Object.entries(lanes)
                    .map(([l, holes]) => ({ lane: Number(l), holes }))
                    .sort((a, b) => a.lane - b.lane),
                }))
                .sort((a, b) => b.tier - a.tier); // tinggi ke rendah, mengikuti peta real

              return (
                <div key={rackName} className="rounded-lg border border-border/40 bg-secondary/10 overflow-hidden">
                  <div className="px-3 py-2 bg-secondary/30 border-b border-border/40">
                    <h3 className="text-[12px] font-semibold text-foreground tracking-wider">{t("rhp.rack")} {rackName}</h3>
                  </div>
                  <div className="p-2 space-y-2">
                    {tiers.map(({ tier, lanes }) => {
                      const tierHoles = lanes.flatMap((l) => l.holes);
                      const tierSelectable = tierHoles.filter((h) => isSelectable(h, ownedByThisProject));
                      const tierSelectedCount = tierSelectable.filter((h) => draft.has(h.id)).length;
                      return (
                        <div key={tier} className="rounded-md border border-border/30 bg-card/60 p-2 space-y-1.5">
                          <div className="flex items-center justify-between px-1">
                            <button type="button" onClick={() => toggleTier(tierHoles)}
                              className="text-[11px] font-semibold text-foreground hover:text-primary transition-colors">
                              {t("rhp.tier")} {tier}
                            </button>
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {tierSelectedCount}/{tierSelectable.length} {t("rhp.tier_count")}
                            </span>
                          </div>
                          {lanes.map(({ lane, holes }) => {
                            const selectable = holes.filter((h) => isSelectable(h, ownedByThisProject));
                            const allLaneSelected = selectable.length > 0 && selectable.every((h) => draft.has(h.id));
                            return (
                              <div key={lane} className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => toggleLane(holes)}
                                  disabled={selectable.length === 0}
                                  className={cn(
                                    "text-[10px] font-semibold w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors",
                                    allLaneSelected
                                      ? "bg-primary text-white"
                                      : selectable.length === 0
                                        ? "bg-secondary/30 text-muted-foreground/30 cursor-not-allowed"
                                        : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                                  )}
                                  title={selectable.length === 0 ? t("rhp.no_lane_avail") : `L${lane}: ${selectable.length} ${t("rhp.lane_avail")}`}
                                >
                                  L{lane}
                                </button>
                                <div className="flex items-center gap-0.5 flex-nowrap">
                                  {holes.map((h) => (
                                    <HoleButton
                                      key={h.id}
                                      hole={h}
                                      picked={draft.has(h.id)}
                                      owned={ownedByThisProject?.has(h.id) ?? false}
                                      highlighted={filteredIds.has(h.id) && !!filter}
                                      onClick={() => toggle(h.id)}
                                      labels={{
                                        owned: t("rhp.tt_owned"),
                                        willPick: t("rhp.tt_will_pick"),
                                        other: t("rhp.tt_other"),
                                        avail: t("rhp.tt_avail"),
                                        maint: t("rhp.tt_maint"),
                                        planted: t("rhp.tt_planted"),
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/30 px-5 py-3 flex items-center justify-between gap-3 shrink-0 bg-card">
          <div className="flex items-center gap-2">
            <p className="text-[12px] text-muted-foreground">
              <span className="text-foreground font-medium tabular-nums">{draft.size}</span> {t("rhp.holes_selected")}
            </p>
            {draft.size > 0 && (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={clearAll}>
                {t("rhp.clear")}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="h-9 border-border/50" onClick={onClose}>
              {t("rhp.cancel")}
            </Button>
            <Button type="button" onClick={apply} className="h-9 bg-primary hover:bg-primary/90 text-white">
              {t("rhp.apply")} ({draft.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
function Chip({ tone, label, value, icon }: { tone: "emerald" | "violet" | "blue" | "rose"; label: string; value: number; icon: React.ReactNode }) {
  const colorMap: Record<typeof tone, string> = {
    emerald: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
    violet:  "bg-violet-400/10 text-violet-400 border-violet-400/30",
    blue:    "bg-blue-400/10 text-blue-400 border-blue-400/30",
    rose:    "bg-rose-400/10 text-rose-400 border-rose-400/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium", colorMap[tone])}>
      {icon}
      {label}
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function HoleButton({
  hole, picked, owned, highlighted, onClick, labels,
}: {
  hole: HolePickerOption;
  picked: boolean;
  owned: boolean;
  highlighted: boolean;
  onClick: () => void;
  labels: {
    owned: string; willPick: string; other: string;
    avail: string; maint: string; planted: string;
  };
}) {
  const selectable = !owned && !hole.reservedByOther && hole.status === "empty";
  const style = owned
    ? "bg-primary/30 text-primary border-primary/40"
    : picked
      ? "bg-primary text-white border-primary ring-1 ring-primary"
      : hole.reservedByOther
        ? "bg-violet-400/10 text-violet-400/60 border-violet-400/20 cursor-not-allowed"
        : hole.status === "planted" || hole.status === "growing" || hole.status === "ready_harvest"
          ? "bg-blue-400/10 text-blue-400/50 border-blue-400/20 cursor-not-allowed"
          : hole.status === "maintenance"
            ? "bg-rose-400/10 text-rose-400/50 border-rose-400/20 cursor-not-allowed"
            : "bg-secondary/60 text-muted-foreground border-border/40 hover:text-foreground hover:bg-secondary hover:border-border";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable}
      title={`${hole.canonical_id} — ${
        owned ? labels.owned
        : picked ? labels.willPick
        : hole.reservedByOther ? labels.other
        : hole.status === "empty" ? labels.avail
        : hole.status === "maintenance" ? labels.maint
        : labels.planted
      }`}
      className={cn(
        "h-7 w-7 rounded border text-[10px] font-medium transition-all flex items-center justify-center",
        style,
        highlighted && "ring-2 ring-amber-400/70 ring-offset-[1px] ring-offset-background",
      )}
    >
      {owned ? <Check className="h-3 w-3" />
        : picked ? <Check className="h-3.5 w-3.5" />
        : !selectable ? <Lock className="h-2.5 w-2.5" />
        : hole.hole_number}
    </button>
  );
}
