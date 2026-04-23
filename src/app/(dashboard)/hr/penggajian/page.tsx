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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Wallet, Download, RefreshCw } from "lucide-react";
import type { Profile, EmployeeDetail, PayrollRecord } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PayrollRow extends PayrollRecord {
  displayName: string;
  position: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MONTH_KEYS = [
  "month.jan",
  "month.feb",
  "month.mar",
  "month.apr",
  "month.may",
  "month.jun",
  "month.jul",
  "month.aug",
  "month.sep",
  "month.oct",
  "month.nov",
  "month.dec",
];

const STANDARD_MONTHLY_HOURS = 173;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmtCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(
    amount
  );

function statusBadge(status: string, t: (key: string) => string) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 hover:bg-sky-500/30">
          {t("pay.status_approved")}
        </Badge>
      );
    case "paid":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">
          {t("pay.status_paid")}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{t("pay.status_draft")}</Badge>;
  }
}

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

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function PenggajianPage() {
  const supabase = createClient();
  const { t } = useLang();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Edit dialog state
  const [editRow, setEditRow] = useState<PayrollRow | null>(null);
  const [editOvertimePay, setEditOvertimePay] = useState(0);
  const [editAllowances, setEditAllowances] = useState(0);
  const [editDeductions, setEditDeductions] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("draft");
  const [saving, setSaving] = useState(false);

  // Available years for dropdown
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  useEffect(() => {
    loadPayroll();
  }, [selectedMonth, selectedYear]);

  /* ---------------------------------------------------------------- */
  /*  Load payroll data                                                */
  /* ---------------------------------------------------------------- */

  async function loadPayroll() {
    setLoading(true);

    const { data: records } = await supabase
      .from("payroll_records")
      .select("*")
      .eq("period_month", selectedMonth)
      .eq("period_year", selectedYear)
      .order("created_at", { ascending: true });

    if (!records || records.length === 0) {
      setPayrollRows([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for display names
    const userIds = [...new Set(records.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    const { data: empDetails } = await supabase
      .from("employee_details")
      .select("*")
      .in("user_id", userIds);

    const profileMap = new Map<string, Profile>();
    if (profiles) {
      for (const p of profiles) profileMap.set(p.id, p);
    }
    const empMap = new Map<string, EmployeeDetail>();
    if (empDetails) {
      for (const e of empDetails) empMap.set(e.user_id, e);
    }

    const rows: PayrollRow[] = records.map((r) => ({
      ...r,
      displayName: profileMap.get(r.user_id)?.display_name || r.user_id.slice(0, 8),
      position: empMap.get(r.user_id)?.position || null,
    }));

    setPayrollRows(rows);
    setLoading(false);
  }

  /* ---------------------------------------------------------------- */
  /*  Generate payroll                                                 */
  /* ---------------------------------------------------------------- */

  async function generatePayroll() {
    setGenerating(true);

    // Fetch all employees with details
    const { data: empDetails } = await supabase
      .from("employee_details")
      .select("*");

    if (!empDetails || empDetails.length === 0) {
      toast.error(t("pay.no_employees"));
      setGenerating(false);
      return;
    }

    // Fetch existing records for this period
    const { data: existing } = await supabase
      .from("payroll_records")
      .select("user_id")
      .eq("period_month", selectedMonth)
      .eq("period_year", selectedYear);

    const existingUserIds = new Set(existing?.map((e) => e.user_id) || []);

    // Calculate date range for the period
    const startDate = new Date(selectedYear, selectedMonth - 1, 1)
      .toISOString()
      .slice(0, 10);
    const endDate = new Date(selectedYear, selectedMonth, 0)
      .toISOString()
      .slice(0, 10);

    // Fetch attendance logs for this period
    const { data: attendanceLogs } = await supabase
      .from("attendance_logs")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate);

    // Sum overtime hours per user
    const overtimeByUser = new Map<string, number>();
    if (attendanceLogs) {
      for (const log of attendanceLogs) {
        const current = overtimeByUser.get(log.user_id) || 0;
        overtimeByUser.set(log.user_id, current + (log.overtime_hours || 0));
      }
    }

    // Create payroll records for employees not yet having one
    const inserts: {
      user_id: string;
      period_month: number;
      period_year: number;
      base_salary: number;
      overtime_pay: number;
      allowances: number;
      deductions: number;
      total: number;
      status: string;
    }[] = [];

    for (const emp of empDetails) {
      if (existingUserIds.has(emp.user_id)) continue;

      const baseSalary = emp.base_salary || 0;
      const overtimeHours = overtimeByUser.get(emp.user_id) || 0;
      const overtimePay = Math.round(
        overtimeHours * (baseSalary / STANDARD_MONTHLY_HOURS)
      );
      const total = baseSalary + overtimePay;

      inserts.push({
        user_id: emp.user_id,
        period_month: selectedMonth,
        period_year: selectedYear,
        base_salary: baseSalary,
        overtime_pay: overtimePay,
        allowances: 0,
        deductions: 0,
        total,
        status: "draft",
      });
    }

    if (inserts.length === 0) {
      toast.info(t("pay.all_have_records"));
      setGenerating(false);
      return;
    }

    const { error } = await supabase.from("payroll_records").insert(inserts);
    if (error) {
      toast.error(t("pay.generate_failed") + ": " + error.message);
    } else {
      toast.success(
        `${t("pay.generate_success")} ${inserts.length} ${t("pay.records")}`
      );
      await loadPayroll();
    }

    setGenerating(false);
  }

  /* ---------------------------------------------------------------- */
  /*  Edit dialog                                                      */
  /* ---------------------------------------------------------------- */

  function openEdit(row: PayrollRow) {
    setEditRow(row);
    setEditOvertimePay(row.overtime_pay);
    setEditAllowances(row.allowances);
    setEditDeductions(row.deductions);
    setEditNotes(row.notes || "");
    setEditStatus(row.status);
  }

  const editTotal = editRow
    ? editRow.base_salary + editOvertimePay + editAllowances - editDeductions
    : 0;

  async function saveEdit() {
    if (!editRow) return;
    setSaving(true);

    const { error } = await supabase
      .from("payroll_records")
      .update({
        overtime_pay: editOvertimePay,
        allowances: editAllowances,
        deductions: editDeductions,
        total: editTotal,
        status: editStatus,
        notes: editNotes || null,
      })
      .eq("id", editRow.id);

    if (error) {
      toast.error(t("pay.save_failed") + ": " + error.message);
    } else {
      toast.success(t("pay.update_success"));
      setEditRow(null);
      await loadPayroll();
    }
    setSaving(false);
  }

  /* ---------------------------------------------------------------- */
  /*  Export CSV                                                        */
  /* ---------------------------------------------------------------- */

  function exportCSV() {
    const rows = payrollRows.map((r) => ({
      [t("pay.name")]: r.displayName,
      [t("pay.position")]: r.position || "-",
      [t("pay.base_salary")]: r.base_salary,
      [t("pay.overtime")]: r.overtime_pay,
      [t("pay.allowances")]: r.allowances,
      [t("pay.deductions")]: r.deductions,
      [t("pay.total")]: r.total,
      [t("pay.status")]: r.status,
      [t("pay.notes")]: r.notes || "",
    }));
    downloadCSV(
      rows,
      `payroll-${t(MONTH_KEYS[selectedMonth - 1])}-${selectedYear}.csv`
    );
    toast.success(t("pay.csv_exported"));
  }

  /* ---------------------------------------------------------------- */
  /*  Summary calculations                                             */
  /* ---------------------------------------------------------------- */

  const totalExpenditure = payrollRows.reduce((s, r) => s + r.total, 0);
  const avgSalary =
    payrollRows.length > 0 ? totalExpenditure / payrollRows.length : 0;
  const paidCount = payrollRows.filter((r) => r.status === "paid").length;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">{t("pay.title")}</h1>

      {/* Period selectors + actions */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-[13px] text-muted-foreground">{t("pay.month")}</Label>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => v !== null && setSelectedMonth(Number(v))}
          >
            <SelectTrigger className="w-[140px] h-9 bg-secondary border-border/50 text-[13px]">
              <SelectValue>{t(MONTH_KEYS[selectedMonth - 1])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MONTH_KEYS.map((key, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {t(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] text-muted-foreground">{t("pay.year")}</Label>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => v !== null && setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-[100px] h-9 bg-secondary border-border/50 text-[13px]">
              <SelectValue>{selectedYear}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="h-9 bg-primary text-white text-[13px] hover:bg-primary/90"
          onClick={generatePayroll}
          disabled={generating}
        >
          <RefreshCw
            className={`w-4 h-4 mr-1.5 ${generating ? "animate-spin" : ""}`}
          />
          {generating ? t("pay.processing") : t("pay.generate")}
        </Button>
        <Button
          variant="outline"
          className="h-9 text-[13px]"
          onClick={exportCSV}
          disabled={payrollRows.length === 0}
        >
          <Download className="w-4 h-4 mr-1.5" />
          {t("pay.export_csv")}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("pay.total_expenditure")}</p>
            <p className="text-xl font-bold mt-1 text-foreground">
              {fmtCurrency(totalExpenditure)}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("pay.avg_salary")}</p>
            <p className="text-xl font-bold mt-1 text-foreground">
              {fmtCurrency(avgSalary)}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("pay.paid_employees")}</p>
            <p className="text-xl font-bold mt-1 text-foreground">
              {paidCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                / {payrollRows.length}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll table */}
      {loading ? (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("pay.loading")}
          </CardContent>
        </Card>
      ) : payrollRows.length === 0 ? (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="py-16 text-center">
            <Wallet className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("pay.no_data")} {t(MONTH_KEYS[selectedMonth - 1])}{" "}
              {selectedYear}.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("pay.click_generate")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("pay.name")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("pay.position")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground text-right">
                  {t("pay.base_salary")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground text-right">
                  {t("pay.overtime")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground text-right">
                  {t("pay.allowances")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground text-right">
                  {t("pay.deductions")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground text-right">
                  {t("pay.total")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("pay.status")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-secondary/50"
                  onClick={() => openEdit(row)}
                >
                  <TableCell className="text-[13px] font-medium">
                    {row.displayName}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {row.position || "-"}
                  </TableCell>
                  <TableCell className="text-[13px] text-right">
                    {fmtCurrency(row.base_salary)}
                  </TableCell>
                  <TableCell className="text-[13px] text-right">
                    {fmtCurrency(row.overtime_pay)}
                  </TableCell>
                  <TableCell className="text-[13px] text-right">
                    {fmtCurrency(row.allowances)}
                  </TableCell>
                  <TableCell className="text-[13px] text-right">
                    {fmtCurrency(row.deductions)}
                  </TableCell>
                  <TableCell className="text-[13px] text-right font-medium">
                    {fmtCurrency(row.total)}
                  </TableCell>
                  <TableCell>{statusBadge(row.status, t)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editRow !== null}
        onOpenChange={(open) => {
          if (!open) setEditRow(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pay.edit_title")}</DialogTitle>
          </DialogHeader>

          {editRow && (
            <div className="space-y-4 mt-2">
              {/* Employee info */}
              <div className="rounded-lg border border-border/40 bg-secondary/30 p-3">
                <p className="text-[14px] font-medium text-foreground">
                  {editRow.displayName}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {editRow.position || "-"} | {t("pay.base_salary")}:{" "}
                  {fmtCurrency(editRow.base_salary)}
                </p>
              </div>

              <Separator />

              {/* Editable fields */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">
                    {t("pay.overtime_idr")}
                  </Label>
                  <Input
                    type="number"
                    className="h-10 bg-secondary border-border/50"
                    value={editOvertimePay}
                    onChange={(e) =>
                      setEditOvertimePay(Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">
                    {t("pay.allowances_idr")}
                  </Label>
                  <Input
                    type="number"
                    className="h-10 bg-secondary border-border/50"
                    value={editAllowances}
                    onChange={(e) =>
                      setEditAllowances(Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">
                    {t("pay.deductions_idr")}
                  </Label>
                  <Input
                    type="number"
                    className="h-10 bg-secondary border-border/50"
                    value={editDeductions}
                    onChange={(e) =>
                      setEditDeductions(Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">
                    {t("pay.notes")}
                  </Label>
                  <Textarea
                    className="min-h-[60px] bg-secondary border-border/50"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={t("pay.notes_placeholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">
                    {t("pay.status")}
                  </Label>
                  <Select
                    value={editStatus}
                    onValueChange={(v) => v !== null && setEditStatus(v)}
                  >
                    <SelectTrigger className="h-10 bg-secondary border-border/50 text-[13px]">
                      <SelectValue>
                        {editStatus === "draft"
                          ? t("pay.status_draft")
                          : editStatus === "approved"
                            ? t("pay.status_approved")
                            : t("pay.status_paid")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t("pay.status_draft")}</SelectItem>
                      <SelectItem value="approved">{t("pay.status_approved")}</SelectItem>
                      <SelectItem value="paid">{t("pay.status_paid")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  {t("pay.total_salary")}
                </span>
                <span className="text-lg font-bold text-foreground">
                  {fmtCurrency(editTotal)}
                </span>
              </div>

              {/* Save button */}
              <Button
                className="w-full h-10 bg-primary text-white text-[13px] hover:bg-primary/90"
                onClick={saveEdit}
                disabled={saving}
              >
                {saving ? t("common.saving") : t("pay.save_changes")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
