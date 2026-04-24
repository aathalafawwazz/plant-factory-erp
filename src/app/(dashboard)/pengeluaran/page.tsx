"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n";
import { translateExpenseCategory, formatDateLocale } from "@/lib/translate-helpers";
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
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
import type {
  Expense,
  ExpenseCategory,
  ExpensePaymentMethod,
  InventoryItem,
} from "@/lib/types/database";

const EXPENSE_CATEGORIES: { value: ExpenseCategory; labelKey: string }[] = [
  { value: "seed", labelKey: "exp.cat_seed" },
  { value: "nutrient", labelKey: "exp.cat_nutrient" },
  { value: "media", labelKey: "exp.cat_media" },
  { value: "ph_solution", labelKey: "exp.cat_ph_solution" },
  { value: "packaging", labelKey: "exp.cat_packaging" },
  { value: "utility", labelKey: "exp.cat_utility" },
  { value: "labor", labelKey: "exp.cat_labor" },
  { value: "equipment", labelKey: "exp.cat_equipment" },
  { value: "maintenance", labelKey: "exp.cat_maintenance" },
  { value: "other", labelKey: "exp.cat_other" },
];

const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  seed: "bg-emerald-500/20 text-emerald-400",
  nutrient: "bg-sky-500/20 text-sky-400",
  media: "bg-amber-500/20 text-amber-400",
  ph_solution: "bg-purple-500/20 text-purple-400",
  packaging: "bg-zinc-500/20 text-zinc-400",
  utility: "bg-blue-500/20 text-blue-400",
  labor: "bg-primary/20 text-primary",
  equipment: "bg-rose-500/20 text-rose-400",
  maintenance: "bg-orange-500/20 text-orange-400",
  other: "bg-muted text-muted-foreground",
};

const PAYMENT_METHODS: { value: ExpensePaymentMethod; labelKey: string }[] = [
  { value: "tunai", labelKey: "exp.pay_tunai" },
  { value: "transfer", labelKey: "exp.pay_transfer" },
  { value: "ewallet", labelKey: "exp.pay_ewallet" },
  { value: "kartu", labelKey: "exp.pay_kartu" },
  { value: "lainnya", labelKey: "exp.pay_lainnya" },
];

const INVENTORY_LINKED_CATEGORIES: ExpenseCategory[] = [
  "seed",
  "nutrient",
  "media",
  "ph_solution",
  "packaging",
  "equipment",
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PengeluaranPage() {
  const supabase = createClient();
  const { t, lang } = useLang();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [formDate, setFormDate] = useState(todayString());
  const [formCategory, setFormCategory] = useState<ExpenseCategory>("other");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formVendor, setFormVendor] = useState("");
  const [formPayment, setFormPayment] = useState<ExpensePaymentMethod>("tunai");
  const [formItemId, setFormItemId] = useState<string>("none");
  const [formQuantity, setFormQuantity] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [expRes, itemRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("inventory_items")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);
    setExpenses((expRes.data ?? []) as Expense[]);
    setItems((itemRes.data ?? []) as InventoryItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Summary cards
  const summary = useMemo(() => {
    const today = todayString();
    const d = new Date();
    const dow = d.getDay();
    const daysFromMon = (dow + 6) % 7;
    const startOfWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysFromMon);
    const weekStart = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;
    const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

    let tdy = 0;
    let wk = 0;
    let mo = 0;
    for (const e of expenses) {
      const amt = Number(e.amount);
      if (e.expense_date >= monthStart) mo += amt;
      if (e.expense_date >= weekStart) wk += amt;
      if (e.expense_date === today) tdy += amt;
    }
    return { today: tdy, week: wk, month: mo };
  }, [expenses]);

  const filtered = useMemo(() => {
    let result = [...expenses];
    if (categoryFilter !== "all") {
      result = result.filter((e) => e.category === categoryFilter);
    }
    if (dateFrom) {
      result = result.filter((e) => e.expense_date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((e) => e.expense_date <= dateTo);
    }
    return result;
  }, [expenses, categoryFilter, dateFrom, dateTo]);

  function resetForm() {
    setFormDate(todayString());
    setFormCategory("other");
    setFormAmount("");
    setFormDescription("");
    setFormVendor("");
    setFormPayment("tunai");
    setFormItemId("none");
    setFormQuantity("");
    setFormNotes("");
  }

  function openAddForm() {
    resetForm();
    setEditing(false);
    setSelected(null);
    setFormOpen(true);
  }

  function openEditForm(e: Expense) {
    setFormDate(e.expense_date);
    setFormCategory(e.category);
    setFormAmount(String(e.amount));
    setFormDescription(e.description);
    setFormVendor(e.vendor ?? "");
    setFormPayment(e.payment_method ?? "tunai");
    setFormItemId(e.inventory_item_id != null ? String(e.inventory_item_id) : "none");
    setFormQuantity(e.quantity != null ? String(e.quantity) : "");
    setFormNotes(e.notes ?? "");
    setSelected(e);
    setEditing(true);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formDate) {
      toast.error(t("exp.date_required"));
      return;
    }
    const amt = Number(formAmount);
    if (!amt || amt < 0) {
      toast.error(t("exp.amount_required"));
      return;
    }
    if (!formDescription.trim()) {
      toast.error(t("exp.description_required"));
      return;
    }
    setSaving(true);
    try {
      const itemId = formItemId !== "none" ? Number(formItemId) : null;
      const qty = formQuantity ? Number(formQuantity) : null;

      const payload = {
        expense_date: formDate,
        category: formCategory,
        amount: amt,
        description: formDescription.trim(),
        vendor: formVendor || null,
        payment_method: formPayment,
        inventory_item_id: itemId,
        quantity: itemId ? qty : null,
        notes: formNotes || null,
      };

      let expenseId: number | null = null;

      if (editing && selected) {
        const { error } = await supabase
          .from("expenses")
          .update(payload)
          .eq("id", selected.id);
        if (error) throw error;
        expenseId = selected.id;
        toast.success(t("exp.updated"));
      } else {
        const { data, error } = await supabase
          .from("expenses")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        expenseId = data?.id ?? null;
        toast.success(t("exp.added"));
      }

      // Link to inventory if applicable (on create only, not edit — to avoid duplicates)
      if (
        !editing &&
        expenseId &&
        itemId &&
        qty &&
        qty > 0 &&
        INVENTORY_LINKED_CATEGORIES.includes(formCategory)
      ) {
        const unitCost = amt / qty;
        const { error: txnErr } = await supabase.from("inventory_transactions").insert({
          item_id: itemId,
          txn_type: "in",
          source: "purchase",
          quantity: qty,
          unit_cost: unitCost,
          total_cost: amt,
          reference_type: "expense",
          reference_id: expenseId,
          notes: formDescription.trim(),
        });
        if (txnErr) {
          toast.error(`${t("exp.linked_txn_failed")}: ${txnErr.message}`);
        } else {
          toast.success(t("exp.linked_txn_created"));
        }
      }

      setFormOpen(false);
      resetForm();
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.save_failed");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function openDelete(e: Expense) {
    setSelected(e);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    try {
      // Delete linked inventory txns first
      const { error: txnErr } = await supabase
        .from("inventory_transactions")
        .delete()
        .eq("reference_type", "expense")
        .eq("reference_id", selected.id);
      if (txnErr) throw txnErr;

      const { error } = await supabase.from("expenses").delete().eq("id", selected.id);
      if (error) throw error;
      toast.success(t("exp.deleted"));
      setDeleteOpen(false);
      setSelected(null);
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.delete_failed");
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  const showInventoryFields = INVENTORY_LINKED_CATEGORIES.includes(formCategory);

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
          <h1 className="text-lg font-semibold text-foreground">{t("exp.title")}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {t("exp.subtitle")}
          </p>
        </div>
        <RoleGate roles={["admin", "operator"]} fallback={null}>
          <Button
            size="sm"
            className="h-9 bg-primary hover:bg-primary/90 text-white text-[13px]"
            onClick={openAddForm}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t("exp.add")}
          </Button>
        </RoleGate>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {t("exp.today")}
          </span>
          <p className="text-xl font-bold text-foreground mt-1">
            {formatCurrency(summary.today)}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {t("exp.this_week")}
          </span>
          <p className="text-xl font-bold text-foreground mt-1">
            {formatCurrency(summary.week)}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {t("exp.this_month")}
          </span>
          <p className="text-xl font-bold text-foreground mt-1">
            {formatCurrency(summary.month)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div>
          <Label className="text-[11px] text-muted-foreground">{t("inv.category")}</Label>
          <Select
            value={categoryFilter}
            onValueChange={(v) => v !== null && setCategoryFilter(v)}
          >
            <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] min-w-[160px]">
              <SelectValue>
                {categoryFilter === "all"
                  ? t("inv.all_categories")
                  : t(EXPENSE_CATEGORIES.find((c) => c.value === categoryFilter)?.labelKey ?? "")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inv.all_categories")}</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {t(c.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Receipt className="size-10 mb-3 opacity-40" />
          <p className="text-[13px]">{t("exp.no_expenses")}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">{t("common.date")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("inv.category")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("exp.description")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("exp.vendor")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("exp.amount")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("exp.payment")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                    {formatDateLocale(e.expense_date, lang, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${EXPENSE_CATEGORY_COLORS[e.category]} border-0 text-[11px]`}
                    >
                      {translateExpenseCategory(e.category, lang)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[13px] max-w-[240px] truncate">
                    {e.description}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {e.vendor ?? "-"}
                  </TableCell>
                  <TableCell className="text-[13px] font-medium">
                    {formatCurrency(Number(e.amount))}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground capitalize">
                    {e.payment_method ?? "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <RoleGate roles={["admin", "operator"]} fallback={null}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditForm(e)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </RoleGate>
                      <RoleGate roles="admin" fallback={null}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => openDelete(e)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </RoleGate>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          className="sm:max-w-[520px] bg-card border-border/50 p-0 gap-0 max-h-[90vh] overflow-y-auto"
          showCloseButton={true}
        >
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>
              {editing ? t("exp.edit") : t("exp.add")}
            </DialogTitle>
          </DialogHeader>

          <Separator className="my-3" />

          <div className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  {t("common.date")} <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  {t("inv.category")} <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={formCategory}
                  onValueChange={(v) =>
                    v !== null && setFormCategory(v as ExpenseCategory)
                  }
                >
                  <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-full">
                    <SelectValue>
                      {t(EXPENSE_CATEGORIES.find((c) => c.value === formCategory)?.labelKey ?? "")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {t(c.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                {t("exp.amount_idr")} <span className="text-red-400">*</span>
              </Label>
              <Input
                type="number"
                step="any"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0"
                className="h-9 bg-secondary border-border/50 text-[12px]"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                {t("exp.description")} <span className="text-red-400">*</span>
              </Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t("exp.description_placeholder")}
                className="h-9 bg-secondary border-border/50 text-[12px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">{t("exp.vendor")}</Label>
                <Input
                  value={formVendor}
                  onChange={(e) => setFormVendor(e.target.value)}
                  placeholder={t("exp.vendor_placeholder")}
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">{t("exp.payment")}</Label>
                <Select
                  value={formPayment}
                  onValueChange={(v) =>
                    v !== null && setFormPayment(v as ExpensePaymentMethod)
                  }
                >
                  <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-full">
                    <SelectValue>
                      {t(PAYMENT_METHODS.find((p) => p.value === formPayment)?.labelKey ?? "")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {t(p.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showInventoryFields && (
              <>
                <Separator />
                <p className="text-[11px] text-muted-foreground italic">
                  {t("exp.inventory_link_note")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      {t("exp.inventory_item")}
                    </Label>
                    <Select
                      value={formItemId}
                      onValueChange={(v) => v !== null && setFormItemId(v)}
                    >
                      <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-full">
                        <SelectValue>
                          {formItemId === "none"
                            ? t("exp.not_linked")
                            : items.find((i) => String(i.id) === formItemId)?.name ??
                              t("inv.select_item")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("exp.not_linked")}</SelectItem>
                        {items.map((it) => (
                          <SelectItem key={it.id} value={String(it.id)}>
                            {it.name} ({it.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      {t("exp.qty_purchased")}
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(e.target.value)}
                      placeholder="0"
                      disabled={formItemId === "none"}
                      className="h-9 bg-secondary border-border/50 text-[12px]"
                    />
                  </div>
                </div>
              </>
            )}

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

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          className="sm:max-w-[400px] bg-card border-border/50 p-0 gap-0"
          showCloseButton={true}
        >
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{t("exp.delete_confirm")}</DialogTitle>
          </DialogHeader>
          <Separator className="my-3" />
          <div className="px-4 pb-4 space-y-3">
            <p className="text-[13px] text-muted-foreground">
              {t("exp.delete_warning")}
            </p>
            {selected && (
              <div className="rounded-lg border border-border/30 bg-secondary/30 p-3">
                <p className="text-[12px] font-medium">{selected.description}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatCurrency(Number(selected.amount))} ·{" "}
                  {new Date(selected.expense_date).toLocaleDateString("id-ID")}
                </p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                className="h-9 text-[12px]"
                onClick={() => setDeleteOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <RoleGate roles="admin" fallback={null}>
                <Button
                  className="h-9 bg-red-500 text-white text-[12px] hover:bg-red-500/90"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? t("exp.deleting") : t("common.delete")}
                </Button>
              </RoleGate>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
