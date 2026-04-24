import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getServerT } from "@/lib/i18n-server";
import { Button } from "@/components/ui/button";
import {
  Plus, UserCheck, Clock, CheckCircle2, Users, CalendarDays,
  TrendingUp, AlertCircle, ArrowRight,
} from "lucide-react";
import type { VisitStatus, VisitType } from "@/lib/types/database";
import { VisitListTabs } from "@/components/visit-list-tabs";
import { VisitTrendChart } from "@/components/visit-trend-chart";
import { VISIT_STATUS_META, VISIT_TYPE_META } from "@/lib/visit-meta";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_ORDER: VisitStatus[] = ["scheduled", "confirmed", "ongoing", "completed", "cancelled", "no_show"];

export default async function KunjunganPage() {
  const t = await getServerT();
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const canWrite = !!currentUser && ["admin", "operator"].includes(currentUser.role);

  const { data: visits } = await supabase
    .from("visits")
    .select("*")
    .order("visit_date", { ascending: false })
    .order("start_time", { ascending: false });

  const all = visits ?? [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  // Buckets
  const buckets: Record<VisitStatus, typeof all> = {
    scheduled: [], confirmed: [], ongoing: [], completed: [], cancelled: [], no_show: [],
  };
  for (const v of all) buckets[v.status as VisitStatus].push(v);

  // KPI
  const todayVisits = all.filter((v) => v.visit_date === todayStr && v.status !== "cancelled");
  const thisMonthVisits = all.filter((v) => {
    const d = new Date(v.visit_date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear && v.status !== "cancelled";
  });
  const ytdVisits = all.filter((v) => {
    const d = new Date(v.visit_date);
    return d.getFullYear() === thisYear && v.status !== "cancelled";
  });
  const totalVisitorsYtd = ytdVisits.reduce((s, v) => s + (v.group_size ?? 0), 0);
  const pendingCount = buckets.scheduled.length;
  const completedCount = buckets.completed.length;

  // Upcoming (dalam 7 hari ke depan, scheduled/confirmed)
  const next7d = new Date();
  next7d.setDate(next7d.getDate() + 7);
  const upcoming = all
    .filter((v) => {
      const d = new Date(v.visit_date);
      return (v.status === "scheduled" || v.status === "confirmed")
        && d >= new Date(todayStr)
        && d <= next7d;
    })
    .sort((a, b) => {
      const byDate = a.visit_date.localeCompare(b.visit_date);
      if (byDate !== 0) return byDate;
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    })
    .slice(0, 5);

  // Tipe breakdown
  const typeBreakdown = new Map<VisitType, number>();
  for (const v of all) {
    const t = v.visit_type as VisitType;
    typeBreakdown.set(t, (typeBreakdown.get(t) ?? 0) + 1);
  }

  // Top organizations
  const orgCount = new Map<string, number>();
  for (const v of all) {
    if (!v.organization) continue;
    orgCount.set(v.organization, (orgCount.get(v.organization) ?? 0) + 1);
  }
  const topOrgs = Array.from(orgCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Monthly trend — last 6 months
  const monthlyTrend: { label: string; count: number; visitors: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const subset = all.filter((v) => {
      const vd = new Date(v.visit_date);
      return vd.getMonth() === m && vd.getFullYear() === y && v.status !== "cancelled";
    });
    monthlyTrend.push({
      label: d.toLocaleDateString("id-ID", { month: "short" }),
      count: subset.length,
      visitors: subset.reduce((s, v) => s + v.group_size, 0),
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            {t("visit.title_full")}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {t("visit.subtitle")}
          </p>
        </div>
        {canWrite && (
          <Button asChild className="h-10 bg-primary hover:bg-primary/90 text-white shrink-0">
            <Link href="/kunjungan/baru" className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              {t("visit.record")}
            </Link>
          </Button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={CalendarDays} label={t("visit.kpi_today")}       value={todayVisits.length}   tone="text-emerald-400" />
        <KpiCard icon={Clock}        label={t("visit.kpi_pending")}     value={pendingCount}         tone="text-amber-400" />
        <KpiCard icon={UserCheck}    label={t("visit.kpi_month")}       value={thisMonthVisits.length} tone="text-blue-400" />
        <KpiCard icon={CheckCircle2} label={t("visit.kpi_completed")}   value={completedCount}       tone="text-teal-400" />
        <KpiCard icon={Users}        label={t("visit.kpi_guests_ytd")}  value={totalVisitorsYtd}     tone="text-violet-400" />
        <KpiCard icon={TrendingUp}   label={t("visit.kpi_tours_ytd")}   value={ytdVisits.length}     tone="text-pink-400" />
      </div>

      {/* Upcoming alerts */}
      {upcoming.length > 0 && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5">
          <div className="px-4 py-3 border-b border-emerald-400/20 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-emerald-400" />
              {t("visit.next_7_days")}
            </h3>
            <span className="text-[11px] text-muted-foreground">{upcoming.length} {t("visit.visits_unit")}</span>
          </div>
          <ul className="divide-y divide-emerald-400/10">
            {upcoming.map((v) => {
              const typeMeta = VISIT_TYPE_META[v.visit_type as VisitType];
              const isToday = v.visit_date === todayStr;
              return (
                <li key={v.id}>
                  <Link
                    href={`/kunjungan/${v.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-400/5 transition-colors"
                  >
                    <span className="text-lg shrink-0">{typeMeta.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground truncate">{v.organization}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {v.purpose} · {v.group_size} {t("visit.guests_unit")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-[12px] font-medium tabular-nums", isToday ? "text-emerald-400" : "text-foreground")}>
                        {isToday ? t("visit.today_label") : fmtShortDate(v.visit_date)}
                      </p>
                      {v.start_time && (
                        <p className="text-[10px] text-muted-foreground tabular-nums">{v.start_time.slice(0, 5)}</p>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Two-column: list + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-3">
          <div className="rounded-lg border border-border/40 bg-card">
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-foreground">{t("visit.list")}</h3>
              <span className="text-[11px] text-muted-foreground">
                {t("visit.summary_pending")
                  .replace("{a}", String(pendingCount))
                  .replace("{b}", String(buckets.confirmed.length))
                  .replace("{c}", String(completedCount))}
              </span>
            </div>
            <div className="p-4">
              <VisitListTabs
                buckets={STATUS_ORDER.map((s) => ({
                  status: s,
                  items: buckets[s].map((v) => ({
                    id: v.id,
                    code: v.code,
                    visit_type: v.visit_type as VisitType,
                    status: v.status as VisitStatus,
                    purpose: v.purpose,
                    organization: v.organization,
                    visit_date: v.visit_date,
                    start_time: v.start_time,
                    end_time: v.end_time,
                    group_size: v.group_size,
                    host_name: v.host_name,
                    feedback_rating: v.feedback_rating,
                  })),
                }))}
              />
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          {/* Tren 6 bulan — chart */}
          <VisitTrendChart data={monthlyTrend} />

          {/* Breakdown tipe */}
          <div className="rounded-lg border border-border/40 bg-card">
            <div className="px-4 py-3 border-b border-border/30">
              <h3 className="text-[13px] font-semibold text-foreground">{t("visit.types_breakdown")}</h3>
            </div>
            <div className="p-3 space-y-1.5">
              {typeBreakdown.size === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-4">{t("visit.no_data")}</p>
              ) : (
                Array.from(typeBreakdown.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const m = VISIT_TYPE_META[type];
                    return (
                      <div key={type} className="flex items-center justify-between text-[12px]">
                        <span className="inline-flex items-center gap-1.5">
                          <span>{m.emoji}</span>
                          <span className="text-foreground">{t(m.labelKey)}</span>
                        </span>
                        <span className="text-muted-foreground tabular-nums">{count}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Top organizations */}
          <div className="rounded-lg border border-border/40 bg-card">
            <div className="px-4 py-3 border-b border-border/30">
              <h3 className="text-[13px] font-semibold text-foreground">{t("visit.top_orgs")}</h3>
            </div>
            <div className="p-3">
              {topOrgs.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-4">{t("visit.no_data")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {topOrgs.map(([org, count]) => (
                    <li key={org} className="flex items-center justify-between text-[12px]">
                      <span className="text-foreground truncate">{org}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">{count}x</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Legend status */}
          <div className="rounded-lg border border-border/40 bg-card p-3">
            <p className="text-[11px] text-muted-foreground mb-2">{t("visit.status_legend")}</p>
            <ul className="space-y-1">
              {STATUS_ORDER.map((s) => {
                const m = VISIT_STATUS_META[s];
                return (
                  <li key={s} className="flex items-center gap-2 text-[11px]">
                    <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
                    <span className="text-foreground">{t(m.labelKey)}</span>
                    <span className="text-muted-foreground ml-auto tabular-nums">{buckets[s].length}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn("h-3.5 w-3.5", tone)} />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-2xl font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function fmtShortDate(s: string): string {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
