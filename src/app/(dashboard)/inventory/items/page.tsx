"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n";
import {
  translateCommodity,
  translateInventoryCategory,
  formatDateLocale,
} from "@/lib/translate-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Search,
  ArrowUpDown,
  Plus,
  Pencil,
  Package,
} from "lucide-react";
import type {
  InventoryItem,
  InventoryCategory,
  InventoryTransaction,
  InventoryTxnType,
  InventoryTxnSource,
} from "@/lib/types/database";

const CATEGORIES: { value: InventoryCategory; labelKey: string }[] = [
  { value: "seed", labelKey: "inv.cat_seed" },
  { value: "nutrient", labelKey: "inv.cat_nutrient" },
  { value: "media", labelKey: "inv.cat_media" },
  { value: "ph_solution", labelKey: "inv.cat_ph_solution" },
  { value: "packaging", labelKey: "inv.cat_packaging" },
  { value: "equipment", labelKey: "inv.cat_equipment" },
  { value: "product", labelKey: "inv.cat_product" },
  { value: "other", labelKey: "inv.cat_other" },
];

const CATEGORY_COLORS: Record<InventoryCategory, string> = {
  seed: "bg-emerald-500/20 text-emerald-400",
  nutrient: "bg-sky-500/20 text-sky-400",
  media: "bg-amber-500/20 text-amber-400",
  ph_solution: "bg-purple-500/20 text-purple-400",
  packaging: "bg-zinc-500/20 text-zinc-400",
  equipment: "bg-rose-500/20 text-rose-400",
  product: "bg-primary/20 text-primary",
  other: "bg-muted text-muted-foreground",
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

type SortOption = "name_asc" | "newest" | "stock_low";

function ItemsPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const { t, lang } = useLang();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("name_asc");

  // Detail dialog
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [itemTxns, setItemTxns] = useState<InventoryTransaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  // Form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<InventoryCategory>("seed");
  const [formSku, setFormSku] = useState("");
  const [formUnit, setFormUnit] = useState("pcs");
  const [formCurrentStock, setFormCurrentStock] = useState("0");
  const [formMinStock, setFormMinStock] = useState("0");
  const [formUnitCost, setFormUnitCost] = useState("0");
  const [formUnitPrice, setFormUnitPrice] = useState("");
  const [formSupplier, setFormSupplier] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Apply URL category param on mount
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat && CATEGORIES.some((c) => c.value === cat)) {
      setCategoryFilter(cat);
    }
  }, [searchParams]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });
    setItems((data ?? []) as InventoryItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const loadItemTxns = useCallback(
    async (itemId: number) => {
      setLoadingTxns(true);
      const { data } = await supabase
        .from("inventory_transactions")
        .select("*")
        .eq("item_id", itemId)
        .order("recorded_at", { ascending: false })
        .limit(10);
      setItemTxns((data ?? []) as InventoryTransaction[]);
      setLoadingTxns(false);
    },
    [supabase]
  );

  const filtered = useMemo(() => {
    let result = [...items];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.sku ?? "").toLowerCase().includes(q) ||
          (it.supplier ?? "").toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") {
      result = result.filter((it) => it.category === categoryFilter);
    }
    if (sort === "name_asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sort === "stock_low") {
      result.sort((a, b) => Number(a.current_stock) - Number(b.current_stock));
    }
    return result;
  }, [items, search, categoryFilter, sort]);

  function resetForm() {
    setFormName("");
    setFormCategory("seed");
    setFormSku("");
    setFormUnit("pcs");
    setFormCurrentStock("0");
    setFormMinStock("0");
    setFormUnitCost("0");
    setFormUnitPrice("");
    setFormSupplier("");
    setFormNotes("");
  }

  function openAddForm() {
    resetForm();
    setEditing(false);
    setSelected(null);
    setFormOpen(true);
  }

  function openEditForm(it: InventoryItem) {
    setFormName(it.name);
    setFormCategory(it.category);
    setFormSku(it.sku ?? "");
    setFormUnit(it.unit);
    setFormCurrentStock(String(it.current_stock));
    setFormMinStock(String(it.min_stock ?? 0));
    setFormUnitCost(String(it.unit_cost ?? 0));
    setFormUnitPrice(it.unit_price != null ? String(it.unit_price) : "");
    setFormSupplier(it.supplier ?? "");
    setFormNotes(it.notes ?? "");
    setSelected(it);
    setEditing(true);
    setFormOpen(true);
  }

  function openDetail(it: InventoryItem) {
    setSelected(it);
    setItemTxns([]);
    setDetailOpen(true);
    loadItemTxns(it.id);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error(t("inv.item_name_required"));
      return;
    }
    setSaving(true);
    try {
      const basePayload = {
        name: formName.trim(),
        category: formCategory,
        sku: formSku || null,
        unit: formUnit || "pcs",
        min_stock: Number(formMinStock) || 0,
        unit_cost: Number(formUnitCost) || 0,
        unit_price: formUnitPrice ? Number(formUnitPrice) : null,
        supplier: formSupplier || null,
        notes: formNotes || null,
      };

      if (editing && selected) {
        const { error } = await supabase
          .from("inventory_items")
          .update(basePayload)
          .eq("id", selected.id);
        if (error) throw error;
        toast.success(t("inv.item_updated"));
      } else {
        const payload = {
          ...basePayload,
          current_stock: Number(formCurrentStock) || 0,
        };
        const { error } = await supabase.from("inventory_items").insert(payload);
        if (error) throw error;
        toast.success(t("inv.item_added"));
      }

      setFormOpen(false);
      setDetailOpen(false);
      resetForm();
      await loadItems();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.save_failed");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        {t("common.loading_data")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t("inv.items_title")}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {t("inv.items_subtitle")}
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 bg-primary hover:bg-primary/90 text-white text-[13px]"
          onClick={openAddForm}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("inv.add_item")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("inv.search_items")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 bg-secondary border-border/50 text-[12px]"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => v !== null && setCategoryFilter(v)}>
          <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-auto min-w-[150px]">
            <SelectValue>
              {categoryFilter === "all"
                ? t("inv.all_categories")
                : t(CATEGORIES.find((c) => c.value === categoryFilter)?.labelKey ?? "")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("inv.all_categories")}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {t(c.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => v !== null && setSort(v as SortOption)}>
          <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-auto min-w-[140px]">
            <ArrowUpDown className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue>
              {sort === "name_asc"
                ? t("inv.sort_name_asc")
                : sort === "newest"
                  ? t("inv.sort_newest")
                  : t("inv.sort_stock_low")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">{t("inv.sort_name_asc")}</SelectItem>
            <SelectItem value="newest">{t("inv.sort_newest")}</SelectItem>
            <SelectItem value="stock_low">{t("inv.sort_stock_low")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Package className="size-10 mb-3 opacity-40" />
          <p className="text-[13px]">{t("inv.no_items")}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">{t("common.name")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("inv.category")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">SKU</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("inv.stock")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("inv.unit_field")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("inv.unit_cost")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("inv.supplier")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((it) => {
                const stock = Number(it.current_stock);
                const min = Number(it.min_stock ?? 0);
                let stockColor = "text-emerald-400";
                if (stock < min) stockColor = "text-red-400";
                else if (stock === min) stockColor = "text-amber-400";

                return (
                  <TableRow
                    key={it.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(it)}
                  >
                    <TableCell className="text-[13px] font-medium">{translateCommodity(it.name, lang)}</TableCell>
                    <TableCell>
                      <Badge
                        className={`${CATEGORY_COLORS[it.category]} border-0 text-[11px]`}
                      >
                        {translateInventoryCategory(it.category, lang)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {it.sku ?? "-"}
                    </TableCell>
                    <TableCell className={`text-[13px] font-medium ${stockColor}`}>
                      {stock} / {min}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {it.unit}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {formatCurrency(Number(it.unit_cost ?? 0))}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground max-w-[160px] truncate">
                      {it.supplier ?? "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent
          className="sm:max-w-[560px] bg-card border-border/50 p-0 gap-0 max-h-[85vh] overflow-y-auto"
          showCloseButton={true}
        >
          {selected && (
            <>
              <DialogHeader className="p-4 pb-0">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <DialogTitle>{translateCommodity(selected.name, lang)}</DialogTitle>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        className={`${CATEGORY_COLORS[selected.category]} border-0 text-[11px]`}
                      >
                        {translateInventoryCategory(selected.category, lang)}
                      </Badge>
                      {selected.sku && (
                        <span className="text-[11px] text-muted-foreground">
                          SKU: {selected.sku}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setDetailOpen(false);
                      openEditForm(selected);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </DialogHeader>

              <Separator className="my-3" />

              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{t("inv.current_stock")}</Label>
                    <div className="text-[13px] font-medium">
                      {Number(selected.current_stock)} {selected.unit}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{t("inv.min_stock")}</Label>
                    <div className="text-[13px]">
                      {Number(selected.min_stock ?? 0)} {selected.unit}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{t("inv.unit_cost")}</Label>
                    <div className="text-[13px]">
                      {formatCurrency(Number(selected.unit_cost ?? 0))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{t("inv.sale_price")}</Label>
                    <div className="text-[13px]">
                      {selected.unit_price != null
                        ? formatCurrency(Number(selected.unit_price))
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{t("inv.supplier")}</Label>
                    <div className="text-[13px]">{selected.supplier ?? "-"}</div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{t("common.created")}</Label>
                    <div className="text-[13px]">
                      {formatDateLocale(selected.created_at, lang, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
                {selected.notes && (
                  <div>
                    <Label className="text-[11px] text-muted-foreground">{t("common.notes")}</Label>
                    <div className="text-[13px]">{selected.notes}</div>
                  </div>
                )}

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-semibold text-foreground">
                      {t("inv.last_transactions")}
                    </h4>
                    <Link
                      href={`/inventory/transaksi?item_id=${selected.id}`}
                      className="text-[11px] text-primary hover:underline"
                    >
                      {t("inv.add_transaction")} →
                    </Link>
                  </div>
                  {loadingTxns ? (
                    <p className="text-[12px] text-muted-foreground">{t("common.loading")}</p>
                  ) : itemTxns.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">{t("inv.no_transactions")}</p>
                  ) : (
                    <div className="space-y-1">
                      {itemTxns.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`${TXN_TYPE_COLORS[tx.txn_type]} border-0 text-[10px]`}
                            >
                              {t(TXN_TYPE_KEY[tx.txn_type])}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDateLocale(tx.recorded_at, lang, {
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium">
                              {Number(tx.quantity)} {selected.unit}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {t(SOURCE_KEY[tx.source])}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          className="sm:max-w-[520px] bg-card border-border/50 p-0 gap-0 max-h-[90vh] overflow-y-auto"
          showCloseButton={true}
        >
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{editing ? t("inv.edit_item") : t("inv.add_item")}</DialogTitle>
          </DialogHeader>

          <Separator className="my-3" />

          <div className="px-4 pb-4 space-y-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">
                {t("common.name")} <span className="text-red-400">*</span>
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("inv.item_name_placeholder")}
                className="h-9 bg-secondary border-border/50 text-[12px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  {t("inv.category")} <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={formCategory}
                  onValueChange={(v) => v !== null && setFormCategory(v as InventoryCategory)}
                >
                  <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-full">
                    <SelectValue>
                      {t(CATEGORIES.find((c) => c.value === formCategory)?.labelKey ?? "")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {t(c.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">SKU</Label>
                <Input
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  placeholder="SKU-001"
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">{t("inv.unit_field")}</Label>
                <Input
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  placeholder="pcs"
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
              {!editing && (
                <div>
                  <Label className="text-[11px] text-muted-foreground">{t("inv.initial_stock")}</Label>
                  <Input
                    type="number"
                    value={formCurrentStock}
                    onChange={(e) => setFormCurrentStock(e.target.value)}
                    className="h-9 bg-secondary border-border/50 text-[12px]"
                  />
                </div>
              )}
              <div>
                <Label className="text-[11px] text-muted-foreground">{t("inv.min_stock_short")}</Label>
                <Input
                  type="number"
                  value={formMinStock}
                  onChange={(e) => setFormMinStock(e.target.value)}
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">{t("inv.unit_cost_idr")}</Label>
                <Input
                  type="number"
                  value={formUnitCost}
                  onChange={(e) => setFormUnitCost(e.target.value)}
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">{t("inv.sale_price_idr")}</Label>
                <Input
                  type="number"
                  value={formUnitPrice}
                  onChange={(e) => setFormUnitPrice(e.target.value)}
                  placeholder={t("inv.optional")}
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">{t("inv.supplier")}</Label>
              <Input
                value={formSupplier}
                onChange={(e) => setFormSupplier(e.target.value)}
                placeholder={t("inv.supplier_placeholder")}
                className="h-9 bg-secondary border-border/50 text-[12px]"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">{t("common.notes")}</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={t("inv.notes_placeholder")}
                className="bg-secondary border-border/50 text-[12px] min-h-[60px]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                className="h-9 text-[12px]"
                onClick={() => setFormOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="h-9 bg-primary text-white text-[12px] hover:bg-primary/90"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted-foreground text-sm">Loading...</div>}>
      <ItemsPageInner />
    </Suspense>
  );
}
