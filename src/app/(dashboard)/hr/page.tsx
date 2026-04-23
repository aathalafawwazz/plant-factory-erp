"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Search, Users, Pencil } from "lucide-react";
import type { Profile, EmployeeDetail } from "@/lib/types/database";
import { translateJobTitle } from "@/lib/translate-helpers";

type AttendanceRow = {
  id: number;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number;
  status: string;
};

const CONTRACT_TYPES = [
  { value: "tetap", labelKey: "hr.contract_tetap" },
  { value: "kontrak", labelKey: "hr.contract_kontrak" },
  { value: "magang", labelKey: "hr.contract_magang" },
  { value: "paruh_waktu", labelKey: "hr.contract_paruh" },
];

type SortField = "display_name" | "position" | "department";
type SortDir = "asc" | "desc";

export default function HRDashboardPage() {
  const supabase = createClient();
  const { t, lang } = useLang();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetail[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("display_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Profile dialog state
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editNik, setEditNik] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editContractType, setEditContractType] = useState("");
  const [editJoinDate, setEditJoinDate] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editSalary, setEditSalary] = useState("");

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    const [profRes, empRes, attRes] = await Promise.all([
      supabase.from("profiles").select("*").order("display_name"),
      supabase.from("employee_details").select("*"),
      supabase.from("attendance_logs").select("*").eq("date", today),
    ]);
    setProfiles(profRes.data ?? []);
    setEmployeeDetails(empRes.data ?? []);
    setTodayAttendance(attRes.data ?? []);
    setLoading(false);
  }

  function getDetail(userId: string): EmployeeDetail | undefined {
    return employeeDetails.find((d) => d.user_id === userId);
  }

  function getAttendance(userId: string): AttendanceRow | undefined {
    return todayAttendance.find((a) => a.user_id === userId);
  }

  // Summary computations
  const totalEmployees = profiles.length;
  const presentToday = todayAttendance.filter(
    (a) => a.status === "hadir" && a.clock_in
  ).length;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const avgWorkHours =
    todayAttendance.length > 0
      ? (
          todayAttendance.reduce((sum, a) => sum + a.total_hours, 0) /
          todayAttendance.length
        ).toFixed(1)
      : "0";

  const totalSalary = employeeDetails.reduce(
    (sum, d) => sum + (d.base_salary ?? 0),
    0
  );

  // Filtered + sorted list
  const filteredProfiles = profiles
    .filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const detail = getDetail(p.id);
      return (
        p.display_name.toLowerCase().includes(q) ||
        (detail?.position ?? "").toLowerCase().includes(q) ||
        (detail?.department ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let valA = "";
      let valB = "";
      if (sortField === "display_name") {
        valA = a.display_name;
        valB = b.display_name;
      } else {
        const dA = getDetail(a.id);
        const dB = getDetail(b.id);
        valA = (dA?.[sortField] ?? "") as string;
        valB = (dB?.[sortField] ?? "") as string;
      }
      const cmp = valA.localeCompare(valB);
      return sortDir === "asc" ? cmp : -cmp;
    });

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function openProfile(profile: Profile) {
    setSelectedProfile(profile);
    const detail = getDetail(profile.id);
    setEditName(profile.display_name);
    setEditNik(detail?.nik ?? "");
    setEditPosition(detail?.position ?? "");
    setEditDepartment(detail?.department ?? "");
    setEditContractType(detail?.contract_type ?? "");
    setEditJoinDate(detail?.join_date ?? "");
    setEditPhone(detail?.phone ?? "");
    setEditAddress(detail?.address ?? "");
    setEditSalary(detail?.base_salary?.toString() ?? "0");
    setEditing(false);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!selectedProfile) return;
    setSaving(true);

    try {
      // Update profile display_name
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ display_name: editName })
        .eq("id", selectedProfile.id);

      if (profErr) throw profErr;

      // Upsert employee_details
      const detail = getDetail(selectedProfile.id);
      const payload = {
        user_id: selectedProfile.id,
        nik: editNik || null,
        position: editPosition || null,
        department: editDepartment || null,
        contract_type: editContractType || null,
        join_date: editJoinDate || null,
        phone: editPhone || null,
        address: editAddress || null,
        base_salary: parseFloat(editSalary) || 0,
      };

      if (detail) {
        const { error: empErr } = await supabase
          .from("employee_details")
          .update(payload)
          .eq("id", detail.id);
        if (empErr) throw empErr;
      } else {
        const { error: empErr } = await supabase
          .from("employee_details")
          .insert(payload);
        if (empErr) throw empErr;
      }

      toast.success(t("hr.employee_saved"));
      setEditing(false);
      await loadData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("common.save_failed");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        {t("common.loading_data")}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground mb-4">
        {t("hr.title")}
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[12px] mb-1">
            <Users className="size-4" />
            {t("hr.total_employees")}
          </div>
          <div className="text-2xl font-semibold">{totalEmployees}</div>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <div className="text-muted-foreground text-[12px] mb-1">
            {t("hr.present_today")}
          </div>
          <div className="text-2xl font-semibold">
            {presentToday}
            <span className="text-sm text-muted-foreground font-normal ml-1">
              / {totalEmployees}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <div className="text-muted-foreground text-[12px] mb-1">
            {t("hr.avg_work_hours")}
          </div>
          <div className="text-2xl font-semibold">
            {avgWorkHours}
            <span className="text-sm text-muted-foreground font-normal ml-1">
              {t("hr.hours_unit")}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <div className="text-muted-foreground text-[12px] mb-1">
            {t("hr.total_salary_month")}
          </div>
          <div className="text-2xl font-semibold text-[16px]">
            {formatCurrency(totalSalary)}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("hr.search_employees")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 bg-secondary border-border/50 text-[12px]"
          />
        </div>
      </div>

      {/* Employee Table */}
      <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="text-[12px] text-muted-foreground cursor-pointer select-none"
                onClick={() => handleSort("display_name")}
              >
                {t("hr.name")}{" "}
                {sortField === "display_name"
                  ? sortDir === "asc"
                    ? "\u2191"
                    : "\u2193"
                  : ""}
              </TableHead>
              <TableHead
                className="text-[12px] text-muted-foreground cursor-pointer select-none"
                onClick={() => handleSort("position")}
              >
                {t("hr.job_title")}{" "}
                {sortField === "position"
                  ? sortDir === "asc"
                    ? "\u2191"
                    : "\u2193"
                  : ""}
              </TableHead>
              <TableHead
                className="text-[12px] text-muted-foreground cursor-pointer select-none"
                onClick={() => handleSort("department")}
              >
                {t("hr.department")}{" "}
                {sortField === "department"
                  ? sortDir === "asc"
                    ? "\u2191"
                    : "\u2193"
                  : ""}
              </TableHead>
              <TableHead className="text-[12px] text-muted-foreground">
                {t("hr.status_today")}
              </TableHead>
              <TableHead className="text-[12px] text-muted-foreground">
                {t("hr.work_hours_today")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProfiles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  {t("hr.no_employees")}
                </TableCell>
              </TableRow>
            ) : (
              filteredProfiles.map((p) => {
                const detail = getDetail(p.id);
                const att = getAttendance(p.id);
                const isPresent = att?.status === "hadir" && att?.clock_in;
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openProfile(p)}
                  >
                    <TableCell className="text-[13px] font-medium">
                      {p.display_name}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {detail?.position ? translateJobTitle(detail.position, lang) : "-"}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {detail?.department ?? "-"}
                    </TableCell>
                    <TableCell>
                      {isPresent ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[11px]">
                          {t("hr.present")}
                        </Badge>
                      ) : (
                        <Badge className="bg-zinc-500/20 text-zinc-400 border-0 text-[11px]">
                          {t("hr.not_yet")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {att?.total_hours
                        ? `${att.total_hours.toFixed(1)} ${t("hr.hours_unit")}`
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Profile Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="sm:max-w-[480px] bg-card border-border/50 p-0 gap-0"
          showCloseButton={true}
        >
          {selectedProfile && (
            <>
              <DialogHeader className="p-4 pb-0">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-secondary flex items-center justify-center text-lg font-semibold text-muted-foreground">
                    {selectedProfile.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    {editing ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-9 bg-secondary border-border/50 text-[12px] font-semibold"
                      />
                    ) : (
                      <DialogTitle>{selectedProfile.display_name}</DialogTitle>
                    )}
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      {getDetail(selectedProfile.id)?.position
                        ? translateJobTitle(getDetail(selectedProfile.id)!.position!, lang)
                        : t("hr.not_filled")}
                    </div>
                  </div>
                  {!editing && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                </div>
              </DialogHeader>

              <Separator className="my-3" />

              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      {t("hr.nik")}
                    </Label>
                    {editing ? (
                      <Input
                        value={editNik}
                        onChange={(e) => setEditNik(e.target.value)}
                        className="h-9 bg-secondary border-border/50 text-[12px]"
                      />
                    ) : (
                      <div className="text-[13px]">
                        {getDetail(selectedProfile.id)?.nik ?? "-"}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      {t("hr.job_title")}
                    </Label>
                    {editing ? (
                      <Input
                        value={editPosition}
                        onChange={(e) => setEditPosition(e.target.value)}
                        className="h-9 bg-secondary border-border/50 text-[12px]"
                      />
                    ) : (
                      <div className="text-[13px]">
                        {getDetail(selectedProfile.id)?.position
                          ? translateJobTitle(getDetail(selectedProfile.id)!.position!, lang)
                          : "-"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      {t("hr.department")}
                    </Label>
                    {editing ? (
                      <Input
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        className="h-9 bg-secondary border-border/50 text-[12px]"
                      />
                    ) : (
                      <div className="text-[13px]">
                        {getDetail(selectedProfile.id)?.department ?? "-"}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      {t("hr.contract_type")}
                    </Label>
                    {editing ? (
                      <Select
                        value={editContractType}
                        onValueChange={(v) =>
                          v !== null && setEditContractType(v)
                        }
                      >
                        <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-full">
                          <SelectValue>
                            {t(CONTRACT_TYPES.find(
                              (c) => c.value === editContractType
                            )?.labelKey ?? "") || t("hr.select_contract")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {CONTRACT_TYPES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {t(c.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-[13px]">
                        {t(CONTRACT_TYPES.find(
                          (c) =>
                            c.value ===
                            getDetail(selectedProfile.id)?.contract_type
                        )?.labelKey ?? "") || "-"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      {t("hr.join_date")}
                    </Label>
                    {editing ? (
                      <Input
                        type="date"
                        value={editJoinDate}
                        onChange={(e) => setEditJoinDate(e.target.value)}
                        className="h-9 bg-secondary border-border/50 text-[12px]"
                      />
                    ) : (
                      <div className="text-[13px]">
                        {getDetail(selectedProfile.id)?.join_date ?? "-"}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      {t("hr.phone")}
                    </Label>
                    {editing ? (
                      <Input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="h-9 bg-secondary border-border/50 text-[12px]"
                      />
                    ) : (
                      <div className="text-[13px]">
                        {getDetail(selectedProfile.id)?.phone ?? "-"}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    {t("hr.address")}
                  </Label>
                  {editing ? (
                    <Input
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="h-9 bg-secondary border-border/50 text-[12px]"
                    />
                  ) : (
                    <div className="text-[13px]">
                      {getDetail(selectedProfile.id)?.address ?? "-"}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    {t("hr.base_salary")}
                  </Label>
                  {editing ? (
                    <Input
                      type="number"
                      value={editSalary}
                      onChange={(e) => setEditSalary(e.target.value)}
                      className="h-9 bg-secondary border-border/50 text-[12px]"
                    />
                  ) : (
                    <div className="text-[13px]">
                      {formatCurrency(
                        getDetail(selectedProfile.id)?.base_salary ?? 0
                      )}
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="ghost"
                      className="h-9 text-[12px]"
                      onClick={() => setEditing(false)}
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
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
