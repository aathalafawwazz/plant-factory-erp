"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n";
import { translateCommodity, formatDateTimeLocale } from "@/lib/translate-helpers";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/role-gate";
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
import { Plus, Activity } from "lucide-react";
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

const TXN_TYPES: { value: InventoryTxnType; labelKey: string }[] = [
  { value: "in", labelKey: "inv.txn_type_in" },
  { value: "out", labelKey: "inv.txn_type_out" },
  { value: "adjustment", labelKey: "inv.txn_type_adjustment" },
];

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

const SOURCES: { value: InventoryTxnSource; labelKey: string }[] = [
  { value: "purchase", labelKey: "inv.source_purchase" },
  { value: "harvest", labelKey: "inv.source_harvest" },
  { value: "sale", labelKey: "inv.source_sale" },
  { value: "usage", labelKey: "inv.source_usage" },
  { value: "waste", labelKey: "inv.source_waste" },
  { value: "manual", labelKey: "inv.source_manual" },
];

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

function TransaksiPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const { t, lang } = useLang();

  const [txns, setTxns] = useState<TxnWithItem[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formItemId, setFormItemId] = useState<string>("");
  const [formType, setFormType] = useState<InventoryTxnType>("in");
  const [formSource, setFormSource] = useState<InventoryTxnSource>("manual");
  const [formQuantity, setFormQuantity] = useState("");
  const [formUnitCost, setFormUnitCost] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [txnRes, itemRes] = await Promise.all([
      supabase
        .from("inventory_transactions")
        .select("*, inventory_items(name, unit, category)")
        .order("recorded_at", { ascending: false })
        .limit(200),
      supabase
        .from("inventory_items")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);
    setTxns((txnRes.data ?? []) as TxnWithItem[]);
    setItems((itemRes.data ?? []) as InventoryItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Apply URL params on mount (after items loaded, so user sees preselected)
  useEffect(() => {
    const itemId = searchParams.get("item_id");
    const type = searchParams.get("type");
    if (itemId) setFormItemId(itemId);
    if (type && TXN_TYPES.some((t) => t.value === type)) {
      setFormType(type as InventoryTxnType);
    }
    if (itemId || type) {
      setFormOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let result = [...txns];
    if (dateFrom) {
      const ts = new Date(dateFrom).getTime();
      result = result.filter((t) => new Date(t.recorded_at).getTime() >= ts);
    }
    if (dateTo) {
      const ts = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000;
      result = result.filter((t) => new Date(t.recorded_at).getTime() <= ts);
    }
    if (itemFilter !== "all") {
      result = result.filter((t) => String(t.item_id) === itemFilter);
    }
    if (typeFilter !== "all") {
      result = result.filter((t) => t.txn_type === typeFilter);
    }
    if (sourceFilter !== "all") {
      result = result.filter((t) => t.source === sourceFilter);
    }
    return result;
  }, [txns, dateFrom, dateTo, itemFilter, typeFilter, sourceFilter]);

  function resetForm() {
    setFormItemId("");
    setFormType("in");
    setFormSource("manual");
    setFormQuantity("");
    setFormUnitCost("");
    setFormNotes("");
  }

  function openAddForm() {
    resetForm();
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formItemId) {
      toast.error(t("inv.item_required"));
      return;
    }
    const qty = Number(formQuantity);
    if (!qty || qty <= 0) {
      toast.error(t("inv.qty_must_positive"));
      return;
    }
    setSaving(true);
    try {
      const unitCost = formUnitCost ? Number(formUnitCost) : 0;
      const totalCost = qty * unitCost;
      const { error } = await supabase.from("inventory_transactions").insert({
        item_id: Number(formItemId),
        txn_type: formType,
        source: formSource,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        notes: formNotes || null,
      });
      if (error) throw error;
      toast.success(t("inv.txn_added"));
      setFormOpen(false);
      resetForm();
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("inv.txn_save_failed");
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
          <h1 className="text-lg font-semibold text-foreground">{t("inv.txn_title")}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {t("inv.txn_subtitle")}
          </p>
        </div>
        <RoleGate roles={["admin", "operator"]} fallback={null}>
          <Button
            size="sm"
            className="h-9 bg-primary hover:bg-primary/90 text-white text-[13px]"
            onClick={openAddForm}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t("inv.add_transaction")}
          </Button>
        </RoleGate>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div>
          <Label className="text-[11px] text-muted-foreground">{t("common.from")}</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 bg-secondary border-border/50 text-[12px] w-[150px]"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">{t("common.to")}</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 bg-secondary border-border/50 text-[12px] w-[150px]"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">{t("inv.item")}</Label>
          <Select value={itemFilter} onValueChange={(v) => v !== null && setItemFilter(v)}>
            <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] min-w-[180px]">
              <SelectValue>
                {itemFilter === "all"
                  ? t("inv.all_items")
                  : translateCommodity(
                      items.find((i) => String(i.id) === itemFilter)?.name ?? "-",
                      lang
                    )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inv.all_items")}</SelectItem>
              {items.map((it) => (
                <SelectItem key={it.id} value={String(it.id)}>
                  {translateCommodity(it.name, lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">{t("common.type")}</Label>
          <Select value={typeFilter} onValueChange={(v) => v !== null && setTypeFilter(v)}>
            <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] min-w-[130px]">
              <SelectValue>
                {typeFilter === "all"
                  ? t("inv.all")
                  : t(TXN_TYPE_KEY[typeFilter as InventoryTxnType])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inv.all")}</SelectItem>
              {TXN_TYPES.map((tp) => (
                <SelectItem key={tp.value} value={tp.value}>
                  {t(tp.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Source</Label>
          <Select value={sourceFilter} onValueChange={(v) => v !== null && setSourceFilter(v)}>
            <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] min-w-[150px]">
              <SelectValue>
                {sourceFilter === "all"
                  ? t("inv.all")
                  : t(SOURCE_KEY[sourceFilter as InventoryTxnSource])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inv.all")}</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {t(s.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Activity className="size-10 mb-3 opacity-40" />
          <p className="text-[13px]">{t("inv.no_txns_found")}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">{t("common.date")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("inv.item")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("inv.category")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("common.type")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Source</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("inv.qty")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("inv.unit_cost")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("common.total")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("inv.notes_short")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tx) => {
                const item = tx.inventory_items;
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDateTimeLocale(tx.recorded_at, lang, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-[13px] font-medium">
                      {item ? translateCommodity(item.name, lang) : "-"}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {item?.category ? t(CATEGORY_KEY[item.category]) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${TXN_TYPE_COLORS[tx.txn_type]} border-0 text-[11px]`}>
                        {t(TXN_TYPE_KEY[tx.txn_type])}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {t(SOURCE_KEY[tx.source])}
                    </TableCell>
                    <TableCell className="text-[13px] font-medium">
                      {Number(tx.quantity)} {item?.unit ?? ""}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {tx.unit_cost != null ? formatCurrency(Number(tx.unit_cost)) : "-"}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {tx.total_cost != null ? formatCurrency(Number(tx.total_cost)) : "-"}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground max-w-[160px] truncate">
                      {tx.notes ?? "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          className="sm:max-w-[480px] bg-card border-border/50 p-0 gap-0 max-h-[90vh] overflow-y-auto"
          showCloseButton={true}
        >
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{t("inv.add_transaction")}</DialogTitle>
          </DialogHeader>

          <Separator className="my-3" />

          <div className="px-4 pb-4 space-y-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">
                {t("inv.item")} <span className="text-red-400">*</span>
              </Label>
              <Select value={formItemId} onValueChange={(v) => v !== null && setFormItemId(v)}>
                <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-full">
                  <SelectValue placeholder={t("inv.select_item")}>
                    {formItemId
                      ? translateCommodity(
                          items.find((i) => String(i.id) === formItemId)?.name ?? "",
                          lang
                        )
                      : t("inv.select_item")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {items.map((it) => (
                    <SelectItem key={it.id} value={String(it.id)}>
                      {translateCommodity(it.name, lang)} ({it.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  {t("common.type")} <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={formType}
                  onValueChange={(v) => v !== null && setFormType(v as InventoryTxnType)}
                >
                  <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-full">
                    <SelectValue>{t(TXN_TYPE_KEY[formType])}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TXN_TYPES.map((tp) => (
                      <SelectItem key={tp.value} value={tp.value}>
                        {t(tp.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Source <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={formSource}
                  onValueChange={(v) => v !== null && setFormSource(v as InventoryTxnSource)}
                >
                  <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-full">
                    <SelectValue>{t(SOURCE_KEY[formSource])}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {t(s.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  {t("common.quantity")} <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(e.target.value)}
                  placeholder="0"
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">{t("inv.unit_cost_idr")}</Label>
                <Input
                  type="number"
                  step="any"
                  value={formUnitCost}
                  onChange={(e) => setFormUnitCost(e.target.value)}
                  placeholder="0"
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">{t("common.notes")}</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={t("inv.txn_notes_placeholder")}
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

export default function TransaksiPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted-foreground text-sm">Loading...</div>}>
      <TransaksiPageInner />
    </Suspense>
  );
}
