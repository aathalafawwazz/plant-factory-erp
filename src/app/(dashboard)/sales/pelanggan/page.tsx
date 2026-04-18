"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
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
  List,
  LayoutGrid,
  Plus,
  Pencil,
  Users,
  MessageCircle,
} from "lucide-react";
import type { Customer } from "@/lib/types/database";

const CUSTOMER_TYPES = [
  { value: "restoran", label: "Restoran" },
  { value: "retail", label: "Retail" },
  { value: "distributor", label: "Distributor" },
  { value: "individu", label: "Individu" },
];

const TYPE_COLORS: Record<string, string> = {
  restoran: "bg-amber-500/20 text-amber-400",
  retail: "bg-sky-500/20 text-sky-400",
  distributor: "bg-purple-500/20 text-purple-400",
  individu: "bg-emerald-500/20 text-emerald-400",
};

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Menunggu", color: "bg-amber-500/20 text-amber-400" },
  confirmed: { label: "Dikonfirmasi", color: "bg-sky-500/20 text-sky-400" },
  delivered: { label: "Dikirim", color: "bg-emerald-500/20 text-emerald-400" },
  paid: { label: "Lunas", color: "bg-green-500/20 text-green-400" },
  cancelled: { label: "Dibatalkan", color: "bg-red-500/20 text-red-400" },
};

type CustomerOrder = {
  id: number;
  order_date: string;
  status: string;
  grand_total: number;
  created_at: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

type SortOption = "name_asc" | "newest" | "type";
type ViewMode = "list" | "grid";

export default function PelangganPage() {
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("name_asc");
  const [view, setView] = useState<ViewMode>("list");

  // Detail dialog
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // Customer orders in detail
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Add/Edit form state
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("restoran");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCustomers() {
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    setCustomers(data ?? []);
    setLoading(false);
  }

  const loadCustomerOrders = useCallback(
    async (customerId: number) => {
      setLoadingOrders(true);
      const { data } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20);
      setCustomerOrders((data as CustomerOrder[] | null) ?? []);
      setLoadingOrders(false);
    },
    [supabase]
  );

  const filtered = useMemo(() => {
    let result = [...customers];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.type ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
      );
    }

    // Sort
    if (sort === "name_asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sort === "type") {
      result.sort((a, b) => (a.type ?? "").localeCompare(b.type ?? ""));
    }

    return result;
  }, [customers, search, sort]);

  function resetForm() {
    setFormName("");
    setFormType("restoran");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormNotes("");
  }

  function openAddForm() {
    resetForm();
    setEditing(false);
    setFormOpen(true);
  }

  function openEditForm(customer: Customer) {
    setFormName(customer.name);
    setFormType(customer.type ?? "restoran");
    setFormPhone(customer.phone ?? "");
    setFormEmail(customer.email ?? "");
    setFormAddress(customer.address ?? "");
    setFormNotes(customer.notes ?? "");
    setSelectedCustomer(customer);
    setEditing(true);
    setFormOpen(true);
  }

  function openDetail(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomerOrders([]);
    setDetailOpen(true);
    loadCustomerOrders(customer.id);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("Nama pelanggan wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        type: formType,
        phone: formPhone || null,
        email: formEmail || null,
        address: formAddress || null,
        notes: formNotes || null,
      };

      if (editing && selectedCustomer) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", selectedCustomer.id);
        if (error) throw error;
        toast.success("Pelanggan berhasil diperbarui");
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
        toast.success("Pelanggan berhasil ditambahkan");
      }

      setFormOpen(false);
      setDetailOpen(false);
      resetForm();
      await loadCustomers();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan data";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  // Customer order stats
  const paidDeliveredOrders = customerOrders.filter(
    (o) => o.status === "paid" || o.status === "delivered"
  );
  const totalSpending = paidDeliveredOrders.reduce(
    (sum, o) => sum + (o.grand_total ?? 0),
    0
  );
  const totalOrderCount = customerOrders.length;
  const recentOrders = customerOrders.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Memuat data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Pelanggan</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Kelola data pelanggan
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 bg-[oklch(0.65_0.18_260)] hover:bg-[oklch(0.60_0.20_260)] text-white text-[13px]"
          onClick={openAddForm}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Tambah Pelanggan
        </Button>
      </div>

      {/* Search + Sort + View Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, tipe, telepon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 bg-secondary border-border/50 text-[12px]"
          />
        </div>
        <Select
          value={sort}
          onValueChange={(v) => v !== null && setSort(v as SortOption)}
        >
          <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-auto min-w-[140px]">
            <ArrowUpDown className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue>
              {sort === "name_asc"
                ? "Nama A-Z"
                : sort === "newest"
                  ? "Terbaru"
                  : "Tipe"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Nama A-Z</SelectItem>
            <SelectItem value="newest">Terbaru</SelectItem>
            <SelectItem value="type">Tipe</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border border-border/50 overflow-hidden">
          <button
            className={`p-2 ${view === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50"}`}
            onClick={() => setView("list")}
          >
            <List className="size-4" />
          </button>
          <button
            className={`p-2 ${view === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50"}`}
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="size-10 mb-3 opacity-40" />
          <p className="text-[13px]">Tidak ada pelanggan ditemukan.</p>
        </div>
      ) : view === "list" ? (
        /* Table View */
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">
                  Nama
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  Tipe
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  Telepon
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  Email
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  Alamat
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  Catatan
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const typeColor =
                  TYPE_COLORS[c.type ?? ""] ?? "bg-zinc-500/20 text-zinc-400";
                const typeLabel =
                  CUSTOMER_TYPES.find((t) => t.value === c.type)?.label ??
                  c.type ??
                  "-";
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(c)}
                  >
                    <TableCell className="text-[13px] font-medium">
                      {c.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${typeColor} border-0 text-[11px]`}
                      >
                        {typeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {c.phone ?? "-"}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {c.email ?? "-"}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground max-w-[200px] truncate">
                      {c.address ?? "-"}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground max-w-[150px] truncate">
                      {c.notes ?? "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const typeColor =
              TYPE_COLORS[c.type ?? ""] ?? "bg-zinc-500/20 text-zinc-400";
            const typeLabel =
              CUSTOMER_TYPES.find((t) => t.value === c.type)?.label ??
              c.type ??
              "-";
            return (
              <div
                key={c.id}
                className="rounded-lg border border-border/40 bg-card p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => openDetail(c)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium text-foreground">
                    {c.name}
                  </span>
                  <Badge
                    className={`${typeColor} border-0 text-[11px]`}
                  >
                    {typeLabel}
                  </Badge>
                </div>
                <div className="space-y-1 text-[12px] text-muted-foreground">
                  {c.phone && <div>{c.phone}</div>}
                  {c.email && <div>{c.email}</div>}
                  {c.address && (
                    <div className="truncate">{c.address}</div>
                  )}
                  {c.notes && (
                    <div className="truncate italic mt-1">{c.notes}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent
          className="sm:max-w-[520px] bg-card border-border/50 p-0 gap-0 max-h-[85vh] overflow-y-auto"
          showCloseButton={true}
        >
          {selectedCustomer && (
            <>
              <DialogHeader className="p-4 pb-0">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-secondary flex items-center justify-center text-lg font-semibold text-muted-foreground">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <DialogTitle>{selectedCustomer.name}</DialogTitle>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        className={`${TYPE_COLORS[selectedCustomer.type ?? ""] ?? "bg-zinc-500/20 text-zinc-400"} border-0 text-[11px]`}
                      >
                        {CUSTOMER_TYPES.find(
                          (t) => t.value === selectedCustomer.type
                        )?.label ??
                          selectedCustomer.type ??
                          "-"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedCustomer.phone && (
                      <a
                        href={`https://wa.me/${selectedCustomer.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                        >
                          <MessageCircle className="size-4" />
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setDetailOpen(false);
                        openEditForm(selectedCustomer);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <Separator className="my-3" />

              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      Telepon
                    </Label>
                    <div className="text-[13px]">
                      {selectedCustomer.phone ?? "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      Email
                    </Label>
                    <div className="text-[13px]">
                      {selectedCustomer.email ?? "-"}
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    Alamat
                  </Label>
                  <div className="text-[13px]">
                    {selectedCustomer.address ?? "-"}
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    Catatan
                  </Label>
                  <div className="text-[13px]">
                    {selectedCustomer.notes ?? "-"}
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    Ditambahkan
                  </Label>
                  <div className="text-[13px]">
                    {new Date(selectedCustomer.created_at).toLocaleDateString(
                      "id-ID",
                      {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      }
                    )}
                  </div>
                </div>

                <Separator />

                {/* Order History Section */}
                <div>
                  <h4 className="text-[13px] font-semibold text-foreground mb-3">
                    Riwayat Order
                  </h4>

                  {loadingOrders ? (
                    <p className="text-[12px] text-muted-foreground">
                      Memuat riwayat order...
                    </p>
                  ) : (
                    <>
                      {/* Order Stats */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="rounded-lg border border-border/30 bg-secondary/50 p-3">
                          <p className="text-[11px] text-muted-foreground">
                            Total Spending
                          </p>
                          <p className="text-[14px] font-semibold mt-0.5">
                            {formatCurrency(totalSpending)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border/30 bg-secondary/50 p-3">
                          <p className="text-[11px] text-muted-foreground">
                            Jumlah Order
                          </p>
                          <p className="text-[14px] font-semibold mt-0.5">
                            {totalOrderCount}
                          </p>
                        </div>
                      </div>

                      {/* Last 5 Orders */}
                      {recentOrders.length > 0 ? (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-2">
                            Order Terakhir
                          </p>
                          <div className="space-y-1">
                            {recentOrders.map((order) => {
                              const statusInfo = ORDER_STATUS[order.status] ?? {
                                label: order.status,
                                color: "bg-zinc-500/20 text-zinc-400",
                              };
                              return (
                                <div
                                  key={order.id}
                                  className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0"
                                >
                                  <span className="text-[12px] text-muted-foreground">
                                    {new Date(
                                      order.order_date
                                    ).toLocaleDateString("id-ID", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-medium">
                                      {formatCurrency(order.grand_total)}
                                    </span>
                                    <Badge
                                      className={`${statusInfo.color} border-0 text-[10px]`}
                                    >
                                      {statusInfo.label}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[12px] text-muted-foreground">
                          Belum ada order.
                        </p>
                      )}
                    </>
                  )}
                </div>

                <Separator />

                {/* Pricing Note */}
                <p className="text-[11px] text-muted-foreground italic">
                  Diskon khusus dan harga spesial dapat diatur per order.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          className="sm:max-w-[480px] bg-card border-border/50 p-0 gap-0"
          showCloseButton={true}
        >
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>
              {editing ? "Edit Pelanggan" : "Tambah Pelanggan"}
            </DialogTitle>
          </DialogHeader>

          <Separator className="my-3" />

          <div className="px-4 pb-4 space-y-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Nama <span className="text-red-400">*</span>
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nama pelanggan"
                className="h-9 bg-secondary border-border/50 text-[12px]"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Tipe</Label>
              <Select
                value={formType}
                onValueChange={(v) => v !== null && setFormType(v)}
              >
                <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-full">
                  <SelectValue>
                    {CUSTOMER_TYPES.find((t) => t.value === formType)?.label ??
                      "Pilih tipe"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Telepon
                </Label>
                <Input
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="08..."
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Email
                </Label>
                <Input
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@contoh.com"
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Alamat
              </Label>
              <Textarea
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Alamat lengkap"
                className="bg-secondary border-border/50 text-[12px] min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Catatan
              </Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Catatan tambahan"
                className="bg-secondary border-border/50 text-[12px] min-h-[60px]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                className="h-9 text-[12px]"
                onClick={() => setFormOpen(false)}
              >
                Batal
              </Button>
              <Button
                className="h-9 bg-[oklch(0.65_0.18_260)] text-white text-[12px] hover:bg-[oklch(0.60_0.20_260)]"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
