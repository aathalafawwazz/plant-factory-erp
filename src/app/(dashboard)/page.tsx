import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerI18n } from "@/lib/i18n-server";
import { translateCommodity, translateInventoryCategory, formatDateLocale } from "@/lib/translate-helpers";
import { HOLE_STATUS, type HoleStatus } from "@/lib/constants";
import { Wallet, Receipt, Package, PackageMinus, Activity } from "lucide-react";
import { EnvironmentChart, NutrientChart } from "@/components/dashboard-charts";
import { DashboardPeriodCard, type PeriodData } from "@/components/dashboard-period-card";
import { DashboardMiniCalendar, type CalendarMarker, type UpcomingEvent } from "@/components/dashboard-mini-calendar";

// SVG-safe hex colors for each status
const STATUS_HEX: Record<HoleStatus, string> = {
  empty: "#3a3d45",
  planted: "#638cff",
  growing: "#4ade80",
  ready_harvest: "#f59e0b",
  harvested: "#2dd4bf",
  maintenance: "#ef4444",
};

// Return ISO window boundaries for "today", "this week" (Monday start), "this month"
function periodBounds(now: Date) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = now.getDay(); // 0 = Sun
  const daysFromMon = (dow + 6) % 7;
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - daysFromMon);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    today: startOfToday.toISOString(),
    week: startOfWeek.toISOString(),
    month: startOfMonth.toISOString(),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { t, lang } = await getServerI18n();
  const now = new Date();
  const bounds = periodBounds(now);

  const [
    holesResult,
    envResult,
    batchesResult,
    salesResult,
    nutrientResult,
    expensesResult,
    inventoryResult,
    stockOutResult,
    upcomingHarvestResult,
    recentActivitiesResult,
    visitsResult,
    researchResult,
  ] = await Promise.all([
    supabase.from("holes").select("status"),
    supabase.from("environmental_logs").select("*").order("recorded_at", { ascending: false }).limit(20),
    supabase
      .from("batches")
      .select("*, crop_catalog(name_id, grow_duration_days), planting_cycles(id)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
    // All paid/delivered orders in the month (we'll bucket them client-side)
    supabase
      .from("sales_orders")
      .select("grand_total, total_amount, order_date, status")
      .in("status", ["delivered", "paid"])
      .gte("order_date", bounds.month)
      .lte("order_date", bounds.end),
    supabase.from("nutrient_logs").select("mixed_at, ec_actual, ph_actual, volume_liters").order("mixed_at", { ascending: false }).limit(20),
    // Expenses (new table — may not yet be migrated)
    supabase.from("expenses").select("expense_date, amount, category").gte("expense_date", bounds.month.slice(0, 10)),
    // Inventory summary
    supabase.from("inventory_items").select("id, name, category, unit, current_stock, min_stock").eq("is_active", true),
    // Stock out transactions
    supabase.from("inventory_transactions").select("quantity, total_cost, recorded_at, item_id").eq("txn_type", "out").gte("recorded_at", bounds.month),
    // Upcoming harvests (for calendar markers + upcoming feed)
    supabase
      .from("planting_cycles")
      .select("id, expected_harvest_at, planted_at, status, holes(canonical_id), crop_catalog(name_id)")
      .or("status.eq.planted,status.eq.growing,status.eq.ready_harvest"),
    // Recent activities (last 10 across domains)
    supabase
      .from("planting_cycles")
      .select("id, planted_at, harvested_at, status, holes(canonical_id), crop_catalog(name_id)")
      .order("planted_at", { ascending: false })
      .limit(10),
    // Visits — ambil rentang 30 hari ke depan dan 7 hari ke belakang untuk strip kalender
    supabase
      .from("visits")
      .select("id, visit_date, start_time, end_time, organization, purpose, group_size, visit_type, status")
      .neq("status", "cancelled")
      .gte("visit_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .lte("visit_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("visit_date", { ascending: true }),
    // Research — ambil milestones dari proyek yang masih aktif
    supabase
      .from("research_projects")
      .select("id, code, title, researcher_name, proposed_start, proposed_end, actual_start, actual_end, status")
      .neq("status", "cancelled"),
  ]);

  const holes = holesResult.data ?? [];
  const envLogs = envResult.data ?? [];
  const activeBatches = batchesResult.data ?? [];
  const salesOrders = salesResult.data ?? [];
  const nutrientLogs = nutrientResult.data ?? [];
  const expenses = (expensesResult.data ?? []) as Array<{ expense_date: string; amount: number; category: string }>;
  const inventory = (inventoryResult.data ?? []) as Array<{
    id: number; name: string; category: string; unit: string; current_stock: number; min_stock: number | null;
  }>;
  const stockOut = (stockOutResult.data ?? []) as Array<{ quantity: number; total_cost: number; recorded_at: string; item_id: number }>;
  const upcomingHarvest = (upcomingHarvestResult.data ?? []) as Array<{
    id: number;
    expected_harvest_at: string | null;
    planted_at: string;
    status: string;
    holes: { canonical_id: string } | null;
    crop_catalog: { name_id: string } | null;
  }>;
  const recentCycles = recentActivitiesResult.data ?? [];
  const visits = (visitsResult.data ?? []) as Array<{
    id: number;
    visit_date: string;
    start_time: string | null;
    end_time: string | null;
    organization: string;
    purpose: string;
    group_size: number;
    visit_type: string;
    status: string;
  }>;
  const researches = (researchResult.data ?? []) as Array<{
    id: number;
    code: string;
    title: string;
    researcher_name: string;
    proposed_start: string | null;
    proposed_end: string | null;
    actual_start: string | null;
    actual_end: string | null;
    status: string;
  }>;

  // === Status counts ===
  const statusCounts: Record<HoleStatus, number> = {
    empty: 0, planted: 0, growing: 0, ready_harvest: 0, harvested: 0, maintenance: 0,
  };
  holes.forEach((h) => {
    const s = h.status as HoleStatus;
    if (s in statusCounts) statusCounts[s]++;
  });
  const totalActive = statusCounts.planted + statusCounts.growing + statusCounts.ready_harvest;
  const totalHoles = holes.length || 1;

  // === Pemasukan by period ===
  const revenueByPeriod: PeriodData = { today: { value: 0 }, week: { value: 0 }, month: { value: 0 } };
  const ordersCount = { today: 0, week: 0, month: 0 };
  for (const o of salesOrders) {
    const d = new Date(o.order_date).getTime();
    const amt = o.grand_total ?? o.total_amount ?? 0;
    if (d >= new Date(bounds.month).getTime()) { revenueByPeriod.month.value += amt; ordersCount.month++; }
    if (d >= new Date(bounds.week).getTime())  { revenueByPeriod.week.value  += amt; ordersCount.week++; }
    if (d >= new Date(bounds.today).getTime()) { revenueByPeriod.today.value += amt; ordersCount.today++; }
  }
  revenueByPeriod.today.meta = `${ordersCount.today} ${t("dashboard.orders")}`;
  revenueByPeriod.week.meta  = `${ordersCount.week} ${t("dashboard.orders")}`;
  revenueByPeriod.month.meta = `${ordersCount.month} ${t("dashboard.orders")}`;

  // === Pengeluaran by period ===
  const expenseByPeriod: PeriodData = { today: { value: 0 }, week: { value: 0 }, month: { value: 0 } };
  const expCount = { today: 0, week: 0, month: 0 };
  const todayIso = bounds.today.slice(0, 10);
  const weekIso  = bounds.week.slice(0, 10);
  for (const e of expenses) {
    const amt = Number(e.amount) || 0;
    expenseByPeriod.month.value += amt; expCount.month++;
    if (e.expense_date >= weekIso)  { expenseByPeriod.week.value  += amt; expCount.week++; }
    if (e.expense_date >= todayIso) { expenseByPeriod.today.value += amt; expCount.today++; }
  }
  expenseByPeriod.today.meta = `${expCount.today} ${t("dashboard.transactions")}`;
  expenseByPeriod.week.meta  = `${expCount.week} ${t("dashboard.transactions")}`;
  expenseByPeriod.month.meta = `${expCount.month} ${t("dashboard.transactions")}`;

  // === Stok keluar (jumlah transaksi out by period) ===
  const stockOutPeriod: PeriodData = { today: { value: 0 }, week: { value: 0 }, month: { value: 0 } };
  const stockOutCount = { today: 0, week: 0, month: 0 };
  for (const s of stockOut) {
    const t = new Date(s.recorded_at).getTime();
    stockOutPeriod.month.value += Number(s.quantity) || 0; stockOutCount.month++;
    if (t >= new Date(bounds.week).getTime())  { stockOutPeriod.week.value  += Number(s.quantity) || 0; stockOutCount.week++; }
    if (t >= new Date(bounds.today).getTime()) { stockOutPeriod.today.value += Number(s.quantity) || 0; stockOutCount.today++; }
  }
  stockOutPeriod.today.meta = `${stockOutCount.today} ${t("dashboard.transactions")}`;
  stockOutPeriod.week.meta  = `${stockOutCount.week} ${t("dashboard.transactions")}`;
  stockOutPeriod.month.meta = `${stockOutCount.month} ${t("dashboard.transactions")}`;

  // === Stok tersedia: agregasi item count + low stock alerts ===
  const totalItems = inventory.length;
  const lowStockItems = inventory.filter((i) => i.min_stock != null && Number(i.current_stock) < Number(i.min_stock));
  const byCategory = inventory.reduce<Record<string, number>>((acc, it) => {
    acc[it.category] = (acc[it.category] ?? 0) + 1;
    return acc;
  }, {});
  const categoryLabels: Record<string, string> = {
    seed:        translateInventoryCategory("seed", lang),
    nutrient:    translateInventoryCategory("nutrient", lang),
    media:       translateInventoryCategory("media", lang),
    ph_solution: translateInventoryCategory("ph_solution", lang),
    packaging:   translateInventoryCategory("packaging", lang),
    equipment:   translateInventoryCategory("equipment", lang),
    product:     translateInventoryCategory("product", lang),
    other:       translateInventoryCategory("other", lang),
  };

  // === Calendar markers ===
  const markers: CalendarMarker[] = [];
  for (const c of upcomingHarvest) {
    if (c.expected_harvest_at) {
      markers.push({ date: c.expected_harvest_at.slice(0, 10), type: "harvest" });
    }
  }
  for (const c of recentCycles.slice(0, 20)) {
    if (c.planted_at) markers.push({ date: c.planted_at.slice(0, 10), type: "plant" });
  }
  for (const o of salesOrders) {
    markers.push({ date: o.order_date.slice(0, 10), type: "sale" });
  }
  for (const v of visits) {
    markers.push({ date: v.visit_date.slice(0, 10), type: "visit" });
  }
  for (const r of researches) {
    const startDay = r.actual_start ?? r.proposed_start;
    const endDay = r.actual_end ?? r.proposed_end;
    if (startDay) markers.push({ date: startDay.slice(0, 10), type: "research" });
    if (endDay) markers.push({ date: endDay.slice(0, 10), type: "research" });
  }

  // === Upcoming events list (harvests in future, sorted by soonest) ===
  const nowMs = now.getTime();
  const upcomingEvents: UpcomingEvent[] = [];
  for (const c of upcomingHarvest) {
    if (!c.expected_harvest_at) continue;
    const t = new Date(c.expected_harvest_at).getTime();
    if (t < nowMs - 24 * 60 * 60 * 1000) continue; // skip yang sudah lewat > 1 hari
    const diffDays = Math.round((t - nowMs) / (1000 * 60 * 60 * 24));
    const meta =
      diffDays < 0 ? `${Math.abs(diffDays)} hari terlambat`
      : diffDays === 0 ? "Hari ini"
      : diffDays === 1 ? "Besok"
      : `${diffDays} hari lagi`;
    upcomingEvents.push({
      id: `harvest-${c.id}`,
      type: "harvest",
      title: `Panen ${c.crop_catalog?.name_id ?? "-"}`,
      description: c.holes?.canonical_id ? `Lubang ${c.holes.canonical_id}` : undefined,
      date: c.expected_harvest_at,
      meta,
      href: `/panen`,
    });
  }

  // Visits -> upcoming events
  for (const v of visits) {
    upcomingEvents.push({
      id: `visit-${v.id}`,
      type: "visit",
      title: v.organization,
      description: `${v.purpose} · ${v.group_size} orang`,
      date: v.visit_date,
      start_time: v.start_time,
      end_time: v.end_time,
      href: `/kunjungan/${v.id}`,
    });
  }

  // Research milestones -> upcoming events (mulai + deadline)
  for (const r of researches) {
    const startDay = r.actual_start ?? r.proposed_start;
    const endDay = r.actual_end ?? r.proposed_end;
    if (startDay) {
      upcomingEvents.push({
        id: `research-start-${r.id}`,
        type: "research",
        title: `Mulai: ${r.title}`,
        description: `${r.code} · ${r.researcher_name}`,
        date: startDay,
        start_time: "08:00",
        end_time: "09:00",
        href: `/riset/${r.id}`,
      });
    }
    if (endDay) {
      upcomingEvents.push({
        id: `research-end-${r.id}`,
        type: "research",
        title: `Deadline: ${r.title}`,
        description: `${r.code} · ${r.researcher_name}`,
        date: endDay,
        start_time: "16:00",
        end_time: "17:00",
        href: `/riset/${r.id}`,
      });
    }
  }

  upcomingEvents.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) return da - db;
    return (a.start_time ?? "").localeCompare(b.start_time ?? "");
  });

  // === Recent activities feed ===
  type Activity = { time: string; iso: string; label: string; type: "plant" | "harvest" | "sale" | "env" };
  const activities: Activity[] = [];
  for (const c of recentCycles) {
    const hole = c.holes as unknown as { canonical_id: string } | null;
    const crop = c.crop_catalog as unknown as { name_id: string } | null;
    if (c.harvested_at) {
      activities.push({
        iso: c.harvested_at,
        time: new Date(c.harvested_at).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        label: `Panen ${crop?.name_id ?? ""} di ${hole?.canonical_id ?? ""}`,
        type: "harvest",
      });
    } else if (c.planted_at) {
      activities.push({
        iso: c.planted_at,
        time: new Date(c.planted_at).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        label: `Tanam ${crop?.name_id ?? ""} di ${hole?.canonical_id ?? ""}`,
        type: "plant",
      });
    }
  }
  for (const l of envLogs.slice(0, 5)) {
    activities.push({
      iso: l.recorded_at,
      time: new Date(l.recorded_at).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      label: `Log lingkungan — ${l.temperature_c ?? "-"}°C / RH ${l.humidity_pct ?? "-"}%`,
      type: "env",
    });
  }
  activities.sort((a, b) => (a.iso < b.iso ? 1 : -1));
  const topActivities = activities.slice(0, 10);

  // Group activities by day
  const todayDate = now.toLocaleDateString("id-ID");
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toLocaleDateString("id-ID");
  const groupLabel = (iso: string) => {
    const d = new Date(iso).toLocaleDateString("id-ID");
    if (d === todayDate) return "Hari ini";
    if (d === yesterdayDate) return "Kemarin";
    return d;
  };

  // Latest environment reading
  const latestEnv = envLogs.length > 0 ? envLogs[0] : null;
  // Latest nutrient reading
  const latestNutrient = nutrientLogs.length > 0 ? nutrientLogs[0] : null;

  const envChartData = envLogs.slice().reverse().map((l) => ({
    time: new Date(l.recorded_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    suhu: l.temperature_c, rh: l.humidity_pct, co2: l.co2_ppm, vpd: l.vpd_kpa, ppfd: l.ppfd_umol,
  }));

  const nutrientChartData = nutrientLogs.slice().reverse().map((l) => ({
    time: new Date(l.mixed_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    ec: l.ec_actual, ph: l.ph_actual, volume: l.volume_liters,
  }));

  const nowFormatted = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          <span className="inline-flex items-center gap-1.5 text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
            </span>
            {t("dashboard.live")}
          </span>
          <span className="opacity-50">•</span>
          <span>{t("dashboard.last_updated")}</span>
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {t("dashboard.subtitle")} · {nowFormatted}
        </p>
      </div>

      {/* === Row 1: Quick Stats (4 cards) === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
          <span className="text-[11px] text-primary uppercase tracking-wide">{t("dashboard.active_holes")}</span>
          <p className="text-2xl font-bold text-primary mt-1">{totalActive}</p>
          <p className="text-[10px] text-muted-foreground">{t("dashboard.holes_active")}</p>
        </div>
        <div className="rounded-lg border border-[oklch(0.65_0.18_75/0.25)] bg-[oklch(0.65_0.18_75/0.08)] dark:border-[oklch(0.75_0.17_80/0.2)] dark:bg-[oklch(0.75_0.17_80/0.06)] p-4">
          <span className="text-[11px] text-[oklch(0.50_0.16_70)] dark:text-[oklch(0.80_0.14_80)] uppercase tracking-wide">{t("dashboard.ready_harvest")}</span>
          <p className="text-2xl font-bold text-[oklch(0.50_0.16_70)] dark:text-[oklch(0.80_0.14_80)] mt-1">{statusCounts.ready_harvest}</p>
          <p className="text-[10px] text-muted-foreground">{t("dashboard.ready_holes_desc")}</p>
        </div>
        <div className="rounded-lg border border-[oklch(0.55_0.13_180/0.25)] bg-[oklch(0.55_0.13_180/0.08)] dark:border-[oklch(0.72_0.12_180/0.2)] dark:bg-[oklch(0.72_0.12_180/0.06)] p-4">
          <span className="text-[11px] text-[oklch(0.45_0.12_180)] dark:text-[oklch(0.72_0.12_180)] uppercase tracking-wide">{t("dashboard.total_harvested")}</span>
          <p className="text-2xl font-bold text-[oklch(0.45_0.12_180)] dark:text-[oklch(0.72_0.12_180)] mt-1">{statusCounts.harvested}</p>
          <p className="text-[10px] text-muted-foreground">{t("dashboard.harvested_holes_desc")}</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("dashboard.active_batches")}</span>
          <p className="text-2xl font-bold text-foreground mt-1">{activeBatches.length}</p>
          <p className="text-[10px] text-muted-foreground">{t("dashboard.active_batches_desc")}</p>
        </div>
      </div>

      {/* === Row 2: Distribusi Status Lubang (full width, thin bar) === */}
      <div className="rounded-lg border border-border/40 bg-card">
        <div className="px-4 py-3 border-b border-border/30">
          <h3 className="text-[13px] font-semibold text-foreground">{t("dashboard.status_dist")}</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">{totalHoles} {t("unit.holes")}</p>
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
                  style={{ width: `${pct}%`, backgroundColor: STATUS_HEX[key], minWidth: count > 0 ? "4px" : "0" }}
                  className="h-full transition-all"
                  title={`${t(HOLE_STATUS[key].labelKey)}: ${count}`}
                />
              );
            })}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-1.5">
            {(Object.keys(HOLE_STATUS) as HoleStatus[]).map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm inline-block shrink-0" style={{ backgroundColor: STATUS_HEX[key] }} />
                <span className="text-[11px] text-muted-foreground flex-1 truncate">{t(HOLE_STATUS[key].labelKey)}</span>
                <span className="text-[12px] font-medium text-foreground">{statusCounts[key]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* === Row 3: Env chart + Nutrient chart (50/50) === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border/40 bg-card">
          <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-[13px] font-semibold text-foreground">{t("dashboard.env_overview")}</h3>
            {latestEnv && (
              <div className="flex flex-wrap gap-1.5">
                {latestEnv.temperature_c !== null && (
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#dc2626]/10 text-[#b91c1c] dark:bg-[#ef4444]/10 dark:text-[#ef4444]">{t("env.temperature")} {latestEnv.temperature_c}°C</span>
                )}
                {latestEnv.humidity_pct !== null && (
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#3b5bdb]/10 text-[#2749b0] dark:bg-[#638cff]/10 dark:text-[#638cff]">RH {latestEnv.humidity_pct}%</span>
                )}
                {latestEnv.vpd_kpa !== null && latestEnv.vpd_kpa !== undefined && (
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#16a34a]/10 text-[#15803d] dark:bg-[#4ade80]/10 dark:text-[#4ade80]">VPD {latestEnv.vpd_kpa} kPa</span>
                )}
                {latestEnv.co2_ppm !== null && (
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#7c3aed]/10 text-[#6d28d9] dark:bg-[#a78bfa]/10 dark:text-[#a78bfa]">CO2 {latestEnv.co2_ppm}</span>
                )}
                {latestEnv.ppfd_umol !== null && latestEnv.ppfd_umol !== undefined && (
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#0891b2]/10 text-[#0e7490] dark:bg-[#22d3ee]/10 dark:text-[#22d3ee]">PPFD {latestEnv.ppfd_umol}</span>
                )}
              </div>
            )}
          </div>
          <div className="p-4">
            {envChartData.length >= 2 ? (
              <EnvironmentChart data={envChartData} />
            ) : (
              <p className="text-[13px] text-muted-foreground text-center py-8">{t("dashboard.not_enough_env")}</p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border/40 bg-card">
          <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-[13px] font-semibold text-foreground">{t("dashboard.nutrient_overview")}</h3>
            {latestNutrient && (
              <div className="flex flex-wrap gap-1.5">
                {latestNutrient.ec_actual !== null && latestNutrient.ec_actual !== undefined && (
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#d97706]/10 text-[#b45309] dark:bg-[#f59e0b]/10 dark:text-[#f59e0b]">EC {latestNutrient.ec_actual}</span>
                )}
                {latestNutrient.ph_actual !== null && latestNutrient.ph_actual !== undefined && (
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#16a34a]/10 text-[#15803d] dark:bg-[#4ade80]/10 dark:text-[#4ade80]">pH {latestNutrient.ph_actual}</span>
                )}
                {latestNutrient.volume_liters !== null && latestNutrient.volume_liters !== undefined && (
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-[#3b5bdb]/10 text-[#2749b0] dark:bg-[#638cff]/10 dark:text-[#638cff]">{t("nut.volume")} {latestNutrient.volume_liters} L</span>
                )}
              </div>
            )}
          </div>
          <div className="p-4">
            {nutrientChartData.length >= 2 ? (
              <NutrientChart data={nutrientChartData} />
            ) : (
              <p className="text-[13px] text-muted-foreground text-center py-8">{t("dashboard.not_enough_nutrient")}</p>
            )}
          </div>
        </div>
      </div>

      {/* === Row 4: Batch Aktif + Kalender === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border/40 bg-card">
          <div className="px-4 py-3 border-b border-border/30">
            <h3 className="text-[13px] font-semibold text-foreground">{t("dashboard.active_batches")}</h3>
          </div>
          <div className="p-4">
            {activeBatches.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{t("dashboard.no_active_batches")}</p>
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
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] font-medium text-foreground truncate">{batch.batch_code}</span>
                          <span className="text-[12px] text-muted-foreground truncate">{translateCommodity(crop?.name_id ?? "", lang)}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] rounded-full px-2 py-0.5 bg-secondary text-muted-foreground">{cycleCount} {t("unit.holes")}</span>
                        </div>
                      </div>
                      {growDays && growDays > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${progressPct}%`, backgroundColor: progressPct >= 90 ? "#f59e0b" : "#4ade80" }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{daysElapsed}/{growDays}h</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DashboardMiniCalendar markers={markers} upcoming={upcomingEvents} />
      </div>

      {/* === Row 5: Financial + Inventory summary (left stack) + Recent activities (right) === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT STACK — 4 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-min">
          <DashboardPeriodCard
            title={t("dashboard.revenue")}
            icon={<Wallet className="h-4 w-4" />}
            data={revenueByPeriod}
            accent="emerald"
            prefix="Rp "
            footer={
              <Link href="/sales" className="text-[11px] text-primary hover:underline mt-2 inline-block">
                {t("nav.sales_log")} →
              </Link>
            }
          />
          <DashboardPeriodCard
            title={t("dashboard.expense")}
            icon={<Receipt className="h-4 w-4" />}
            data={expenseByPeriod}
            accent="rose"
            prefix="Rp "
            footer={
              <Link href="/pengeluaran" className="text-[11px] text-primary hover:underline mt-2 inline-block">
                {t("nav.expenses")} →
              </Link>
            }
          />
          {/* Stok Tersedia */}
          <div className="rounded-lg border border-border/40 bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("dashboard.stock_available")}</span>
            </div>
            <p className="text-xl font-semibold text-foreground">
              {totalItems} <span className="text-[13px] text-muted-foreground ml-1">{t("unit.items")}</span>
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(byCategory).slice(0, 4).map(([k, v]) => (
                <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {categoryLabels[k] ?? k}: {v}
                </span>
              ))}
            </div>
            {lowStockItems.length > 0 && (
              <p className="text-[11px] text-amber-400 mt-2">
                {lowStockItems.length} {t("unit.items")} {"<"} {t("inv.min_stock").toLowerCase()}
              </p>
            )}
            <Link href="/inventory" className="text-[11px] text-primary hover:underline mt-2 inline-block">
              {t("nav.inventory")} →
            </Link>
          </div>
          {/* Stok Keluar */}
          <DashboardPeriodCard
            title={t("dashboard.stock_out")}
            icon={<PackageMinus className="h-4 w-4" />}
            data={stockOutPeriod}
            accent="amber"
            format="decimal"
            suffix="unit"
            footer={
              <Link href="/inventory/transaksi" className="text-[11px] text-primary hover:underline mt-2 inline-block">
                {t("inv.transactions")} →
              </Link>
            }
          />
        </div>

        {/* RIGHT — Recent Activities */}
        <div className="rounded-lg border border-border/40 bg-card">
          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[13px] font-semibold text-foreground">{t("dashboard.recent_activities")}</h3>
          </div>
          <div className="p-4">
            {topActivities.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{t("dashboard.no_activities")}</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(
                  topActivities.reduce<Record<string, typeof topActivities>>((acc, a) => {
                    const g = groupLabel(a.iso);
                    (acc[g] ??= []).push(a);
                    return acc;
                  }, {})
                ).map(([group, items]) => (
                  <div key={group}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{group}</p>
                    <div className="space-y-2">
                      {items.map((a, i) => {
                        const dotColor =
                          a.type === "harvest" ? "bg-amber-400"
                          : a.type === "plant" ? "bg-emerald-400"
                          : a.type === "sale" ? "bg-primary"
                          : "bg-muted-foreground";
                        return (
                          <div key={i} className="flex items-start gap-2.5">
                            <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-muted-foreground">{a.time}</p>
                              <p className="text-[12px] text-foreground truncate">{a.label}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/30 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>
          Agrosphere ERP · <span className="font-semibold">v2.5</span> · {now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
        <Link href="/" className="hover:text-foreground transition-colors">
          ← Agrosphere
        </Link>
      </div>
    </div>
  );
}
