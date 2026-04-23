import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerI18n } from "@/lib/i18n-server";
import { translateCommodity, formatDateTimeLocale } from "@/lib/translate-helpers";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, AlertTriangle, Wallet, Activity, Plus } from "lucide-react";
import type {
  InventoryItem,
  InventoryTransaction,
  InventoryCategory,
  InventoryTxnType,
  InventoryTxnSource,
} from "@/lib/types/database";

const CATEGORY_KEY: Record<InventoryCategory, string> = {
  seed: "inv.cat_seed",
  nutrient: "inv.cat_nutrient",
  media: "inv.cat_media",
  ph_solution: "inv.cat_ph_solution",
  packaging: "inv.cat_packaging",
  equipment: "inv.cat_equipment",
  product: "inv.cat_product",
  other: "inv.cat_other",
};

const TXN_TYPE_KEY: Record<InventoryTxnType, string> = {
  in: "inv.txn_type_in",
  out: "inv.txn_type_out",
  adjustment: "inv.txn_type_adjustment",
};

const TXN_TYPE_COLORS: Record<InventoryTxnType, string> = {
  in: "bg-emerald-500/20 text-emerald-400",
  out: "bg-rose-500/20 text-rose-400",
  adjustment: "bg-amber-500/20 text-amber-400",
};

const SOURCE_KEY: Record<InventoryTxnSource, string> = {
  purchase: "inv.source_purchase",
  harvest: "inv.source_harvest",
  sale: "inv.source_sale",
  usage: "inv.source_usage",
  waste: "inv.source_waste",
  manual: "inv.source_manual",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

type TxnWithItem = InventoryTransaction & {
  inventory_items: { name: string; unit: string; category: InventoryCategory } | null;
};

export default async function InventoryDashboardPage() {
  const supabase = await createClient();
  const { t, lang } = await getServerI18n();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [itemsResult, txnsResult] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("inventory_transactions")
      .select("*, inventory_items(name, unit, category)")
      .order("recorded_at", { ascending: false })
      .limit(10),
  ]);

  const items = (itemsResult.data ?? []) as InventoryItem[];
  const transactions = (txnsResult.data ?? []) as TxnWithItem[];

  // Stats
  const totalItems = items.length;
  const totalValue = items.reduce(
    (sum, it) => sum + Number(it.current_stock) * Number(it.unit_cost ?? 0),
    0
  );
  const lowStock = items.filter(
    (it) => it.min_stock != null && Number(it.current_stock) < Number(it.min_stock)
  );

  // Today's txn count — need a separate query for accuracy, but approximation from latest 10:
  const todayTxnsResult = await supabase
    .from("inventory_transactions")
    .select("id", { count: "exact", head: true })
    .gte("recorded_at", startOfToday);
  const todayTxnCount = todayTxnsResult.count ?? 0;

  // By category
  type CatAgg = { count: number; value: number };
  const byCategory: Record<string, CatAgg> = {};
  for (const it of items) {
    const cat = it.category;
    if (!byCategory[cat]) byCategory[cat] = { count: 0, value: 0 };
    byCategory[cat].count++;
    byCategory[cat].value += Number(it.current_stock) * Number(it.unit_cost ?? 0);
  }

  const categoryOrder: InventoryCategory[] = [
    "seed",
    "nutrient",
    "media",
    "ph_solution",
    "packaging",
    "equipment",
    "product",
    "other",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">{t("nav.inventory")}</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {t("inv.subtitle")}
        </p>
      </div>

      {/* Row 1: Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {t("inv.total_items")}
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalItems}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t("inv.active_items")}</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {t("inv.total_stock_value")}
            </span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t("inv.inventory_value")}</p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-[11px] text-amber-400 uppercase tracking-wide">
              {t("inv.low_stock_items")}
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{lowStock.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t("inv.below_minimum")}</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {t("inv.txn_today")}
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{todayTxnCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t("inv.movement_today")}</p>
        </div>
      </div>

      {/* Row 2: Stok per Kategori */}
      <div className="rounded-lg border border-border/40 bg-card">
        <div className="px-4 py-3 border-b border-border/30">
          <h3 className="text-[13px] font-semibold text-foreground">{t("inv.stock_per_category")}</h3>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {categoryOrder.map((cat) => {
            const agg = byCategory[cat] ?? { count: 0, value: 0 };
            return (
              <Link
                key={cat}
                href={`/inventory/items?category=${cat}`}
                className="rounded-lg border border-border/30 bg-secondary/30 p-3 hover:bg-secondary/60 transition-colors"
              >
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  {t(CATEGORY_KEY[cat])}
                </p>
                <p className="text-[16px] font-semibold text-foreground mt-1">
                  {agg.count} <span className="text-[12px] text-muted-foreground">{t("unit.items")}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatCurrency(agg.value)}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Row 3: Low stock + Recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border/40 bg-card">
          <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-foreground">{t("inv.low_stock_items")}</h3>
            <span className="text-[11px] text-muted-foreground">{lowStock.length} {t("unit.items")}</span>
          </div>
          <div className="p-0">
            {lowStock.length === 0 ? (
              <p className="text-[13px] text-muted-foreground p-4">
                {t("inv.all_above_minimum")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[12px] text-muted-foreground">{t("inv.item")}</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground">{t("inv.stock")}</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground">{t("inv.min_stock_short")}</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.slice(0, 10).map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="text-[13px] font-medium">{translateCommodity(it.name, lang)}</TableCell>
                      <TableCell className="text-[13px] text-red-400">
                        {Number(it.current_stock)} {it.unit}
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">
                        {Number(it.min_stock ?? 0)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/inventory/transaksi?item_id=${it.id}&type=in`}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <Plus className="h-3 w-3" /> {t("inv.add_short")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border/40 bg-card">
          <div className="px-4 py-3 border-b border-border/30">
            <h3 className="text-[13px] font-semibold text-foreground">{t("inv.recent_transactions")}</h3>
          </div>
          <div className="p-0">
            {transactions.length === 0 ? (
              <p className="text-[13px] text-muted-foreground p-4">{t("inv.no_transactions")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[12px] text-muted-foreground">{t("common.date")}</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground">{t("common.type")}</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground">{t("inv.item")}</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground">{t("inv.qty")}</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const item = tx.inventory_items;
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {formatDateTimeLocale(tx.recorded_at, lang, {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${TXN_TYPE_COLORS[tx.txn_type]} border-0 text-[10px]`}
                          >
                            {t(TXN_TYPE_KEY[tx.txn_type])}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[13px] font-medium">
                          {item ? translateCommodity(item.name, lang) : "-"}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">
                          {Number(tx.quantity)} {item?.unit ?? ""}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {t(SOURCE_KEY[tx.source])}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
