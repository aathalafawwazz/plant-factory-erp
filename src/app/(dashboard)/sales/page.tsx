"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useChartTheme } from "@/lib/use-chart-theme";
import { useLang } from "@/lib/i18n";
import { translateCommodity, formatDateLocale } from "@/lib/translate-helpers";

type OrderRow = {
  id: number;
  customer_id: number;
  order_date: string;
  status: string;
  total_amount: number;
  payment_status: string;
  due_date: string | null;
  created_at: string;
  customers: { name: string } | null;
};

type OrderItemRow = {
  id: number;
  order_id: number;
  crop_catalog_id: number;
  quantity_kg: number;
  unit_price: number;
  subtotal: number;
  crop_catalog: { name_id: string } | null;
  sales_orders: { status: string; order_date: string } | null;
};

type HarvestRow = {
  crop_catalog_id: number;
  crop_catalog: { name_id: string } | null;
  harvest_weight_g: number | null;
};

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Menunggu", color: "bg-amber-500/20 text-amber-400" },
  confirmed: { label: "Dikonfirmasi", color: "bg-sky-500/20 text-sky-400" },
  delivered: { label: "Dikirim", color: "bg-emerald-500/20 text-emerald-400" },
  paid: { label: "Lunas", color: "bg-green-500/20 text-green-400" },
  cancelled: { label: "Dibatalkan", color: "bg-red-500/20 text-red-400" },
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function SalesDashboardPage() {
  const supabase = createClient();
  const chartTheme = useChartTheme();
  const { t, lang } = useLang();

  const ORDER_STATUS_LABELS: Record<string, string> = {
    pending: t("sales.menunggu"),
    confirmed: t("sales.dikonfirmasi"),
    delivered: t("sales.dikirim"),
    paid: t("sales.lunas"),
    cancelled: t("sales.dibatalkan"),
  };

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [harvests, setHarvests] = useState<HarvestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    const [ordersRes, itemsRes, harvestsRes] = await Promise.all([
      supabase
        .from("sales_orders")
        .select("*, customers(name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("sales_order_items")
        .select("*, crop_catalog(name_id), sales_orders(status, order_date)"),
      supabase
        .from("planting_cycles")
        .select("crop_catalog_id, crop_catalog(name_id), harvest_weight_g")
        .eq("status", "harvested"),
    ]);
    setOrders((ordersRes.data as OrderRow[] | null) ?? []);
    setItems((itemsRes.data as OrderItemRow[] | null) ?? []);
    setHarvests((harvestsRes.data as HarvestRow[] | null) ?? []);
    setLoading(false);
  }

  // Current month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  // Orders this month
  const thisMonthOrders = orders.filter((o) => {
    const d = o.order_date?.split("T")[0] ?? "";
    return d >= monthStart && d <= monthEnd;
  });

  // Total Revenue (delivered/paid this month)
  const totalRevenue = thisMonthOrders
    .filter((o) => o.status === "delivered" || o.status === "paid")
    .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);

  // Jumlah Order this month
  const orderCount = thisMonthOrders.length;

  // Pelanggan Aktif (distinct customers this month)
  const activeCustomers = new Set(thisMonthOrders.map((o) => o.customer_id))
    .size;

  // --- Stock per Crop ---
  const stockPerCrop = useMemo(() => {
    // Total harvest per crop (kg)
    const harvestMap = new Map<number, { name: string; harvestKg: number }>();
    for (const h of harvests) {
      const cropId = h.crop_catalog_id;
      const name = h.crop_catalog?.name_id ?? "Unknown";
      const existing = harvestMap.get(cropId);
      if (existing) {
        existing.harvestKg += (h.harvest_weight_g ?? 0) / 1000;
      } else {
        harvestMap.set(cropId, { name, harvestKg: (h.harvest_weight_g ?? 0) / 1000 });
      }
    }

    // Total sold per crop (kg) - delivered/paid only
    const soldMap = new Map<number, number>();
    for (const item of items) {
      const status = item.sales_orders?.status;
      if (status !== "delivered" && status !== "paid") continue;
      const cropId = item.crop_catalog_id;
      soldMap.set(cropId, (soldMap.get(cropId) ?? 0) + (item.quantity_kg ?? 0));
    }

    // Merge
    const allCropIds = new Set([...harvestMap.keys(), ...soldMap.keys()]);
    const result: { name: string; stock: number }[] = [];
    for (const cropId of allCropIds) {
      const harvest = harvestMap.get(cropId);
      const sold = soldMap.get(cropId) ?? 0;
      const harvestKg = harvest?.harvestKg ?? 0;
      const name = harvest?.name ?? items.find((i) => i.crop_catalog_id === cropId)?.crop_catalog?.name_id ?? "Unknown";
      result.push({ name, stock: Math.max(0, harvestKg - sold) });
    }

    return result.sort((a, b) => b.stock - a.stock);
  }, [harvests, items]);

  const lowStockCrops = stockPerCrop.filter((c) => c.stock > 0 && c.stock < 1);

  function stockColor(stock: number): string {
    if (stock === 0) return "bg-zinc-500/20 text-zinc-400";
    if (stock < 1) return "bg-red-500/20 text-red-400";
    if (stock <= 5) return "bg-amber-500/20 text-amber-400";
    return "bg-emerald-500/20 text-emerald-400";
  }

  function stockDotColor(stock: number): string {
    if (stock === 0) return "bg-zinc-500";
    if (stock < 1) return "bg-red-500";
    if (stock <= 5) return "bg-amber-500";
    return "bg-emerald-500";
  }

  // --- 14-day revenue trend ---
  const trendData: { date: string; revenue: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayLabel = formatDateLocale(d, lang, { day: "2-digit", month: "short" });
    const dayRevenue = orders
      .filter((o) => {
        const od = o.order_date?.split("T")[0] ?? "";
        return od === dateStr && (o.status === "delivered" || o.status === "paid");
      })
      .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
    trendData.push({ date: dayLabel, revenue: dayRevenue });
  }

  // --- Alerts ---
  const pendingOrderCount = orders.filter((o) => o.status === "pending").length;
  const overdueInvoiceCount = orders.filter((o) => {
    const dueDate = o.due_date?.split("T")[0] ?? "";
    return dueDate < todayStr && o.payment_status !== "paid" && dueDate !== "";
  }).length;
  const lowStockCount = lowStockCrops.length;

  // Top 5 Komoditas by revenue
  const cropMap = new Map<string, { name: string; kgSold: number; revenue: number }>();
  for (const item of items) {
    const status = item.sales_orders?.status;
    if (status !== "delivered" && status !== "paid") continue;
    const cropName = item.crop_catalog?.name_id ?? "Unknown";
    const existing = cropMap.get(cropName) ?? { name: cropName, kgSold: 0, revenue: 0 };
    existing.kgSold += item.quantity_kg ?? 0;
    existing.revenue += item.subtotal ?? 0;
    cropMap.set(cropName, existing);
  }
  const topCrops = Array.from(cropMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Recent 5 orders
  const recentOrders = orders.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {t("sales.dashboard")}
        </h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {t("sales.dashboard_subtitle")}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[12px] mb-1">
            <ShoppingCart className="size-4" />
            {t("sales.total_revenue_month")}
          </div>
          <div className="text-2xl font-semibold">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <div className="text-muted-foreground text-[12px] mb-1">
            {t("sales.order_count")}
          </div>
          <div className="text-2xl font-semibold">{orderCount}</div>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <div className="text-muted-foreground text-[12px] mb-1">
            {t("sales.active_customers")}
          </div>
          <div className="text-2xl font-semibold">{activeCustomers}</div>
        </div>
      </div>

      {/* Stok per Komoditas */}
      <div className="rounded-lg border border-border/40 bg-card">
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-foreground">
            {t("sales.stock_per_crop")}
          </h3>
          {lowStockCount > 0 && (
            <Badge className="bg-red-500/20 text-red-400 border-0 text-[11px] flex items-center gap-1">
              <AlertTriangle className="size-3" />
              {t("inv.low_stock")} ({lowStockCount})
            </Badge>
          )}
        </div>
        <div className="p-4">
          {stockPerCrop.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              {t("sales.no_stock_data")}
            </p>
          ) : (
            <div className="space-y-1">
              {stockPerCrop.map((crop) => (
                <div
                  key={crop.name}
                  className="flex items-center justify-between py-2 border-b border-border/20 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${stockDotColor(crop.stock)}`} />
                    <span className="text-[13px] font-medium text-foreground">
                      {translateCommodity(crop.name, lang)}
                    </span>
                  </div>
                  <Badge className={`${stockColor(crop.stock)} border-0 text-[11px]`}>
                    {crop.stock.toFixed(1)} kg
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Peringatan */}
      {(pendingOrderCount > 0 || overdueInvoiceCount > 0 || lowStockCount > 0) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5">
          <div className="px-4 py-3 border-b border-amber-500/20">
            <h3 className="text-[13px] font-semibold text-amber-400 flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {t("sales.alerts")}
            </h3>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/30 bg-card p-3">
              <p className="text-[11px] text-muted-foreground">{t("sales.pending_orders")}</p>
              <p className="text-xl font-semibold text-amber-400">{pendingOrderCount}</p>
            </div>
            <div className="rounded-lg border border-border/30 bg-card p-3">
              <p className="text-[11px] text-muted-foreground">{t("sales.overdue_invoices")}</p>
              <p className="text-xl font-semibold text-red-400">{overdueInvoiceCount}</p>
            </div>
            <div className="rounded-lg border border-border/30 bg-card p-3">
              <p className="text-[11px] text-muted-foreground">{t("sales.low_stock_lt1")}</p>
              <p className="text-xl font-semibold text-red-400">{lowStockCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Trend Chart + Top Komoditas */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* 14-Day Revenue Trend */}
        <div className="rounded-lg border border-border/40 bg-card">
          <div className="px-4 py-3 border-b border-border/30">
            <h3 className="text-[13px] font-semibold text-foreground">
              {t("sales.revenue_14d")}
            </h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#638cff" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#638cff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={chartTheme.tooltip}
                  formatter={(v) => [formatCurrency(Number(v)), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#638cff" strokeWidth={2} fill="url(#revenueGrad)" dot={{ fill: '#638cff', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 Komoditas */}
        <div className="rounded-lg border border-border/40 bg-card">
          <div className="px-4 py-3 border-b border-border/30">
            <h3 className="text-[13px] font-semibold text-foreground">
              {t("sales.top_5_crops")}
            </h3>
          </div>
          <div className="p-4">
            {topCrops.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                {t("sales.no_sales_data")}
              </p>
            ) : (
              <div className="space-y-1">
                {topCrops.map((crop, i) => (
                  <div
                    key={crop.name}
                    className="flex items-center justify-between py-2 border-b border-border/20 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-4">
                        {i + 1}.
                      </span>
                      <span className="text-[13px] font-medium text-foreground">
                        {translateCommodity(crop.name, lang)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {crop.kgSold.toFixed(1)} kg
                      </span>
                    </div>
                    <span className="text-[12px] font-medium text-foreground">
                      {formatCurrency(crop.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Terbaru */}
      <div className="rounded-lg border border-border/40 bg-card">
        <div className="px-4 py-3 border-b border-border/30">
          <h3 className="text-[13px] font-semibold text-foreground">
            {t("sales.recent_orders")}
          </h3>
        </div>
        <div className="p-4">
          {recentOrders.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              {t("sales.no_orders")}
            </p>
          ) : (
            <div className="space-y-1">
              {recentOrders.map((order) => {
                const statusInfo = ORDER_STATUS[order.status] ?? {
                  label: order.status,
                  color: "bg-zinc-500/20 text-zinc-400",
                };
                const statusLabel = ORDER_STATUS_LABELS[order.status] ?? statusInfo.label;
                const customerName =
                  (order.customers as { name: string } | null)?.name ??
                  t("sales.customer_default");
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2 border-b border-border/20 last:border-0 cursor-pointer hover:bg-muted/30 rounded-md px-2 -mx-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-muted-foreground w-20">
                        {formatDateLocale(order.order_date, lang, {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      <span className="text-[13px] font-medium text-foreground">
                        {customerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] font-medium text-foreground">
                        {formatCurrency(order.total_amount)}
                      </span>
                      <Badge
                        className={`${statusInfo.color} border-0 text-[11px]`}
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
