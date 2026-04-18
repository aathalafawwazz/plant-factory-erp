"use client";

import { useEffect, useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowUpDown,
  List,
  LayoutGrid,
  ShoppingCart,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Status maps                                                        */
/* ------------------------------------------------------------------ */

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Menunggu", color: "bg-amber-500/20 text-amber-400" },
  confirmed: { label: "Dikonfirmasi", color: "bg-sky-500/20 text-sky-400" },
  delivered: { label: "Dikirim", color: "bg-emerald-500/20 text-emerald-400" },
  paid: { label: "Lunas", color: "bg-green-500/20 text-green-400" },
  cancelled: { label: "Dibatalkan", color: "bg-red-500/20 text-red-400" },
};

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  unpaid: { label: "Belum Bayar", color: "bg-red-500/20 text-red-400" },
  partial: { label: "Sebagian", color: "bg-amber-500/20 text-amber-400" },
  paid: { label: "Lunas", color: "bg-green-500/20 text-green-400" },
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Customer {
  id: number;
  name: string;
}

interface Crop {
  id: number;
  name_id: string;
}

interface OrderItem {
  id?: number;
  crop_catalog_id: number;
  crop_catalog?: { name_id: string } | null;
  quantity_kg: number;
  price_per_kg: number;
  grade: string;
  subtotal: number;
}

interface SalesOrder {
  id: number;
  order_number: string;
  created_at: string;
  customer_id: number;
  customers?: { name: string } | null;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  notes: string | null;
  sales_order_items: OrderItem[];
}

type SortKey = "date_desc" | "date_asc" | "revenue_desc";
type ViewMode = "list" | "grid";

const SORT_LABELS: Record<SortKey, string> = {
  date_desc: "Terbaru",
  date_asc: "Terlama",
  revenue_desc: "Revenue Tertinggi",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmtCurrency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function SalesLogPage() {
  const supabase = createClient();

  /* ---------- data state ---------- */
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------- UI state ---------- */
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [view, setView] = useState<ViewMode>("list");
  const [cropFilter, setCropFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");

  /* ---------- detail dialog ---------- */
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Load data                                                       */
  /* ---------------------------------------------------------------- */

  async function loadData() {
    setLoading(true);
    const [ordersRes, customersRes, cropsRes] = await Promise.all([
      supabase
        .from("sales_orders")
        .select("*, customers(name), sales_order_items(*, crop_catalog(name_id))")
        .in("status", ["delivered", "paid"])
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("*").order("name"),
      supabase.from("crop_catalog").select("id, name_id").order("name_id"),
    ]);
    setOrders((ordersRes.data as unknown as SalesOrder[]) ?? []);
    setCustomers((customersRes.data as Customer[]) ?? []);
    setCrops((cropsRes.data as Crop[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Filtered + sorted                                               */
  /* ---------------------------------------------------------------- */

  const filtered = useMemo(() => {
    let list = [...orders];

    if (cropFilter !== "all") {
      list = list.filter((o) =>
        o.sales_order_items.some((i) => String(i.crop_catalog_id) === cropFilter)
      );
    }
    if (customerFilter !== "all") {
      list = list.filter((o) => String(o.customer_id) === customerFilter);
    }

    switch (sort) {
      case "date_asc":
        list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "revenue_desc":
        list.sort((a, b) => b.total_amount - a.total_amount);
        break;
      default:
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [orders, sort, cropFilter, customerFilter]);

  /* ---------------------------------------------------------------- */
  /*  Summary stats                                                   */
  /* ---------------------------------------------------------------- */

  const totalSales = filtered.length;
  const totalRevenue = filtered.reduce((s, o) => s + o.total_amount, 0);
  const avgOrder = totalSales > 0 ? totalRevenue / totalSales : 0;

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">Log Penjualan</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Penjualan</p>
          <p className="text-2xl font-bold mt-1">
            {totalSales}
            <span className="text-sm font-normal text-muted-foreground ml-1">order</span>
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold mt-1">{fmtCurrency.format(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <p className="text-xs text-muted-foreground">Rata-rata Order</p>
          <p className="text-2xl font-bold mt-1">{fmtCurrency.format(avgOrder)}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={sort} onValueChange={(v) => v !== null && setSort(v as SortKey)}>
          <SelectTrigger className="w-[160px] h-9 bg-secondary border-border/50 text-[13px]">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cropFilter} onValueChange={(v) => v !== null && setCropFilter(v)}>
          <SelectTrigger className="w-[160px] h-9 bg-secondary border-border/50 text-[13px]">
            <SelectValue>
              {cropFilter === "all"
                ? "Semua Komoditas"
                : crops.find((c) => String(c.id) === cropFilter)?.name_id ?? cropFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Komoditas</SelectItem>
            {crops.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={customerFilter} onValueChange={(v) => v !== null && setCustomerFilter(v)}>
          <SelectTrigger className="w-[170px] h-9 bg-secondary border-border/50 text-[13px]">
            <SelectValue>
              {customerFilter === "all"
                ? "Semua Pelanggan"
                : customers.find((c) => String(c.id) === customerFilter)?.name ?? customerFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Pelanggan</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setView("list")}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            Memuat data penjualan...
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="py-16 text-center">
            <ShoppingCart className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Belum ada transaksi penjualan.</p>
          </CardContent>
        </Card>
      )}

      {/* Table view */}
      {!loading && filtered.length > 0 && view === "list" && (
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">Tanggal</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Pelanggan</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Komoditas</TableHead>
                <TableHead className="text-[12px] text-muted-foreground text-right">Total</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-secondary/50"
                  onClick={() => {
                    setDetailOrder(order);
                    setDetailOpen(true);
                  }}
                >
                  <TableCell className="text-[13px]">{fmtDate(order.created_at)}</TableCell>
                  <TableCell className="text-[13px]">{order.customers?.name ?? "-"}</TableCell>
                  <TableCell className="text-[13px]">
                    {order.sales_order_items
                      .map((i) => i.crop_catalog?.name_id ?? "?")
                      .join(", ")}
                  </TableCell>
                  <TableCell className="text-[13px] text-right font-medium">
                    {fmtCurrency.format(order.total_amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[11px] border-0 ${ORDER_STATUS[order.status]?.color ?? ""}`}>
                      {ORDER_STATUS[order.status]?.label ?? order.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tile view */}
      {!loading && filtered.length > 0 && view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((order) => (
            <Card
              key={order.id}
              className="rounded-xl border border-border/40 bg-card cursor-pointer hover:border-border/80 transition-colors"
              onClick={() => {
                setDetailOrder(order);
                setDetailOpen(true);
              }}
            >
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-[12px] text-muted-foreground">{fmtDate(order.created_at)}</p>
                  <p className="text-[14px] font-medium text-foreground">
                    {order.customers?.name ?? "-"}
                  </p>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {order.sales_order_items
                    .map((i) => `${i.crop_catalog?.name_id ?? "?"} (${i.quantity_kg} kg)`)
                    .join(", ")}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {fmtCurrency.format(order.total_amount)}
                </p>
                <Badge variant="outline" className={`text-[11px] border-0 ${ORDER_STATUS[order.status]?.color ?? ""}`}>
                  {ORDER_STATUS[order.status]?.label ?? order.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ============================================================ */}
      {/*  Detail Dialog (read-only)                                    */}
      {/* ============================================================ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border/40">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Detail Order {detailOrder?.order_number}
            </DialogTitle>
          </DialogHeader>

          {detailOrder && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className="text-muted-foreground">Tanggal</p>
                  <p className="font-medium text-foreground">{fmtDate(detailOrder.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pelanggan</p>
                  <p className="font-medium text-foreground">{detailOrder.customers?.name ?? "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Metode Pembayaran</p>
                  <p className="font-medium text-foreground">{detailOrder.payment_method}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={`text-[11px] border-0 ${ORDER_STATUS[detailOrder.status]?.color ?? ""}`}>
                    {ORDER_STATUS[detailOrder.status]?.label ?? detailOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Status Bayar</p>
                  <Badge variant="outline" className={`text-[11px] border-0 ${PAYMENT_STATUS[detailOrder.payment_status]?.color ?? ""}`}>
                    {PAYMENT_STATUS[detailOrder.payment_status]?.label ?? detailOrder.payment_status}
                  </Badge>
                </div>
              </div>

              {detailOrder.notes && (
                <div className="text-[13px]">
                  <p className="text-muted-foreground">Catatan</p>
                  <p className="text-foreground">{detailOrder.notes}</p>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-[13px] font-medium text-foreground mb-2">Item</p>
                <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[12px] text-muted-foreground">Komoditas</TableHead>
                        <TableHead className="text-[12px] text-muted-foreground">Grade</TableHead>
                        <TableHead className="text-[12px] text-muted-foreground text-right">Qty (kg)</TableHead>
                        <TableHead className="text-[12px] text-muted-foreground text-right">Harga/kg</TableHead>
                        <TableHead className="text-[12px] text-muted-foreground text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailOrder.sales_order_items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-[13px]">{item.crop_catalog?.name_id ?? "-"}</TableCell>
                          <TableCell className="text-[13px]">{item.grade}</TableCell>
                          <TableCell className="text-[13px] text-right">{item.quantity_kg}</TableCell>
                          <TableCell className="text-[13px] text-right">{fmtCurrency.format(item.price_per_kg)}</TableCell>
                          <TableCell className="text-[13px] text-right font-medium">{fmtCurrency.format(item.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="text-right mt-2">
                  <span className="text-[13px] text-muted-foreground">Total: </span>
                  <span className="text-lg font-bold text-foreground">{fmtCurrency.format(detailOrder.total_amount)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
