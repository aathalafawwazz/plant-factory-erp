import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HOLE_STATUS, type HoleStatus } from "@/lib/constants";
import { ShoppingCart, Package } from "lucide-react";
import { HarvestDonutChart, EnvironmentChart, NutrientChart } from "@/components/dashboard-charts";

// SVG-safe hex colors for each status
const STATUS_HEX: Record<HoleStatus, string> = {
  empty: "#3a3d45",
  planted: "#638cff",
  growing: "#4ade80",
  ready_harvest: "#f59e0b",
  harvested: "#2dd4bf",
  maintenance: "#ef4444",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Current month boundaries for sales filtering
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const [holesResult, upcomingResult, envResult, batchesResult, salesResult, harvestWeightResult, soldWeightResult, nutrientResult] = await Promise.all([
    supabase.from("holes").select("status"),
    supabase
      .from("planting_cycles")
      .select("*, holes(canonical_id), crop_catalog(name_id)")
      .in("status", ["planted", "growing", "ready_harvest"])
      .not("expected_harvest_at", "is", null)
      .lte("expected_harvest_at", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("expected_harvest_at", { ascending: true })
      .limit(10),
    supabase
      .from("environmental_logs")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(20),
    supabase
      .from("batches")
      .select("*, crop_catalog(name_id, grow_duration_days), planting_cycles(id)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("sales_orders")
      .select("total_amount, grand_total, status, order_date")
      .in("status", ["delivered", "paid"])
      .gte("order_date", monthStart)
      .lte("order_date", monthEnd),
    // Total harvest weight (all harvested cycles)
    supabase
      .from("planting_cycles")
      .select("harvest_weight_g")
      .eq("status", "harvested")
      .not("harvest_weight_g", "is", null),
    // Total sold weight
    supabase
      .from("sales_order_items")
      .select("quantity_kg"),
    // Nutrient logs
    supabase
      .from("nutrient_logs")
      .select("mixed_at, ec_actual, ph_actual, volume_liters")
      .order("mixed_at", { ascending: false })
      .limit(20),
  ]);

  const holes = holesResult.data ?? [];
  const upcoming = upcomingResult.data ?? [];
  const envLogs = envResult.data ?? [];
  const activeBatches = batchesResult.data ?? [];
  const salesOrders = salesResult.data ?? [];
  const nutrientLogs = nutrientResult.data ?? [];

  // Status counts
  const statusCounts: Record<HoleStatus, number> = {
    empty: 0, planted: 0, growing: 0, ready_harvest: 0, harvested: 0, maintenance: 0,
  };
  holes.forEach((h) => {
    const s = h.status as HoleStatus;
    if (s in statusCounts) statusCounts[s]++;
  });

  const totalActive = statusCounts.planted + statusCounts.growing + statusCounts.ready_harvest;
  const totalHoles = holes.length || 1;

  // Harvest progress
  const harvestableTotal = totalActive + statusCounts.harvested;
  const harvestPct = harvestableTotal > 0
    ? Math.round((statusCounts.harvested / harvestableTotal) * 100)
    : 0;

  // Latest environment reading
  const latestEnv = envLogs.length > 0 ? envLogs[0] : null;

  // Sales summary
  const salesRevenue = salesOrders.reduce((sum, o) => sum + (o.grand_total ?? 0), 0);
  const salesOrderCount = salesOrders.length;

  // Stock: total harvested weight - total sold weight (in kg)
  const totalHarvestKg = (harvestWeightResult.data ?? []).reduce(
    (sum, c) => sum + ((c.harvest_weight_g ?? 0) / 1000), 0
  );
  const totalSoldKg = (soldWeightResult.data ?? []).reduce(
    (sum, i) => sum + (i.quantity_kg ?? 0), 0
  );
  const availableStockKg = Math.max(0, totalHarvestKg - totalSoldKg);

  // Chart data: environment
  const envChartData = envLogs.reverse().map((l) => ({
    time: new Date(l.recorded_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    suhu: l.temperature_c, rh: l.humidity_pct, co2: l.co2_ppm, vpd: l.vpd_kpa, ppfd: l.ppfd_umol,
  }));

  // Chart data: nutrients
  const nutrientChartData = nutrientLogs.reverse().map((l) => ({
    time: new Date(l.mixed_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    ec: l.ec_actual, ph: l.ph_actual, volume: l.volume_liters,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Ringkasan kondisi plant factory</p>
      </div>

      {/* === Row 1: Quick Stats (4 cards) === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Lubang Aktif — blue highlight */}
        <div className="rounded-xl border border-[oklch(0.65_0.18_260/0.2)] bg-[oklch(0.65_0.18_260/0.06)] p-4">
          <span className="text-[11px] text-[oklch(0.75_0.15_260)] uppercase tracking-wide">Total Lubang Aktif</span>
          <p className="text-2xl font-bold text-[oklch(0.75_0.15_260)] mt-1">{totalActive}</p>
          <p className="text-[10px] text-muted-foreground">Ditanam + Tumbuh + Siap Panen</p>
        </div>

        {/* Siap Panen — amber */}
        <div className="rounded-lg border border-[oklch(0.75_0.17_80/0.2)] bg-[oklch(0.75_0.17_80/0.06)] p-4">
          <span className="text-[11px] text-[oklch(0.80_0.14_80)] uppercase tracking-wide">Siap Panen</span>
          <p className="text-2xl font-bold text-[oklch(0.80_0.14_80)] mt-1">{statusCounts.ready_harvest}</p>
          <p className="text-[10px] text-muted-foreground">Lubang ready harvest</p>
        </div>

        {/* Total Dipanen — teal */}
        <div className="rounded-lg border border-[oklch(0.72_0.12_180/0.2)] bg-[oklch(0.72_0.12_180/0.06)] p-4">
          <span className="text-[11px] text-[oklch(0.72_0.12_180)] uppercase tracking-wide">Total Dipanen</span>
          <p className="text-2xl font-bold text-[oklch(0.72_0.12_180)] mt-1">{statusCounts.harvested}</p>
          <p className="text-[10px] text-muted-foreground">Lubang harvested</p>
        </div>

        {/* Batch Aktif */}
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Batch Aktif</span>
          <p className="text-2xl font-bold text-foreground mt-1">{activeBatches.length}</p>
          <p className="text-[10px] text-muted-foreground">Batch sedang berjalan</p>
        </div>
      </div>

      {/* === Row 2: Status Distribution Stacked Bar === */}
      <div className="rounded-lg border border-border/40 bg-card">
        <div className="px-4 py-3 border-b border-border/30">
          <h3 className="text-[13px] font-semibold text-foreground">Distribusi Status Lubang</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="w-full h-6 rounded-full overflow-hidden flex bg-secondary/30">
            {(Object.keys(HOLE_STATUS) as HoleStatus[]).map((key) => {
              const count = statusCounts[key];
              if (count === 0) return null;
              const pct = (count / totalHoles) * 100;
              return (
                <div
                  key={key}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: STATUS_HEX[key],
                    minWidth: count > 0 ? "4px" : "0",
                  }}
                  className="h-full transition-all"
                  title={`${HOLE_STATUS[key].label}: ${count}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {(Object.keys(HOLE_STATUS) as HoleStatus[]).map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm inline-block"
                  style={{ backgroundColor: STATUS_HEX[key] }}
                />
                <span className="text-[11px] text-muted-foreground">
                  {HOLE_STATUS[key].label}
                </span>
                <span className="text-[12px] font-medium text-foreground">
                  {statusCounts[key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* === Row 3: FULL-WIDTH Environment Chart === */}
      <div className="rounded-lg border border-border/40 bg-card">
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-[13px] font-semibold text-foreground">Ikhtisar Lingkungan</h3>
          {latestEnv && (
            <div className="flex flex-wrap gap-1.5">
              {latestEnv.temperature_c !== null && (
                <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#ef4444]/10 text-[#ef4444]">Suhu: {latestEnv.temperature_c}°C</span>
              )}
              {latestEnv.humidity_pct !== null && (
                <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#638cff]/10 text-[#638cff]">RH: {latestEnv.humidity_pct}%</span>
              )}
              {latestEnv.co2_ppm !== null && (
                <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#a78bfa]/10 text-[#a78bfa]">CO2: {latestEnv.co2_ppm} ppm</span>
              )}
              {latestEnv.vpd_kpa !== null && (
                <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#4ade80]/10 text-[#4ade80]">VPD: {latestEnv.vpd_kpa} kPa</span>
              )}
              {latestEnv.ppfd_umol !== null && (
                <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#22d3ee]/10 text-[#22d3ee]">PPFD: {latestEnv.ppfd_umol} umol</span>
              )}
            </div>
          )}
        </div>
        <div className="p-4">
          {envChartData.length >= 2 ? (
            <EnvironmentChart data={envChartData} />
          ) : (
            <p className="text-[13px] text-muted-foreground text-center py-8">Data lingkungan belum cukup untuk ditampilkan.</p>
          )}
        </div>
      </div>

      {/* === Row 4: FULL-WIDTH Nutrient Chart === */}
      <div className="rounded-lg border border-border/40 bg-card">
        <div className="px-4 py-3 border-b border-border/30">
          <h3 className="text-[13px] font-semibold text-foreground">Ikhtisar Nutrisi</h3>
        </div>
        <div className="p-4">
          {nutrientChartData.length >= 2 ? (
            <NutrientChart data={nutrientChartData} />
          ) : (
            <p className="text-[13px] text-muted-foreground text-center py-8">Data nutrisi belum cukup untuk ditampilkan.</p>
          )}
        </div>
      </div>

      {/* === Row 5: Harvest Progress Donut + Panen Mendatang === */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Harvest Progress Donut */}
        <div className="rounded-lg border border-border/40 bg-card p-4 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide mb-3">Progres Panen</span>
          <HarvestDonutChart harvested={statusCounts.harvested} active={totalActive} pct={harvestPct} />
          <div className="mt-2 text-center">
            <span className="text-[11px] text-muted-foreground">
              {statusCounts.harvested} dari {harvestableTotal} dipanen
            </span>
          </div>
        </div>

        {/* Panen Mendatang */}
        <div className="rounded-lg border border-border/40 bg-card">
          <div className="px-4 py-3 border-b border-border/30">
            <h3 className="text-[13px] font-semibold text-foreground">Panen 7 Hari ke Depan</h3>
          </div>
          <div className="p-4">
            {upcoming.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Tidak ada panen dalam waktu dekat.</p>
            ) : (
              <div className="space-y-1">
                {upcoming.map((cycle) => {
                  const hole = cycle.holes as unknown as { canonical_id: string } | null;
                  const crop = cycle.crop_catalog as unknown as { name_id: string } | null;
                  return (
                    <div key={cycle.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground">{hole?.canonical_id}</span>
                        <span className="text-[12px] text-muted-foreground">{crop?.name_id}</span>
                      </div>
                      <span className="text-[12px] text-muted-foreground">
                        {cycle.expected_harvest_at
                          ? new Date(cycle.expected_harvest_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
                          : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === Row 6: Batch Aktif + Sales/Stock Summary === */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Batch Aktif with progress bars */}
        <div className="rounded-lg border border-border/40 bg-card">
          <div className="px-4 py-3 border-b border-border/30">
            <h3 className="text-[13px] font-semibold text-foreground">Batch Aktif</h3>
          </div>
          <div className="p-4">
            {activeBatches.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Tidak ada batch aktif.</p>
            ) : (
              <div className="space-y-1">
                {activeBatches.map((batch) => {
                  const crop = batch.crop_catalog as unknown as { name_id: string; grow_duration_days: number | null } | null;
                  const cycleCount = (batch.planting_cycles as unknown as { id: number }[])?.length ?? 0;

                  const plantedAt = batch.planted_at ? new Date(batch.planted_at) : null;
                  const growDays = crop?.grow_duration_days ?? null;
                  let progressPct = 0;
                  let daysElapsed = 0;
                  if (plantedAt && growDays && growDays > 0) {
                    daysElapsed = Math.max(0, Math.floor((Date.now() - plantedAt.getTime()) / (1000 * 60 * 60 * 24)));
                    progressPct = Math.min(100, Math.round((daysElapsed / growDays) * 100));
                  }

                  return (
                    <div key={batch.id} className="py-2 border-b border-border/20 last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-foreground">{batch.batch_code}</span>
                          <span className="text-[12px] text-muted-foreground">{crop?.name_id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] rounded-full px-2 py-0.5 bg-secondary text-muted-foreground">{cycleCount} lubang</span>
                          <span className="text-[11px] text-muted-foreground">
                            {plantedAt
                              ? plantedAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
                              : "-"}
                          </span>
                        </div>
                      </div>
                      {growDays && growDays > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${progressPct}%`,
                                backgroundColor: progressPct >= 90 ? "#f59e0b" : "#4ade80",
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {daysElapsed}/{growDays}h
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sales / Stock Summary */}
        <div className="space-y-4">
          {/* Sales Summary */}
          <div className="rounded-lg border border-border/40 bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Penjualan Bulan Ini</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              Rp {salesRevenue.toLocaleString("id-ID")}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {salesOrderCount} order (delivered/paid)
            </p>
            <Link href="/penjualan" className="text-[11px] text-[oklch(0.75_0.15_260)] hover:underline mt-2 inline-block">
              Lihat detail
            </Link>
          </div>

          {/* Stok Tersedia */}
          <div className="rounded-lg border border-border/40 bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Stok Tersedia</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {availableStockKg.toFixed(1)} <span className="text-[13px] text-muted-foreground">kg</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Total panen {totalHarvestKg.toFixed(1)} kg - terjual {totalSoldKg.toFixed(1)} kg
            </p>
            <Link href="/penjualan" className="text-[11px] text-[oklch(0.75_0.15_260)] hover:underline mt-2 inline-block">
              Lihat stok
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
