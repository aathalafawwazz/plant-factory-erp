"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Sprout, FlaskConical } from "lucide-react";
import { useLang } from "@/lib/i18n";

export interface MiniRackHole {
  id: number;
  canonical_id: string;
  rack: string;
  tier: number;
  lane: number;
  hole_number: number;
  status: string;  // empty / planted / growing / ready_harvest / harvested / maintenance
}

export interface MiniRackAllocation {
  hole_id: number;
  treatment_label: string | null;
  treatment_group: string | null;
  released_at: string | null;
}

interface Props {
  holes: MiniRackHole[];
  allocations: MiniRackAllocation[];  // semua alokasi proyek ini (aktif + released)
}

/**
 * Visualisasi peta lubang (seluruh rak) dengan highlight lubang milik proyek riset.
 * - Warna latar mengikuti status holes (selaras dengan rack-map utama — versi subdued).
 * - Lubang proyek ini di-highlight ring ungu + badge treatment_label saat hover.
 * - Lubang yang sudah dilepas (released_at) ditampilkan dengan opacity lebih rendah.
 */
export function ResearchMiniRackMap({ holes, allocations }: Props) {
  const { t } = useLang();
  const activeAllocMap = useMemo(() => {
    const m = new Map<number, MiniRackAllocation>();
    for (const a of allocations.filter((x) => x.released_at == null)) m.set(a.hole_id, a);
    return m;
  }, [allocations]);
  const releasedAllocMap = useMemo(() => {
    const m = new Map<number, MiniRackAllocation>();
    for (const a of allocations.filter((x) => x.released_at != null)) m.set(a.hole_id, a);
    return m;
  }, [allocations]);

  // rack → tier → lane → holes
  type Grouped = Record<string, Record<number, Record<number, MiniRackHole[]>>>;
  const grouped: Grouped = useMemo(() => {
    const out: Grouped = {};
    for (const h of holes) {
      out[h.rack] ??= {};
      out[h.rack][h.tier] ??= {};
      out[h.rack][h.tier][h.lane] ??= [];
      out[h.rack][h.tier][h.lane].push(h);
    }
    for (const r of Object.values(out))
      for (const t of Object.values(r))
        for (const l of Object.values(t))
          l.sort((a, b) => a.hole_number - b.hole_number);
    return out;
  }, [holes]);

  const rackNames = Object.keys(grouped).sort();
  const activeCount = activeAllocMap.size;
  const releasedCount = releasedAllocMap.size;

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-violet-400 bg-violet-400/20" />
          <span className="text-muted-foreground">{t("rmrm.active_project")}</span>
          <span className="text-foreground font-medium tabular-nums">{activeCount}</span>
        </span>
        {releasedCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border-2 border-violet-400/40 bg-violet-400/10" />
            <span className="text-muted-foreground">{t("rmrm.released")}</span>
            <span className="text-foreground font-medium tabular-nums">{releasedCount}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-secondary/60 border border-border/40" />
          <span className="text-muted-foreground">{t("rmrm.empty")}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-blue-400/20 border border-blue-400/30" />
          <span className="text-muted-foreground">{t("rmrm.planted")}</span>
        </span>
      </div>

      <div className={cn("grid gap-3", rackNames.length > 1 ? "md:grid-cols-2" : "grid-cols-1")}>
        {rackNames.map((rackName) => {
          const tiers = Object.entries(grouped[rackName])
            .map(([t, lanes]) => ({
              tier: Number(t),
              lanes: Object.entries(lanes)
                .map(([l, hs]) => ({ lane: Number(l), holes: hs }))
                .sort((a, b) => a.lane - b.lane),
            }))
            .sort((a, b) => b.tier - a.tier);

          const rackAllocCount = tiers
            .flatMap((t) => t.lanes.flatMap((l) => l.holes))
            .filter((h) => activeAllocMap.has(h.id) || releasedAllocMap.has(h.id)).length;

          return (
            <div key={rackName} className="rounded-lg border border-border/40 bg-secondary/10 overflow-hidden">
              <div className="px-3 py-2 bg-secondary/30 border-b border-border/40 flex items-center justify-between">
                <h4 className="text-[12px] font-semibold text-foreground tracking-wider">{t("rmrm.rack")} {rackName}</h4>
                {rackAllocCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-violet-400">
                    <FlaskConical className="h-3 w-3" />
                    {rackAllocCount} {t("rmrm.research_holes")}
                  </span>
                )}
              </div>
              <div className="p-2 space-y-2">
                {tiers.map(({ tier, lanes }) => {
                  const tierAlloc = lanes.flatMap((l) => l.holes).filter((h) => activeAllocMap.has(h.id)).length;
                  return (
                    <div key={tier} className="rounded-md border border-border/30 bg-card/50 p-2 space-y-1 overflow-x-auto">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          {t("rmrm.tier")} {tier}
                        </span>
                        {tierAlloc > 0 && (
                          <span className="text-[10px] text-violet-400 tabular-nums">{tierAlloc} {t("rmrm.research_short")}</span>
                        )}
                      </div>
                      {lanes.map(({ lane, holes }) => (
                        <div key={lane} className="flex items-center gap-1">
                          <span className="text-[9px] w-5 text-muted-foreground shrink-0 tabular-nums">L{lane}</span>
                          <div className="flex items-center gap-0.5 flex-nowrap">
                            {holes.map((h) => (
                              <MiniHoleCell
                                key={h.id}
                                hole={h}
                                activeAlloc={activeAllocMap.get(h.id)}
                                releasedAlloc={releasedAllocMap.get(h.id)}
                                labels={{
                                  treatment: t("rmrm.tt_treatment"),
                                  group: t("rmrm.tt_group"),
                                  released: t("rmrm.tt_released"),
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
function MiniHoleCell({
  hole, activeAlloc, releasedAlloc, labels,
}: {
  hole: MiniRackHole;
  activeAlloc?: MiniRackAllocation;
  releasedAlloc?: MiniRackAllocation;
  labels: { treatment: string; group: string; released: string };
}) {
  // Base color by status (subdued)
  const statusBg =
    hole.status === "planted" ? "bg-blue-400/15 border-blue-400/25"
    : hole.status === "growing" ? "bg-emerald-400/15 border-emerald-400/25"
    : hole.status === "ready_harvest" ? "bg-amber-400/15 border-amber-400/25"
    : hole.status === "harvested" ? "bg-teal-400/10 border-teal-400/20"
    : hole.status === "maintenance" ? "bg-rose-400/10 border-rose-400/20"
    : "bg-secondary/50 border-border/30";

  const ring = activeAlloc
    ? "ring-2 ring-violet-400 ring-offset-[1px] ring-offset-background"
    : releasedAlloc
      ? "ring-1 ring-violet-400/40 ring-offset-[1px] ring-offset-background opacity-70"
      : "";

  const tooltipParts = [hole.canonical_id];
  if (activeAlloc?.treatment_label) tooltipParts.push(`${labels.treatment} ${activeAlloc.treatment_label}`);
  if (activeAlloc?.treatment_group) tooltipParts.push(`${labels.group} ${activeAlloc.treatment_group}`);
  if (releasedAlloc) tooltipParts.push(labels.released);
  const tooltip = tooltipParts.join(" · ");

  return (
    <div
      title={tooltip}
      className={cn(
        "relative h-6 w-6 rounded border text-[9px] font-medium flex items-center justify-center tabular-nums",
        statusBg,
        ring,
      )}
    >
      {activeAlloc?.treatment_label ? (
        <span className="text-violet-300 truncate px-0.5 text-[8px] leading-none">
          {activeAlloc.treatment_label.slice(0, 3)}
        </span>
      ) : activeAlloc || releasedAlloc ? (
        <FlaskConical className="h-2.5 w-2.5 text-violet-300" />
      ) : (
        <span className="text-muted-foreground/70">{hole.hole_number}</span>
      )}
      {hole.status === "planted" && !activeAlloc && (
        <Sprout className="absolute inset-0 m-auto h-2 w-2 text-blue-400/60" />
      )}
    </div>
  );
}
