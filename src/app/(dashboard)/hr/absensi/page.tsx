"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/role-gate";
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
import {
  Clock,
  LogIn,
  LogOut,
  ArrowUpDown,
  List,
  LayoutGrid,
  Plus,
} from "lucide-react";
import type { Profile, AttendanceLog } from "@/lib/types/database";

const STATUS_COLORS: Record<string, string> = {
  hadir: "bg-emerald-500/20 text-emerald-400",
  izin: "bg-sky-500/20 text-sky-400",
  sakit: "bg-amber-500/20 text-amber-400",
  cuti: "bg-purple-500/20 text-purple-400",
  alpha: "bg-red-500/20 text-red-400",
};

const STATUS_OPTIONS = [
  { value: "hadir", labelKey: "att.status_hadir" },
  { value: "izin", labelKey: "att.status_izin" },
  { value: "sakit", labelKey: "att.status_sakit" },
  { value: "cuti", labelKey: "att.status_cuti" },
  { value: "alpha", labelKey: "att.status_alpha" },
];

type SortMode = "terbaru" | "terlama";
type ViewMode = "list" | "grid";

export default function AbsensiPage() {
  const supabase = createClient();
  const { t } = useLang();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [myToday, setMyToday] = useState<AttendanceLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>("terbaru");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Manual entry dialog
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUserId, setManualUserId] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualClockIn, setManualClockIn] = useState("");
  const [manualClockOut, setManualClockOut] = useState("");
  const [manualStatus, setManualStatus] = useState("hadir");
  const [manualNotes, setManualNotes] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
    await loadData(user?.id ?? null);
    setLoading(false);
  }

  async function loadData(userId: string | null) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fromDate = sevenDaysAgo.toISOString().split("T")[0];

    const [profRes, logsRes, myRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase
        .from("attendance_logs")
        .select("*")
        .gte("date", fromDate)
        .order("date", { ascending: false }),
      userId
        ? supabase
            .from("attendance_logs")
            .select("*")
            .eq("user_id", userId)
            .eq("date", today)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setProfiles(profRes.data ?? []);
    setAttendanceLogs(logsRes.data ?? []);
    setMyToday(myRes.data ?? null);
  }

  function getProfileName(userId: string): string {
    return (
      profiles.find((p) => p.id === userId)?.display_name ?? "Unknown"
    );
  }

  // Clock In/Out status
  const clockStatus = useMemo(() => {
    if (!myToday) return "belum";
    if (myToday.clock_in && !myToday.clock_out) return "clocked_in";
    if (myToday.clock_in && myToday.clock_out) return "selesai";
    return "belum";
  }, [myToday]);

  async function handleClockIn() {
    if (!currentUserId) return;
    setClockLoading(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("attendance_logs").insert({
        user_id: currentUserId,
        date: today,
        clock_in: now,
        status: "hadir",
        total_hours: 0,
        overtime_hours: 0,
      });
      if (error) throw error;
      toast.success(t("att.clock_in_success"));
      await loadData(currentUserId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("att.clock_in_failed");
      toast.error(message);
    } finally {
      setClockLoading(false);
    }
  }

  async function handleClockOut() {
    if (!currentUserId || !myToday) return;
    setClockLoading(true);
    try {
      const now = new Date();
      const clockInTime = new Date(myToday.clock_in!);
      const diffMs = now.getTime() - clockInTime.getTime();
      const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
      const overtimeHours = Math.max(0, parseFloat((totalHours - 8).toFixed(2)));

      const { error } = await supabase
        .from("attendance_logs")
        .update({
          clock_out: now.toISOString(),
          total_hours: totalHours,
          overtime_hours: overtimeHours,
        })
        .eq("id", myToday.id);

      if (error) throw error;
      toast.success(t("att.clock_out_success"));
      await loadData(currentUserId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("att.clock_out_failed");
      toast.error(message);
    } finally {
      setClockLoading(false);
    }
  }

  // Sorted logs
  const sortedLogs = useMemo(() => {
    const logs = [...attendanceLogs];
    if (sortMode === "terbaru") {
      logs.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } else {
      logs.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    }
    return logs;
  }, [attendanceLogs, sortMode]);

  function formatTime(iso: string | null): string {
    if (!iso) return "-";
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // Manual entry
  function openManualDialog() {
    setManualUserId("");
    setManualDate(today);
    setManualClockIn("");
    setManualClockOut("");
    setManualStatus("hadir");
    setManualNotes("");
    setManualOpen(true);
  }

  async function handleManualSave() {
    if (!manualUserId || !manualDate) {
      toast.error(t("att.user_date_required"));
      return;
    }
    setManualSaving(true);
    try {
      let totalHours = 0;
      let overtimeHours = 0;

      if (manualClockIn && manualClockOut) {
        const inTime = new Date(`${manualDate}T${manualClockIn}:00`);
        const outTime = new Date(`${manualDate}T${manualClockOut}:00`);
        const diffMs = outTime.getTime() - inTime.getTime();
        totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
        overtimeHours = Math.max(0, parseFloat((totalHours - 8).toFixed(2)));
      }

      const payload: {
        user_id: string;
        date: string;
        clock_in: string | null;
        clock_out: string | null;
        total_hours: number;
        overtime_hours: number;
        status: string;
        notes: string | null;
      } = {
        user_id: manualUserId,
        date: manualDate,
        clock_in: manualClockIn
          ? new Date(`${manualDate}T${manualClockIn}:00`).toISOString()
          : null,
        clock_out: manualClockOut
          ? new Date(`${manualDate}T${manualClockOut}:00`).toISOString()
          : null,
        total_hours: totalHours,
        overtime_hours: overtimeHours,
        status: manualStatus,
        notes: manualNotes || null,
      };

      const { error } = await supabase
        .from("attendance_logs")
        .insert(payload);

      if (error) throw error;
      toast.success(t("att.manual_saved"));
      setManualOpen(false);
      await loadData(currentUserId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("common.save_failed");
      toast.error(message);
    } finally {
      setManualSaving(false);
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
    <div>
      <h1 className="text-lg font-semibold text-foreground mb-4">
        {t("att.title")}
      </h1>

      {/* Clock In/Out Section */}
      <div className="rounded-lg border border-border/40 bg-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="size-5 text-muted-foreground" />
          <span className="text-[13px] font-medium">{t("att.status_today")}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            {clockStatus === "belum" && (
              <div className="text-[14px] text-muted-foreground">
                {t("att.not_clocked_in")}
              </div>
            )}
            {clockStatus === "clocked_in" && (
              <div className="text-[14px]">
                {t("att.clocked_in")}{" "}
                <span className="text-emerald-400 font-medium">
                  {formatTime(myToday?.clock_in ?? null)}
                </span>
              </div>
            )}
            {clockStatus === "selesai" && (
              <div className="text-[14px]">
                {t("att.done")}{" "}
                <span className="text-muted-foreground">
                  {formatTime(myToday?.clock_in ?? null)} -{" "}
                  {formatTime(myToday?.clock_out ?? null)}
                </span>
                <span className="ml-2 text-emerald-400 font-medium">
                  ({myToday?.total_hours?.toFixed(1)} {t("hr.hours_unit")})
                </span>
              </div>
            )}
          </div>

          {clockStatus === "belum" && (
            <Button
              className="h-14 px-8 bg-emerald-600 text-white text-[14px] font-medium hover:bg-emerald-700"
              onClick={handleClockIn}
              disabled={clockLoading}
            >
              <LogIn className="size-5 mr-2" />
              {clockLoading ? t("common.processing") : t("att.clock_in")}
            </Button>
          )}
          {clockStatus === "clocked_in" && (
            <Button
              className="h-14 px-8 bg-amber-600 text-white text-[14px] font-medium hover:bg-amber-700"
              onClick={handleClockOut}
              disabled={clockLoading}
            >
              <LogOut className="size-5 mr-2" />
              {clockLoading ? t("common.processing") : t("att.clock_out")}
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Select
            value={sortMode}
            onValueChange={(v) => v !== null && setSortMode(v as SortMode)}
          >
            <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px]">
              <ArrowUpDown className="size-3.5 mr-1.5" />
              <SelectValue>
                {sortMode === "terbaru" ? t("att.sort_newest") : t("att.sort_oldest")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="terbaru">{t("att.sort_newest")}</SelectItem>
              <SelectItem value="terlama">{t("att.sort_oldest")}</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            <button
              className={`p-2 ${
                viewMode === "list"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50"
              }`}
              onClick={() => setViewMode("list")}
            >
              <List className="size-4" />
            </button>
            <button
              className={`p-2 ${
                viewMode === "grid"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50"
              }`}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>

        <RoleGate roles={["admin", "operator"]} fallback={null}>
          <Button
            className="h-9 bg-primary text-white text-[12px] hover:bg-primary/90"
            onClick={openManualDialog}
          >
            <Plus className="size-4 mr-1" />
            {t("att.add_manual")}
          </Button>
        </RoleGate>
      </div>

      {/* Attendance Logs */}
      {viewMode === "list" ? (
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("att.date")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("att.name")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("att.clock_in")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("att.clock_out")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("att.total_hours")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("att.overtime")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("att.status")}
                </TableHead>
                <TableHead className="text-[12px] text-muted-foreground">
                  {t("att.notes")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLogs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground py-8"
                  >
                    {t("att.no_logs")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-[13px]">
                      {formatDate(log.date)}
                    </TableCell>
                    <TableCell className="text-[13px] font-medium">
                      {getProfileName(log.user_id)}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {formatTime(log.clock_in)}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {formatTime(log.clock_out)}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {log.total_hours > 0
                        ? `${log.total_hours.toFixed(1)}h`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {log.overtime_hours > 0
                        ? `${log.overtime_hours.toFixed(1)}h`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${
                          STATUS_COLORS[log.status] ??
                          "bg-zinc-500/20 text-zinc-400"
                        } border-0 text-[11px] capitalize`}
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground max-w-[150px] truncate">
                      {log.notes ?? "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedLogs.length === 0 ? (
            <Card className="col-span-full rounded-lg border border-border/40 bg-card">
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("att.no_logs")}
              </CardContent>
            </Card>
          ) : (
            sortedLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-border/40 bg-card p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium">
                    {getProfileName(log.user_id)}
                  </span>
                  <Badge
                    className={`${
                      STATUS_COLORS[log.status] ??
                      "bg-zinc-500/20 text-zinc-400"
                    } border-0 text-[11px] capitalize`}
                  >
                    {log.status}
                  </Badge>
                </div>
                <div className="text-[12px] text-muted-foreground mb-2">
                  {formatDate(log.date)}
                </div>
                <div className="flex items-center gap-4 text-[12px]">
                  <div>
                    <span className="text-muted-foreground">In: </span>
                    {formatTime(log.clock_in)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Out: </span>
                    {formatTime(log.clock_out)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total: </span>
                    {log.total_hours > 0
                      ? `${log.total_hours.toFixed(1)}h`
                      : "-"}
                  </div>
                </div>
                {log.notes && (
                  <div className="text-[11px] text-muted-foreground mt-2 truncate">
                    {log.notes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Manual Entry Dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent
          className="sm:max-w-[480px] bg-card border-border/50 p-0 gap-0"
          showCloseButton={true}
        >
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{t("att.manual_entry")}</DialogTitle>
          </DialogHeader>

          <Separator className="my-3" />

          <div className="px-4 pb-4 space-y-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">
                {t("att.employee_label")}
              </Label>
              <Select
                value={manualUserId}
                onValueChange={(v) => v !== null && setManualUserId(v)}
              >
                <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-full">
                  <SelectValue>
                    {manualUserId
                      ? getProfileName(manualUserId)
                      : t("att.select_employee")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  {t("att.date")}
                </Label>
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  {t("att.status")}
                </Label>
                <Select
                  value={manualStatus}
                  onValueChange={(v) => v !== null && setManualStatus(v)}
                >
                  <SelectTrigger className="h-9 bg-secondary border-border/50 text-[12px] w-full">
                    <SelectValue>
                      {t(STATUS_OPTIONS.find((s) => s.value === manualStatus)
                        ?.labelKey ?? "") || t("att.select_status")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
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
                  {t("att.clock_in")}
                </Label>
                <Input
                  type="time"
                  value={manualClockIn}
                  onChange={(e) => setManualClockIn(e.target.value)}
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  {t("att.clock_out")}
                </Label>
                <Input
                  type="time"
                  value={manualClockOut}
                  onChange={(e) => setManualClockOut(e.target.value)}
                  className="h-9 bg-secondary border-border/50 text-[12px]"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground">
                {t("att.notes")}
              </Label>
              <Input
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder={t("att.optional")}
                className="h-9 bg-secondary border-border/50 text-[12px]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                className="h-9 text-[12px]"
                onClick={() => setManualOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="h-9 bg-primary text-white text-[12px] hover:bg-primary/90"
                onClick={handleManualSave}
                disabled={manualSaving}
              >
                {manualSaving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
