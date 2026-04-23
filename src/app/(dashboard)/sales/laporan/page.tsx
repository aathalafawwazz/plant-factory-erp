"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Download, BarChart3, Users, TrendingUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useChartTheme } from "@/lib/use-chart-theme";
import { useLang } from "@/lib/i18n";
import { translateCommodity } from "@/lib/translate-helpers";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OrderItem {
  crop_catalog_id: number;
  crop_catalog?: { name_id: string } | null;
  quantity_kg: number;
  price_per_kg: number;
  subtotal: number;
}

interface SalesOrder {
  id: number;
  created_at: string;
  order_date: string;
  customer_id: number;
  customers?: { name: string; type?: string; created_at?: string } | null;
  total_amount: number;
  status: string;
  sales_order_items: OrderItem[];
}

interface HarvestRow {
  crop_catalog_id: number;
  crop_catalog?: { name_id: string } | null;
  harvest_weight_g: number | null;
}

interface CustomerRow {
  id: number;
  created_at: string;
}

type PeriodKey = "week" | "month" | "quarter" | "all";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmtCurrency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getPeriodStart(period: PeriodKey): Date | null {
  const now = new Date();
  switch (period) {
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "month": {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    case "quarter": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "all":
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function SalesReportPage() {
  const supabase = createClient();
  const chartTheme = useChartTheme();
  const { t, lang } = useLang();
  const PERIOD_LABELS: Record<PeriodKey, string> = {
    week: t("sales.period_week"),
    month: t("sales.period_month"),
    quarter: t("sales.period_quarter"),
    all: t("sales.period_all"),
  };

  /* ---------- data state ---------- */
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [harvests, setHarvests] = useState<HarvestRow[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------- UI state ---------- */
  const [period, setPeriod] = useState<PeriodKey>("month");

  /* ---------------------------------------------------------------- */
  /*  Load data                                                       */
  /* ---------------------------------------------------------------- */

  const loadData = useCallback(async () => {
    setLoading(true);
    const [ordersRes, harvestsRes, customersRes] = await Promise.all([
      supabase
        .from("sales_orders")
        .select("*, customers(name, type, created_at), sales_order_items(*, crop_catalog(name_id))")
        .in("status", ["delivered", "paid"])
        .order("created_at", { ascending: false }),
      supabase
        .from("planting_cycles")
        .select("crop_catalog_id, crop_catalog(name_id), harvest_weight_g")
        .eq("status", "harvested"),
      supabase
        .from("customers")
        .select("id, created_at"),
    ]);
    setOrders((ordersRes.data as unknown as SalesOrder[]) ?? []);
    setHarvests((harvestsRes.data as unknown as HarvestRow[]) ?? []);
    setAllCustomers((customersRes.data as CustomerRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---------------------------------------------------------------- */
  /*  Filter by period                                                */
  /* ---------------------------------------------------------------- */

  const filteredOrders = useMemo(() => {
    const start = getPeriodStart(period);
    if (!start) return orders;
    return orders.filter((o) => new Date(o.created_at) >= start);
  }, [orders, period]);

  /* ---------------------------------------------------------------- */
  /*  Section 1: Revenue Summary                                      */
  /* ---------------------------------------------------------------- */

  const totalRevenue = filteredOrders.reduce((s, o) => s + o.total_amount, 0);
  const orderCount = filteredOrders.length;
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  /* ---------------------------------------------------------------- */
  /*  30-Day Revenue Trend                                            */
  /* ---------------------------------------------------------------- */

  const revenueTrend = useMemo(() => {
    const days: { date: string; label: string; revenue: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      const dayRevenue = orders
        .filter((o) => {
          const od = (o.order_date ?? o.created_at)?.split("T")[0] ?? "";
          return od === dateStr;
        })
        .reduce((sum, o) => sum + o.total_amount, 0);
      days.push({ date: dateStr, label: dayLabel, revenue: dayRevenue });
    }
    return days;
  }, [orders]);

  const trendData = revenueTrend.map((d) => ({ date: d.label, revenue: d.revenue }));

  /* ---------------------------------------------------------------- */
  /*  Retensi Pelanggan                                               */
  /* ---------------------------------------------------------------- */

  const customerRetention = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    // Customers who ordered in last 30 days
    const activeCustomerIds = new Set(
      orders
        .filter((o) => new Date(o.created_at) >= thirtyDaysAgo)
        .map((o) => o.customer_id)
    );

    // All customer IDs who have ever ordered
    const allOrderCustomerIds = new Set(orders.map((o) => o.customer_id));

    // Inactive = have ordered before but not in last 30 days
    const inactiveCount = Array.from(allOrderCustomerIds).filter(
      (id) => !activeCustomerIds.has(id)
    ).length;

    // New customers (created in last 30 days)
    const newCustomerCount = allCustomers.filter(
      (c) => c.created_at >= thirtyDaysAgoStr
    ).length;

    return {
      active: activeCustomerIds.size,
      inactive: inactiveCount,
      newCustomers: newCustomerCount,
    };
  }, [orders, allCustomers]);

  /* ---------------------------------------------------------------- */
  /*  Section 2: Revenue per Komoditas                                */
  /* ---------------------------------------------------------------- */

  const cropRevenue = useMemo(() => {
    const map = new Map<number, { name: string; qty: number; revenue: number }>();
    for (const order of filteredOrders) {
      for (const item of order.sales_order_items) {
        const existing = map.get(item.crop_catalog_id);
        if (existing) {
          existing.qty += item.quantity_kg;
          existing.revenue += item.subtotal;
        } else {
          map.set(item.crop_catalog_id, {
            name: item.crop_catalog?.name_id ?? "-",
            qty: item.quantity_kg,
            revenue: item.subtotal,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  /* ---------------------------------------------------------------- */
  /*  Section 3: Revenue per Pelanggan                                */
  /* ---------------------------------------------------------------- */

  const customerRevenue = useMemo(() => {
    const map = new Map<number, { name: string; type: string; count: number; revenue: number }>();
    for (const order of filteredOrders) {
      const existing = map.get(order.customer_id);
      if (existing) {
        existing.count += 1;
        existing.revenue += order.total_amount;
      } else {
        map.set(order.customer_id, {
          name: order.customers?.name ?? "-",
          type: order.customers?.type ?? "-",
          count: 1,
          revenue: order.total_amount,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  /* ---------------------------------------------------------------- */
  /*  Section 4: Produksi vs Penjualan (with Margin)                  */
  /* ---------------------------------------------------------------- */

  const prodVsSales = useMemo(() => {
    // Total sold per crop (kg)
    const soldMap = new Map<number, { name: string; sold: number }>();
    for (const order of filteredOrders) {
      for (const item of order.sales_order_items) {
        const existing = soldMap.get(item.crop_catalog_id);
        if (existing) {
          existing.sold += item.quantity_kg;
        } else {
          soldMap.set(item.crop_catalog_id, {
            name: item.crop_catalog?.name_id ?? "-",
            sold: item.quantity_kg,
          });
        }
      }
    }

    // Total produced per crop (kg from harvests)
    const producedMap = new Map<number, number>();
    for (const h of harvests) {
      const kg = (h.harvest_weight_g ?? 0) / 1000;
      producedMap.set(h.crop_catalog_id, (producedMap.get(h.crop_catalog_id) ?? 0) + kg);
    }

    // Merge all crop IDs
    const allCropIds = new Set([...soldMap.keys(), ...producedMap.keys()]);
    const result: { name: string; produced: number; sold: number; gap: number; margin: string }[] = [];

    for (const cropId of allCropIds) {
      const soldEntry = soldMap.get(cropId);
      const produced = producedMap.get(cropId) ?? 0;
      const sold = soldEntry?.sold ?? 0;
      const name = soldEntry?.name ?? harvests.find((h) => h.crop_catalog_id === cropId)?.crop_catalog?.name_id ?? "-";
      const gap = produced - sold;
      const margin = gap >= 0 ? `+${gap.toFixed(2)} ${t("sales.surplus")}` : `${gap.toFixed(2)} ${t("sales.deficit")}`;
      result.push({ name, produced: Number(produced.toFixed(2)), sold: Number(sold.toFixed(2)), gap: Number(gap.toFixed(2)), margin });
    }

    return result.sort((a, b) => b.produced - a.produced);
  }, [filteredOrders, harvests]);

  /* ---------------------------------------------------------------- */
  /*  CSV Export                                                      */
  /* ---------------------------------------------------------------- */

  const exportCSV = useCallback(() => {
    const rows: Record<string, unknown>[] = [];

    // Revenue per crop
    for (const c of cropRevenue) {
      rows.push({
        Komoditas: c.name,
        Qty_Terjual_kg: c.qty,
        Revenue: c.revenue,
        Persen_Total: totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(1) + "%" : "0%",
      });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(rows, `laporan-penjualan-${dateStr}.csv`);
    toast.success(t("sales.csv_exported"));
  }, [cropRevenue, totalRevenue, t]);

  /* ---------------------------------------------------------------- */
  /*  Stat card component                                             */
  /* ---------------------------------------------------------------- */

  function StatCard({ label, value }: { label: string; value: string }) {
    return (
      <div className="rounded-lg border border-border/40 bg-card p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{t("sales.report_title")}</h1>
        <Button
          variant="outline"
          className="h-9 text-[13px]"
          onClick={exportCSV}
          disabled={cropRevenue.length === 0}
        >
          <Download className="w-4 h-4 mr-1.5" />
          {t("sales.export_csv")}
        </Button>
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-3">
        <Select value={period} onValueChange={(v) => v !== null && setPeriod(v as PeriodKey)}>
          <SelectTrigger className="w-[160px] h-9 bg-secondary border-border/50 text-[13px]">
            <SelectValue>{PERIOD_LABELS[period]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("sales.loading_report")}
          </CardContent>
        </Card>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Section 1: Revenue Summary */}
          <div>
            <h2 className="text-[14px] font-semibold text-foreground mb-3">{t("sales.revenue_summary")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard label={t("sales.total_revenue")} value={fmtCurrency.format(totalRevenue)} />
              <StatCard label={t("sales.order_count")} value={String(orderCount)} />
              <StatCard label={t("sales.avg_order")} value={fmtCurrency.format(avgOrderValue)} />
            </div>
          </div>

          <Separator />

          {/* Trend Penjualan (30-day) */}
          <div>
            <h2 className="text-[14px] font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="size-4" />
              {t("sales.trend_30d")}
            </h2>
            <div className="rounded-xl border border-border/40 bg-card p-4">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    <linearGradient id="reportRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#638cff" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#638cff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={chartTheme.tooltip}
                    formatter={(v) => [fmtCurrency.format(Number(v)), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#638cff" strokeWidth={2} fill="url(#reportRevenueGrad)" dot={{ fill: '#638cff', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <Separator />

          {/* Retensi Pelanggan */}
          <div>
            <h2 className="text-[14px] font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users className="size-4" />
              {t("sales.customer_retention")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border/40 bg-card p-4">
                <p className="text-xs text-muted-foreground">{t("sales.active_customers_30d")}</p>
                <p className="text-2xl font-bold mt-1 text-emerald-400">{customerRetention.active}</p>
              </div>
              <div className="rounded-lg border border-border/40 bg-card p-4">
                <p className="text-xs text-muted-foreground">{t("sales.inactive_customers")}</p>
                <p className="text-2xl font-bold mt-1 text-amber-400">{customerRetention.inactive}</p>
              </div>
              <div className="rounded-lg border border-border/40 bg-card p-4">
                <p className="text-xs text-muted-foreground">{t("sales.new_customers_30d")}</p>
                <p className="text-2xl font-bold mt-1 text-sky-400">{customerRetention.newCustomers}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2: Revenue per Komoditas */}
          <div>
            <h2 className="text-[14px] font-semibold text-foreground mb-3">{t("sales.revenue_per_crop")}</h2>
            {cropRevenue.length > 0 ? (
              <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[12px] text-muted-foreground">{t("sales.commodity")}</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground text-right">{t("sales.col_qty_sold")}</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground text-right">{t("sales.col_revenue")}</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground text-right">{t("sales.col_pct_total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cropRevenue.map((c, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-[13px]">{translateCommodity(c.name, lang)}</TableCell>
                        <TableCell className="text-[13px] text-right">{c.qty.toFixed(2)}</TableCell>
                        <TableCell className="text-[13px] text-right font-medium">{fmtCurrency.format(c.revenue)}</TableCell>
                        <TableCell className="text-[13px] text-right">
                          {totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(1) : "0"}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Card className="rounded-xl border border-border/40 bg-card">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {t("sales.no_period_sales")}
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Section 3: Revenue per Pelanggan */}
          <div>
            <h2 className="text-[14px] font-semibold text-foreground mb-3">{t("sales.revenue_per_customer")}</h2>
            {customerRevenue.length > 0 ? (
              <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[12px] text-muted-foreground">{t("sales.col_customer")}</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground">{t("sales.col_type")}</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground text-right">{t("sales.col_order_count")}</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground text-right">{t("sales.col_total_revenue")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerRevenue.map((c, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-[13px]">{c.name}</TableCell>
                        <TableCell>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {c.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-[13px] text-right">{c.count}</TableCell>
                        <TableCell className="text-[13px] text-right font-medium">{fmtCurrency.format(c.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Card className="rounded-xl border border-border/40 bg-card">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {t("sales.no_period_customers")}
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Section 4: Produksi vs Penjualan (with Margin) */}
          <div>
            <h2 className="text-[14px] font-semibold text-foreground mb-3">{t("sales.prod_vs_sales")}</h2>
            {prodVsSales.length > 0 ? (
              <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[12px] text-muted-foreground">{t("sales.col_commodity")}</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground text-right">{t("sales.col_produced")}</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground text-right">{t("sales.col_sold")}</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground text-right">{t("sales.col_gap")}</TableHead>
                      <TableHead className="text-[12px] text-muted-foreground text-right">{t("sales.col_margin")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prodVsSales.map((c, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-[13px]">{translateCommodity(c.name, lang)}</TableCell>
                        <TableCell className="text-[13px] text-right">{c.produced.toFixed(2)}</TableCell>
                        <TableCell className="text-[13px] text-right">{c.sold.toFixed(2)}</TableCell>
                        <TableCell
                          className={`text-[13px] text-right font-medium ${
                            c.gap >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {c.gap >= 0 ? "+" : ""}
                          {c.gap.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={`text-[12px] text-right ${
                            c.gap >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {c.margin}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Card className="rounded-xl border border-border/40 bg-card">
                <CardContent className="py-8 text-center">
                  <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t("sales.no_prod_sales")}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
