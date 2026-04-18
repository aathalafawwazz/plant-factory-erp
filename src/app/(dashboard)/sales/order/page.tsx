"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, ArrowUpDown, List, LayoutGrid, ShoppingCart, Trash2, Printer, AlertTriangle } from "lucide-react";

/* ---- Constants ---- */
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
const PAY_METHODS = [
  { value: "tunai", label: "Tunai" },
  { value: "transfer", label: "Transfer" },
  { value: "invoice", label: "Invoice" },
];
const GRADES = ["A", "B", "C"];
const SORT_LABELS: Record<string, string> = { date_desc: "Terbaru", date_asc: "Terlama", total_desc: "Total Tertinggi" };

/* ---- Types ---- */
interface Customer { id: number; name: string; phone: string | null; address: string | null }
interface Crop { id: number; name_id: string }
interface OrderItem { id?: number; crop_catalog_id: number | null; crop_catalog?: { name_id: string } | null; quantity_kg: number; price_per_kg: number; grade: string; subtotal: number }
interface SalesOrder {
  id: number; order_number?: string; invoice_number?: string | null; created_at: string;
  customer_id: number; customers?: Customer | null; total_amount: number;
  discount_amount: number; tax_percent: number; tax_amount: number; grand_total: number;
  due_date: string | null; status: string; payment_status: string; payment_method: string;
  notes: string | null; sales_order_items: OrderItem[];
}
interface PayLog { id: number; order_id: number; payment_date: string; amount: number; method: string | null; reference: string | null; notes: string | null }
type SortKey = "date_desc" | "date_asc" | "total_desc";

/* ---- Helpers ---- */
const fmtCurrency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 });
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); }
function isOverdue(o: SalesOrder) { return !!o.due_date && o.payment_status !== "paid" && new Date(o.due_date) < new Date(); }
function orderLabel(o: SalesOrder) { return o.order_number ?? o.invoice_number ?? `#${o.id}`; }
function gt(o: SalesOrder) { return o.grand_total ?? o.total_amount; }

/* ---- Component ---- */
export default function SalesOrderPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockMap, setStockMap] = useState<Record<number, number>>({});
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [view, setView] = useState<"list" | "grid">("list");
  const [statusFilter, setStatusFilter] = useState("all");
  /* create dialog */
  const [createOpen, setCreateOpen] = useState(false);
  const [formCust, setFormCust] = useState("");
  const [formPay, setFormPay] = useState("tunai");
  const [formNotes, setFormNotes] = useState("");
  const [formDue, setFormDue] = useState("");
  const [formDisc, setFormDisc] = useState(0);
  const [formTax, setFormTax] = useState(0);
  const [formItems, setFormItems] = useState<OrderItem[]>([{ crop_catalog_id: null, quantity_kg: 0, price_per_kg: 0, grade: "A", subtotal: 0 }]);
  const [hints, setHints] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  /* detail dialog */
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStatus, setDetailStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  /* payments */
  const [payLogs, setPayLogs] = useState<PayLog[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmt, setPayAmt] = useState(0);
  const [payMeth, setPayMeth] = useState("tunai");
  const [payRef, setPayRef] = useState("");
  const [payNote, setPayNote] = useState("");
  const [savingPay, setSavingPay] = useState(false);

  /* ---- Load ---- */
  const loadStock = useCallback(async () => {
    const [h, s] = await Promise.all([
      supabase.from("planting_cycles").select("crop_catalog_id, harvest_weight_g").eq("status", "harvested"),
      supabase.from("sales_order_items").select("crop_catalog_id, quantity_kg, sales_orders!inner(status)").in("sales_orders.status" as never, ["delivered", "paid"]),
    ]);
    const m: Record<number, number> = {};
    for (const r of (h.data ?? []) as { crop_catalog_id: number; harvest_weight_g: number | null }[])
      if (r.harvest_weight_g) m[r.crop_catalog_id] = (m[r.crop_catalog_id] ?? 0) + r.harvest_weight_g / 1000;
    for (const r of (s.data ?? []) as { crop_catalog_id: number; quantity_kg: number }[])
      m[r.crop_catalog_id] = (m[r.crop_catalog_id] ?? 0) - r.quantity_kg;
    setStockMap(m);
  }, [supabase]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [o, c, cr] = await Promise.all([
      supabase.from("sales_orders").select("*, customers(name, phone, address), sales_order_items(*, crop_catalog(name_id))").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name, phone, address").order("name"),
      supabase.from("crop_catalog").select("id, name_id").order("name_id"),
    ]);
    setOrders((o.data as unknown as SalesOrder[]) ?? []);
    setCustomers((c.data as Customer[]) ?? []);
    setCrops((cr.data as Crop[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); loadStock(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  /* ---- Filter/Sort ---- */
  const filtered = useMemo(() => {
    let list = [...orders];
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    if (sort === "date_asc") list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    else if (sort === "total_desc") list.sort((a, b) => gt(b) - gt(a));
    else list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [orders, sort, statusFilter]);

  /* ---- Price hint ---- */
  async function fetchHint(cropId: number, grade: string) {
    const { data } = await supabase.from("price_history").select("price_per_kg").eq("crop_catalog_id", cropId).eq("quality_grade", grade).order("effective_date", { ascending: false }).limit(1).single();
    if (data) setHints((p) => ({ ...p, [`${cropId}-${grade}`]: data.price_per_kg }));
  }

  /* ---- Item helpers ---- */
  function updateItem(i: number, field: keyof OrderItem, val: unknown) {
    setFormItems((prev) => {
      const next = [...prev]; const it = { ...next[i], [field]: val };
      it.subtotal = it.quantity_kg * it.price_per_kg; next[i] = it; return next;
    });
    if (field === "crop_catalog_id" || field === "grade") {
      const cur = formItems[i];
      const cid = field === "crop_catalog_id" ? (val as number) : cur.crop_catalog_id;
      const g = field === "grade" ? (val as string) : cur.grade;
      if (cid) {
        fetchHint(cid, g);
        const k = `${cid}-${g}`;
        setTimeout(() => {
          setFormItems((prev) => {
            const c = prev[i];
            if (c?.price_per_kg === 0 && hints[k]) {
              const u = [...prev]; u[i] = { ...c, price_per_kg: hints[k], subtotal: c.quantity_kg * hints[k] }; return u;
            }
            return prev;
          });
        }, 500);
      }
    }
  }
  function applyHint(i: number, p: number) {
    setFormItems((prev) => { const n = [...prev]; const it = { ...n[i], price_per_kg: p }; it.subtotal = it.quantity_kg * p; n[i] = it; return n; });
  }
  function addItem() { setFormItems((p) => [...p, { crop_catalog_id: null, quantity_kg: 0, price_per_kg: 0, grade: "A", subtotal: 0 }]); }
  function removeItem(i: number) { setFormItems((p) => p.filter((_, x) => x !== i)); }

  const sub = useMemo(() => formItems.reduce((s, it) => s + it.quantity_kg * it.price_per_kg, 0), [formItems]);
  const taxAmt = useMemo(() => (sub - formDisc) * formTax / 100, [sub, formDisc, formTax]);
  const grandT = useMemo(() => sub - formDisc + taxAmt, [sub, formDisc, taxAmt]);

  /* ---- Create ---- */
  async function handleCreate() {
    if (!formCust) { toast.error("Pilih pelanggan"); return; }
    const valid = formItems.filter((i) => i.crop_catalog_id && i.quantity_kg > 0);
    if (!valid.length) { toast.error("Tambahkan minimal 1 item"); return; }
    setSaving(true);
    const subtotal = valid.reduce((s, i) => s + i.quantity_kg * i.price_per_kg, 0);
    const tax = (subtotal - formDisc) * formTax / 100;
    const grand = subtotal - formDisc + tax;
    const { data: ord, error: e1 } = await supabase.from("sales_orders").insert({
      customer_id: Number(formCust), total_amount: subtotal, discount_amount: formDisc,
      tax_percent: formTax, tax_amount: tax, grand_total: grand, status: "pending",
      payment_status: "unpaid", payment_method: formPay || null,
      due_date: formDue || null, notes: formNotes || null,
    }).select("id").single();
    if (e1 || !ord) { toast.error("Gagal membuat order: " + (e1?.message ?? "")); setSaving(false); return; }
    const rows = valid.map((i) => ({ order_id: ord.id, crop_catalog_id: i.crop_catalog_id!, quantity_kg: i.quantity_kg, unit_price: i.price_per_kg, quality_grade: i.grade || null, subtotal: i.quantity_kg * i.price_per_kg }));
    const { error: e2 } = await supabase.from("sales_order_items").insert(rows);
    if (e2) { toast.error("Gagal menyimpan item: " + e2.message); setSaving(false); return; }
    await supabase.from("price_history").insert(valid.map((i) => ({ crop_catalog_id: i.crop_catalog_id!, quality_grade: i.grade || null, price_per_kg: i.price_per_kg })));
    toast.success("Order berhasil dibuat"); setSaving(false); setCreateOpen(false); resetForm(); loadData(); loadStock();
  }
  function resetForm() { setFormCust(""); setFormPay("Tunai"); setFormNotes(""); setFormDue(""); setFormDisc(0); setFormTax(0); setHints({}); setFormItems([{ crop_catalog_id: null, quantity_kg: 0, price_per_kg: 0, grade: "A", subtotal: 0 }]); }

  /* ---- Status update ---- */
  async function handleStatusUpdate() {
    if (!detailOrder || !detailStatus) return;
    setUpdatingStatus(true);
    const upd: { status: string; payment_status?: string } = { status: detailStatus };
    if (detailStatus === "paid") upd.payment_status = "paid";
    const { error } = await supabase.from("sales_orders").update(upd).eq("id", detailOrder.id);
    if (error) toast.error("Gagal update status: " + error.message);
    else { toast.success("Status berhasil diubah"); setDetailOpen(false); loadData(); }
    setUpdatingStatus(false);
  }

  /* ---- Payment logs ---- */
  async function loadPay(oid: number) {
    const { data } = await supabase.from("payment_logs").select("*").eq("order_id", oid).order("payment_date", { ascending: false });
    setPayLogs((data as PayLog[]) ?? []);
  }
  async function handleSavePay() {
    if (!detailOrder || payAmt <= 0) { toast.error("Jumlah harus > 0"); return; }
    setSavingPay(true);
    const { error } = await supabase.from("payment_logs").insert({ order_id: detailOrder.id, amount: payAmt, method: payMeth || null, reference: payRef || null, notes: payNote || null });
    if (error) { toast.error("Gagal: " + error.message); setSavingPay(false); return; }
    const { data: all } = await supabase.from("payment_logs").select("amount").eq("order_id", detailOrder.id);
    const tot = (all ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
    const g = gt(detailOrder);
    const ps = tot >= g ? "paid" : tot > 0 ? "partial" : "unpaid";
    await supabase.from("sales_orders").update({ payment_status: ps }).eq("id", detailOrder.id);
    toast.success("Pembayaran tercatat"); setSavingPay(false); setPayOpen(false);
    setPayAmt(0); setPayMeth("tunai"); setPayRef(""); setPayNote("");
    loadPay(detailOrder.id); loadData();
  }

  function openDetail(o: SalesOrder) { setDetailOrder(o); setDetailStatus(o.status); setDetailOpen(true); setPayOpen(false); setPayLogs([]); loadPay(o.id); }
  function stockOf(id: number | null) { return id ? (stockMap[id] ?? 0) : null; }
  function stkColor(kg: number) { return kg > 5 ? "text-emerald-400" : kg >= 1 ? "text-amber-400" : "text-red-400"; }

  /* ---- Render ---- */
  return (<>
    <style>{`@media print{body *{visibility:hidden!important}#print-invoice,#print-invoice *{visibility:visible!important}#print-invoice{position:absolute;left:0;top:0;width:100%;background:#fff;color:#000;padding:24px}#print-invoice table{border-collapse:collapse;width:100%}#print-invoice th,#print-invoice td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:13px}#print-invoice th{background:#f5f5f5;font-weight:600}#print-invoice .tr{text-align:right}}@media screen{#print-invoice{display:none}}`}</style>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Sales Order</h1>
        <Button className="h-9 bg-[oklch(0.65_0.18_260)] text-white text-[13px] hover:bg-[oklch(0.60_0.20_260)]" onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />Buat Order
        </Button>
      </div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={sort} onValueChange={(v) => v !== null && setSort(v as SortKey)}>
          <SelectTrigger className="w-[160px] h-9 bg-secondary border-border/50 text-[13px]">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" /><SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent>{Object.entries(SORT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => v !== null && setStatusFilter(v)}>
          <SelectTrigger className="w-[160px] h-9 bg-secondary border-border/50 text-[13px]">
            <SelectValue>{statusFilter === "all" ? "Semua" : ORDER_STATUS[statusFilter]?.label ?? statusFilter}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            {Object.entries(ORDER_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setView("list")}><List className="w-4 h-4" /></Button>
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setView("grid")}><LayoutGrid className="w-4 h-4" /></Button>
        </div>
      </div>
      {loading && <Card className="rounded-xl border border-border/40 bg-card"><CardContent className="py-12 text-center text-muted-foreground">Memuat data order...</CardContent></Card>}
      {!loading && filtered.length === 0 && <Card className="rounded-xl border border-border/40 bg-card"><CardContent className="py-16 text-center"><ShoppingCart className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Belum ada order.</p></CardContent></Card>}
      {/* Table view */}
      {!loading && filtered.length > 0 && view === "list" && (
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-[12px] text-muted-foreground">No. Order</TableHead>
              <TableHead className="text-[12px] text-muted-foreground">Tanggal</TableHead>
              <TableHead className="text-[12px] text-muted-foreground">Pelanggan</TableHead>
              <TableHead className="text-[12px] text-muted-foreground">Items</TableHead>
              <TableHead className="text-[12px] text-muted-foreground text-right">Grand Total</TableHead>
              <TableHead className="text-[12px] text-muted-foreground">Status</TableHead>
              <TableHead className="text-[12px] text-muted-foreground">Pembayaran</TableHead>
            </TableRow></TableHeader>
            <TableBody>{filtered.map((o) => (
              <TableRow key={o.id} className="cursor-pointer hover:bg-secondary/50" onClick={() => openDetail(o)}>
                <TableCell className="text-[13px] font-mono">{orderLabel(o)}</TableCell>
                <TableCell className="text-[13px]">{fmtDate(o.created_at)}</TableCell>
                <TableCell className="text-[13px]">{o.customers?.name ?? "-"}</TableCell>
                <TableCell className="text-[13px]">{o.sales_order_items.map((i) => i.crop_catalog?.name_id ?? "?").join(", ")}</TableCell>
                <TableCell className="text-[13px] text-right font-medium">{fmtCurrency.format(gt(o))}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-[11px] border-0 ${ORDER_STATUS[o.status]?.color ?? ""}`}>{ORDER_STATUS[o.status]?.label ?? o.status}</Badge>
                    {isOverdue(o) && <Badge variant="outline" className="text-[10px] border-0 bg-red-500/20 text-red-400"><AlertTriangle className="w-3 h-3 mr-0.5" />Jatuh Tempo</Badge>}
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className={`text-[11px] border-0 ${PAYMENT_STATUS[o.payment_status]?.color ?? ""}`}>{PAYMENT_STATUS[o.payment_status]?.label ?? o.payment_status}</Badge></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      )}
      {/* Grid view */}
      {!loading && filtered.length > 0 && view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((o) => (
            <Card key={o.id} className="rounded-xl border border-border/40 bg-card cursor-pointer hover:border-border/80 transition-colors" onClick={() => openDetail(o)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div><p className="text-[12px] text-muted-foreground">{fmtDate(o.created_at)}</p><p className="text-[14px] font-medium text-foreground">{o.customers?.name ?? "-"}</p></div>
                  <p className="text-[11px] font-mono text-muted-foreground">{orderLabel(o)}</p>
                </div>
                <p className="text-[13px] text-muted-foreground">{o.sales_order_items.map((i) => `${i.crop_catalog?.name_id ?? "?"} (${i.quantity_kg} kg)`).join(", ")}</p>
                <p className="text-xl font-bold text-foreground">{fmtCurrency.format(gt(o))}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[11px] border-0 ${ORDER_STATUS[o.status]?.color ?? ""}`}>{ORDER_STATUS[o.status]?.label ?? o.status}</Badge>
                  <Badge variant="outline" className={`text-[11px] border-0 ${PAYMENT_STATUS[o.payment_status]?.color ?? ""}`}>{PAYMENT_STATUS[o.payment_status]?.label ?? o.payment_status}</Badge>
                  {isOverdue(o) && <Badge variant="outline" className="text-[10px] border-0 bg-red-500/20 text-red-400"><AlertTriangle className="w-3 h-3 mr-0.5" />Jatuh Tempo</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>

    {/* ==== Create Order Dialog ==== */}
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border/40">
        <DialogHeader><DialogTitle className="text-foreground">Buat Order Baru</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Pelanggan <span className="text-red-400">*</span></Label>
            <Select value={formCust} onValueChange={(v) => v !== null && setFormCust(v)}>
              <SelectTrigger className="h-11 bg-secondary border-border/50">
                <SelectValue>{formCust ? customers.find((c) => String(c.id) === formCust)?.name ?? "Pilih pelanggan" : "Pilih pelanggan"}</SelectValue>
              </SelectTrigger>
              <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Separator />
          {/* Items */}
          <div className="space-y-3">
            <Label className="text-[13px] text-muted-foreground">Item Order</Label>
            {formItems.map((item, idx) => {
              const stk = stockOf(item.crop_catalog_id);
              const hk = `${item.crop_catalog_id}-${item.grade}`;
              const hp = hints[hk];
              return (
                <div key={idx} className="rounded-lg border border-border/40 bg-secondary/30 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground font-medium">Item #{idx + 1}</span>
                    {formItems.length > 1 && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => removeItem(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[12px] text-muted-foreground">Komoditas</Label>
                      <Select value={item.crop_catalog_id ? String(item.crop_catalog_id) : ""} onValueChange={(v) => v !== null && updateItem(idx, "crop_catalog_id", Number(v))}>
                        <SelectTrigger className="h-9 bg-secondary border-border/50 text-[13px]">
                          <SelectValue>{item.crop_catalog_id ? crops.find((c) => c.id === item.crop_catalog_id)?.name_id ?? "Pilih" : "Pilih komoditas"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>{crops.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name_id}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[12px] text-muted-foreground">Grade</Label>
                      <Select value={item.grade} onValueChange={(v) => v !== null && updateItem(idx, "grade", v)}>
                        <SelectTrigger className="h-9 bg-secondary border-border/50 text-[13px]"><SelectValue>{item.grade}</SelectValue></SelectTrigger>
                        <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[12px] text-muted-foreground">Qty (kg)</Label>
                      <Input type="number" min={0} step={0.1} className="h-9 bg-secondary border-border/50 text-[13px]" value={item.quantity_kg || ""} onChange={(e) => updateItem(idx, "quantity_kg", Number(e.target.value))} />
                      {stk !== null && <p className={`text-[11px] ${stkColor(stk)}`}>Stok: {stk.toFixed(1)} kg</p>}
                      {stk !== null && item.quantity_kg > stk && <p className="text-[11px] text-red-400 font-medium">Qty melebihi stok tersedia!</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[12px] text-muted-foreground">Harga/kg (Rp)</Label>
                      <Input type="number" min={0} className="h-9 bg-secondary border-border/50 text-[13px]" value={item.price_per_kg || ""} onChange={(e) => updateItem(idx, "price_per_kg", Number(e.target.value))} />
                      {hp && <button type="button" className="text-[11px] text-sky-400 hover:underline cursor-pointer" onClick={() => applyHint(idx, hp)}>Harga terakhir: {fmtCurrency.format(hp)}</button>}
                    </div>
                  </div>
                  <div className="text-right text-[13px] text-muted-foreground">Subtotal: <span className="font-medium text-foreground">{fmtCurrency.format(item.quantity_kg * item.price_per_kg)}</span></div>
                </div>
              );
            })}
            <Button variant="outline" className="h-9 text-[13px] w-full" onClick={addItem}><Plus className="w-4 h-4 mr-1.5" />Tambah Item</Button>
          </div>
          <Separator />
          {/* Discount & Tax */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Diskon Order (Rp)</Label>
              <Input type="number" min={0} className="h-9 bg-secondary border-border/50 text-[13px]" value={formDisc || ""} onChange={(e) => setFormDisc(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">PPN (%)</Label>
              <Input type="number" min={0} max={100} className="h-9 bg-secondary border-border/50 text-[13px]" value={formTax || ""} onChange={(e) => setFormTax(Number(e.target.value))} />
            </div>
          </div>
          {/* Payment method */}
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Metode Pembayaran</Label>
            <Select value={formPay} onValueChange={(v) => v !== null && setFormPay(v)}>
              <SelectTrigger className="h-11 bg-secondary border-border/50"><SelectValue>{PAY_METHODS.find((m) => m.value === formPay)?.label ?? formPay}</SelectValue></SelectTrigger>
              <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {/* Due date */}
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Jatuh Tempo (opsional)</Label>
            <Input type="date" className="h-9 bg-secondary border-border/50 text-[13px]" value={formDue} onChange={(e) => setFormDue(e.target.value)} />
          </div>
          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Catatan</Label>
            <Textarea className="min-h-[80px] bg-secondary border-border/50" placeholder="Catatan tambahan..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
          </div>
          {/* Totals */}
          <div className="rounded-lg border border-border/40 bg-secondary/30 p-4 space-y-1.5 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">{fmtCurrency.format(sub)}</span></div>
            {formDisc > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span className="text-red-400">-{fmtCurrency.format(formDisc)}</span></div>}
            {formTax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">PPN ({formTax}%)</span><span className="text-foreground">{fmtCurrency.format(taxAmt)}</span></div>}
            <Separator />
            <div className="flex justify-between pt-1"><span className="font-medium text-foreground">Grand Total</span><span className="text-lg font-bold text-foreground">{fmtCurrency.format(grandT)}</span></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" className="h-9 text-[13px]" onClick={() => setCreateOpen(false)}>Batal</Button>
            <Button className="h-9 bg-[oklch(0.65_0.18_260)] text-white text-[13px] hover:bg-[oklch(0.60_0.20_260)]" onClick={handleCreate} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Order"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* ==== Detail Dialog ==== */}
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border/40">
        <DialogHeader><DialogTitle className="text-foreground">Detail Order {detailOrder ? orderLabel(detailOrder) : ""}</DialogTitle></DialogHeader>
        {detailOrder && (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div><p className="text-muted-foreground">Tanggal</p><p className="font-medium text-foreground">{fmtDate(detailOrder.created_at)}</p></div>
              <div><p className="text-muted-foreground">Pelanggan</p><p className="font-medium text-foreground">{detailOrder.customers?.name ?? "-"}</p></div>
              <div><p className="text-muted-foreground">Metode Bayar</p><p className="font-medium text-foreground">{detailOrder.payment_method}</p></div>
              <div><p className="text-muted-foreground">Status Bayar</p><Badge variant="outline" className={`text-[11px] border-0 ${PAYMENT_STATUS[detailOrder.payment_status]?.color ?? ""}`}>{PAYMENT_STATUS[detailOrder.payment_status]?.label ?? detailOrder.payment_status}</Badge></div>
              {detailOrder.due_date && <div><p className="text-muted-foreground">Jatuh Tempo</p><p className={`font-medium ${isOverdue(detailOrder) ? "text-red-400" : "text-foreground"}`}>{fmtDate(detailOrder.due_date)}{isOverdue(detailOrder) && " (Lewat!)"}</p></div>}
            </div>
            {detailOrder.notes && <div className="text-[13px]"><p className="text-muted-foreground">Catatan</p><p className="text-foreground">{detailOrder.notes}</p></div>}
            <Separator />
            {/* Items table */}
            <div>
              <p className="text-[13px] font-medium text-foreground mb-2">Item</p>
              <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-[12px] text-muted-foreground">Komoditas</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground">Grade</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground text-right">Qty</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground text-right">Harga/kg</TableHead>
                    <TableHead className="text-[12px] text-muted-foreground text-right">Subtotal</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{detailOrder.sales_order_items.map((it, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[13px]">{it.crop_catalog?.name_id ?? "-"}</TableCell>
                      <TableCell className="text-[13px]">{it.grade}</TableCell>
                      <TableCell className="text-[13px] text-right">{it.quantity_kg}</TableCell>
                      <TableCell className="text-[13px] text-right">{fmtCurrency.format(it.price_per_kg)}</TableCell>
                      <TableCell className="text-[13px] text-right font-medium">{fmtCurrency.format(it.subtotal)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
              <div className="mt-3 space-y-1 text-[13px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtCurrency.format(detailOrder.total_amount)}</span></div>
                {(detailOrder.discount_amount ?? 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span className="text-red-400">-{fmtCurrency.format(detailOrder.discount_amount)}</span></div>}
                {(detailOrder.tax_percent ?? 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">PPN ({detailOrder.tax_percent}%)</span><span>{fmtCurrency.format(detailOrder.tax_amount)}</span></div>}
                <Separator />
                <div className="flex justify-between pt-1"><span className="font-medium text-foreground">Grand Total</span><span className="text-lg font-bold text-foreground">{fmtCurrency.format(gt(detailOrder))}</span></div>
              </div>
            </div>
            <Separator />
            {/* Status update */}
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Update Status</Label>
              <div className="flex items-center gap-3">
                <Select value={detailStatus} onValueChange={(v) => v !== null && setDetailStatus(v)}>
                  <SelectTrigger className="h-9 bg-secondary border-border/50 text-[13px] flex-1"><SelectValue>{ORDER_STATUS[detailStatus]?.label ?? detailStatus}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(ORDER_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button className="h-9 bg-[oklch(0.65_0.18_260)] text-white text-[13px] hover:bg-[oklch(0.60_0.20_260)]" onClick={handleStatusUpdate} disabled={updatingStatus || detailStatus === detailOrder.status}>{updatingStatus ? "Menyimpan..." : "Simpan"}</Button>
              </div>
            </div>
            <Separator />
            {/* Payment logs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] text-muted-foreground font-medium">Pembayaran</Label>
                <Button variant="outline" className="h-8 text-[12px]" onClick={() => setPayOpen((p) => !p)}><Plus className="w-3.5 h-3.5 mr-1" />Catat Pembayaran</Button>
              </div>
              {payLogs.length > 0 ? payLogs.map((p) => (
                <div key={p.id} className="rounded-lg border border-border/40 bg-secondary/30 p-2.5 text-[12px]">
                  <p className="text-foreground font-medium">{fmtCurrency.format(p.amount)}</p>
                  <p className="text-muted-foreground">{fmtDate(p.payment_date)} - {p.method ?? "-"}</p>
                  {p.reference && <p className="text-muted-foreground">Ref: {p.reference}</p>}
                  {p.notes && <p className="text-muted-foreground">{p.notes}</p>}
                </div>
              )) : <p className="text-[12px] text-muted-foreground">Belum ada pembayaran.</p>}
              {payOpen && (
                <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[12px] text-muted-foreground">Jumlah (Rp)</Label>
                      <Input type="number" min={0} className="h-9 bg-secondary border-border/50 text-[13px]" value={payAmt || ""} onChange={(e) => setPayAmt(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[12px] text-muted-foreground">Metode</Label>
                      <Select value={payMeth} onValueChange={(v) => v !== null && setPayMeth(v)}>
                        <SelectTrigger className="h-9 bg-secondary border-border/50 text-[13px]"><SelectValue>{payMeth}</SelectValue></SelectTrigger>
                        <SelectContent><SelectItem value="tunai">Tunai</SelectItem><SelectItem value="transfer">Transfer</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1"><Label className="text-[12px] text-muted-foreground">Referensi</Label><Input className="h-9 bg-secondary border-border/50 text-[13px]" placeholder="No. transfer / kuitansi" value={payRef} onChange={(e) => setPayRef(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-[12px] text-muted-foreground">Catatan</Label><Input className="h-9 bg-secondary border-border/50 text-[13px]" placeholder="Catatan pembayaran" value={payNote} onChange={(e) => setPayNote(e.target.value)} /></div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" className="h-8 text-[12px]" onClick={() => setPayOpen(false)}>Batal</Button>
                    <Button className="h-8 bg-[oklch(0.65_0.18_260)] text-white text-[12px] hover:bg-[oklch(0.60_0.20_260)]" onClick={handleSavePay} disabled={savingPay}>{savingPay ? "Menyimpan..." : "Simpan"}</Button>
                  </div>
                </div>
              )}
            </div>
            <Separator />
            <Button variant="outline" className="h-9 text-[13px] w-full" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1.5" />Cetak Invoice</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* ==== Print Invoice ==== */}
    {detailOrder && (
      <div id="print-invoice">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>PLANT FACTORY &mdash; SARC UGM</h1>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "4px 0 0" }}>INVOICE</h2>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 13 }}>
          <div>
            <p style={{ margin: "2px 0" }}><strong>No. Invoice:</strong> {orderLabel(detailOrder)}</p>
            <p style={{ margin: "2px 0" }}><strong>Tanggal:</strong> {fmtDate(detailOrder.created_at)}</p>
            {detailOrder.due_date && <p style={{ margin: "2px 0" }}><strong>Jatuh Tempo:</strong> {fmtDate(detailOrder.due_date)}</p>}
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: "2px 0" }}><strong>Pelanggan:</strong> {detailOrder.customers?.name ?? "-"}</p>
            {detailOrder.customers?.phone && <p style={{ margin: "2px 0" }}><strong>Telp:</strong> {detailOrder.customers.phone}</p>}
            {detailOrder.customers?.address && <p style={{ margin: "2px 0" }}><strong>Alamat:</strong> {detailOrder.customers.address}</p>}
          </div>
        </div>
        <table>
          <thead><tr><th>No</th><th>Komoditas</th><th>Grade</th><th className="tr">Qty (kg)</th><th className="tr">Harga/kg</th><th className="tr">Subtotal</th></tr></thead>
          <tbody>{detailOrder.sales_order_items.map((it, i) => (
            <tr key={i}><td>{i + 1}</td><td>{it.crop_catalog?.name_id ?? "-"}</td><td>{it.grade}</td><td className="tr">{it.quantity_kg}</td><td className="tr">{fmtCurrency.format(it.price_per_kg)}</td><td className="tr">{fmtCurrency.format(it.subtotal)}</td></tr>
          ))}</tbody>
        </table>
        <div style={{ marginTop: 16, textAlign: "right", fontSize: 13 }}>
          <p style={{ margin: "4px 0" }}>Subtotal: {fmtCurrency.format(detailOrder.total_amount)}</p>
          {(detailOrder.discount_amount ?? 0) > 0 && <p style={{ margin: "4px 0" }}>Diskon: -{fmtCurrency.format(detailOrder.discount_amount)}</p>}
          {(detailOrder.tax_percent ?? 0) > 0 && <p style={{ margin: "4px 0" }}>PPN ({detailOrder.tax_percent}%): {fmtCurrency.format(detailOrder.tax_amount)}</p>}
          <p style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 700 }}>Grand Total: {fmtCurrency.format(gt(detailOrder))}</p>
        </div>
        <div style={{ marginTop: 24, fontSize: 12, borderTop: "1px solid #ccc", paddingTop: 12 }}>
          <p style={{ margin: "2px 0" }}><strong>Metode Pembayaran:</strong> {detailOrder.payment_method ?? "-"}</p>
          <p style={{ margin: "2px 0" }}><strong>Status:</strong> {PAYMENT_STATUS[detailOrder.payment_status]?.label ?? detailOrder.payment_status}</p>
        </div>
      </div>
    )}
  </>);
}
