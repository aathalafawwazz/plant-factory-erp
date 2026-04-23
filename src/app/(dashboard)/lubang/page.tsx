import { createClient } from "@/lib/supabase/server";
import { getServerI18n } from "@/lib/i18n-server";
import { translateCommodity } from "@/lib/translate-helpers";
import { RackMap } from "@/components/rack-map";
import { PlantLogSection } from "@/components/plant-log-section";
import { RackMapSection } from "@/components/rack-map-section";
import {
  HoleActionPanel,
  type ActionableHole,
  type ActiveBatchSummary,
  type CommodityStat,
} from "@/components/hole-action-panel";
import { HoleStatusStats } from "@/components/hole-status-stats";
import type { HoleStatus } from "@/lib/constants";

// Always render fresh — hole/cycle data changes constantly
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HolePage() {
  const supabase = await createClient();
  const { t, lang } = await getServerI18n();

  const [holesResult, cyclesResult, cropsResult, batchesResult, researchAllocResult] = await Promise.all([
    supabase.from("holes").select("*").order("rack").order("tier").order("lane").order("hole_number"),
    supabase
      .from("planting_cycles")
      .select("*, crop_catalog(*), holes(canonical_id)")
      .in("status", ["planted", "growing", "ready_harvest"]),
    supabase.from("crop_catalog").select("*").order("name_id"),
    supabase
      .from("batches")
      .select("*, crop_catalog(name_id, grow_duration_days), planting_cycles(id)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("research_hole_allocations")
      .select("hole_id, treatment_label, research_projects(code, researcher_name)")
      .is("released_at", null),
  ]);

  const holes = holesResult.data ?? [];
  const cycles = cyclesResult.data ?? [];
  const crops = cropsResult.data ?? [];
  const batches = batchesResult.data ?? [];
  const researchAlloc = (researchAllocResult.data ?? []) as Array<{
    hole_id: number;
    treatment_label: string | null;
    research_projects: { code: string; researcher_name: string } | null;
  }>;
  const researchAllocations: Record<number, string> = {};
  for (const a of researchAlloc) {
    const proj = a.research_projects;
    const label = [
      proj?.code,
      proj?.researcher_name,
      a.treatment_label ? `(${a.treatment_label})` : null,
    ].filter(Boolean).join(" · ");
    researchAllocations[a.hole_id] = label ? `Riset: ${label}` : "Riset";
  }

  if (process.env.NODE_ENV !== "production") {
    if (cyclesResult.error) {
      const e = cyclesResult.error as { message?: string; details?: string; hint?: string; code?: string };
      console.error(`[lubang] cycles query error: code=${e.code} message=${e.message} details=${e.details} hint=${e.hint}`);
    }
    const activeHoles = holes.filter((h) => ["planted", "growing", "ready_harvest"].includes(h.status)).length;
    console.log(`[lubang] holes:${holes.length} activeHoles:${activeHoles} cycles:${cycles.length} batches:${batches.length} crops:${crops.length}`);
  }

  // Fetch crop_catalog_id for any holes whose current_cycle_id isn't covered by the
  // active-cycles query above (e.g. cycle status drifted outside planted/growing/ready_harvest).
  const activeHoleCycleIds = new Set<number>();
  for (const h of holes) {
    if (h.current_cycle_id != null && ["planted", "growing", "ready_harvest"].includes(h.status)) {
      activeHoleCycleIds.add(h.current_cycle_id);
    }
  }
  const knownCycleIds = new Set((cycles as Array<{ id: number }>).map((c) => c.id));
  const missingCycleIds = Array.from(activeHoleCycleIds).filter((id) => !knownCycleIds.has(id));
  let extraCycles: Array<{ id: number; crop_catalog_id: number | null }> = [];
  if (missingCycleIds.length > 0) {
    const { data } = await supabase
      .from("planting_cycles")
      .select("id, crop_catalog_id")
      .in("id", missingCycleIds);
    extraCycles = (data as Array<{ id: number; crop_catalog_id: number | null }>) ?? [];
  }

  // === Status counts ===
  const statusCounts: Record<HoleStatus, number> = {
    empty: 0, planted: 0, growing: 0, ready_harvest: 0, harvested: 0, maintenance: 0,
  };
  for (const h of holes) {
    const s = h.status as HoleStatus;
    if (s in statusCounts) statusCounts[s]++;
  }

  // === Build actionable holes list ===
  const now = Date.now();
  const actionables: ActionableHole[] = [];

  // Maintenance holes
  for (const h of holes) {
    if (h.status === "maintenance") {
      actionables.push({
        id: h.id,
        canonical_id: h.canonical_id,
        status: "maintenance",
      });
    }
  }

  type CycleWithRel = {
    hole_id: number;
    status: string;
    expected_harvest_at: string | null;
    crop_catalog: { name_id: string } | null;
    holes: { canonical_id: string } | null;
  };
  const cyclesTyped = cycles as unknown as CycleWithRel[];

  for (const c of cyclesTyped) {
    if (c.status === "ready_harvest") {
      const daysRemaining = c.expected_harvest_at
        ? Math.round((new Date(c.expected_harvest_at).getTime() - now) / (1000 * 60 * 60 * 24))
        : null;
      actionables.push({
        id: c.hole_id,
        canonical_id: c.holes?.canonical_id ?? `#${c.hole_id}`,
        status: "ready_harvest",
        crop_name: c.crop_catalog?.name_id ? translateCommodity(c.crop_catalog.name_id, lang) : null,
        days_remaining: daysRemaining,
      });
    }
  }

  // Also include cycles nearing harvest (within 3 days, status growing or planted)
  for (const c of cyclesTyped) {
    if (c.status !== "ready_harvest" && c.expected_harvest_at) {
      const days = Math.round((new Date(c.expected_harvest_at).getTime() - now) / (1000 * 60 * 60 * 24));
      if (days >= 0 && days <= 3) {
        actionables.push({
          id: c.hole_id,
          canonical_id: c.holes?.canonical_id ?? `#${c.hole_id}`,
          status: "ready_harvest",
          crop_name: c.crop_catalog?.name_id ? translateCommodity(c.crop_catalog.name_id, lang) : null,
          days_remaining: days,
        });
      }
    }
  }

  actionables.sort((a, b) => {
    if (a.status === "maintenance" && b.status !== "maintenance") return 1;
    if (b.status === "maintenance" && a.status !== "maintenance") return -1;
    const ad = a.days_remaining ?? 999;
    const bd = b.days_remaining ?? 999;
    return ad - bd;
  });

  // === Build active batch summaries ===
  const batchSummaries: ActiveBatchSummary[] = batches.map((b) => {
    const crop = b.crop_catalog as { name_id: string; grow_duration_days: number | null } | null;
    const cycleCount = (b.planting_cycles as { id: number }[] | null)?.length ?? 0;
    const plantedAt = b.planted_at ? new Date(b.planted_at) : null;
    const growDays = crop?.grow_duration_days ?? null;
    let daysElapsed = 0;
    let progressPct = 0;
    if (plantedAt) {
      daysElapsed = Math.max(0, Math.floor((now - plantedAt.getTime()) / (1000 * 60 * 60 * 24)));
    }
    if (growDays && growDays > 0) {
      progressPct = Math.min(100, Math.round((daysElapsed / growDays) * 100));
    }
    return {
      id: b.id,
      batch_code: b.batch_code,
      crop_name: crop?.name_id ? translateCommodity(crop.name_id, lang) : null,
      total_cycles: cycleCount,
      days_elapsed: daysElapsed,
      days_total: growDays,
      progress_pct: progressPct,
    };
  });

  // === Commodity stats: count active cycles per crop ===
  // Source of truth = holes.current_cycle_id joined to cycles, so it matches what
  // the rack map visually shows (holes.status). Fall back to "Komoditas #ID" if the
  // crop name lookup misses, so the panel never silently collapses to empty.
  const cropNameById = new Map<number, string>();
  for (const cr of crops) {
    if (cr.id != null && cr.name_id) cropNameById.set(cr.id, cr.name_id);
  }
  const cycleCropById = new Map<number, number>();
  for (const c of cycles as unknown as Array<{ id: number; crop_catalog_id: number | null }>) {
    if (c.crop_catalog_id != null) cycleCropById.set(c.id, c.crop_catalog_id);
  }
  for (const c of extraCycles) {
    if (c.crop_catalog_id != null) cycleCropById.set(c.id, c.crop_catalog_id);
  }
  const commodityMap = new Map<string, number>();
  for (const h of holes) {
    if (!["planted", "growing", "ready_harvest"].includes(h.status)) continue;
    const cropId = h.current_cycle_id != null ? cycleCropById.get(h.current_cycle_id) : undefined;
    if (cropId == null) continue;
    const raw = cropNameById.get(cropId) ?? `${t("cult.commodity")} #${cropId}`;
    const name = translateCommodity(raw, lang);
    commodityMap.set(name, (commodityMap.get(name) ?? 0) + 1);
  }
  const commodities: CommodityStat[] = Array.from(commodityMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // DEBUG (dev only): log mismatch between crops list & cycle crop IDs
  if (process.env.NODE_ENV !== "production") {
    const missingIds = new Set<number>();
    for (const c of cycles as unknown as Array<{ crop_catalog_id: number | null }>) {
      if (c.crop_catalog_id != null && !cropNameById.has(c.crop_catalog_id)) {
        missingIds.add(c.crop_catalog_id);
      }
    }
    if (missingIds.size > 0) {
      console.warn(
        `[lubang] ${missingIds.size} crop IDs in cycles not found in crop_catalog:`,
        Array.from(missingIds),
        "— crops loaded:", crops.length
      );
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-foreground">{t("cult.hole_map_log")}</h1>

      <RackMapSection
        statsRow={<HoleStatusStats counts={statusCounts} />}
        sidePanel={<HoleActionPanel actionables={actionables} batches={batchSummaries} commodities={commodities} />}
      >
        <RackMap holes={holes} cycles={cycles as never} crops={crops} researchAllocations={researchAllocations} />
      </RackMapSection>

      <PlantLogSection />
    </div>
  );
}
