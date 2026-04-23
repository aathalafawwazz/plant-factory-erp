import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n-server";
import { Button } from "@/components/ui/button";
import {
  Plus, FlaskConical, Clock, Play, CheckCircle2, XCircle,
  Sprout, AlertTriangle, Calendar, Building, ArrowRight,
} from "lucide-react";
import type { ResearchStatus, ResearchType, ResearchProject } from "@/lib/types/database";

// Shape of the row we actually SELECT below (project + nested allocation
// summary). Supabase infers joined selects as complex unions that TS
// occasionally narrows to `never`; an explicit cast restores field access.
type ProjectWithAllocs = ResearchProject & {
  research_hole_allocations: Array<{ id: number; hole_id: number; released_at: string | null }> | null;
};
import { ResearchListTabs } from "@/components/research-list-tabs";
import { RESEARCH_STATUS_META, RESEARCH_TYPE_KEY } from "@/lib/research-meta";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_ORDER: ResearchStatus[] = ["proposed", "approved", "active", "paused", "completed", "cancelled"];

export default async function RisetPage() {
  const t = await getServerT();
  const supabase = await createClient();

  const [projectsRes, allocRes] = await Promise.all([
    supabase
      .from("research_projects")
      .select("*, research_hole_allocations(id, hole_id, released_at)")
      .order("created_at", { ascending: false }),
    supabase
      .from("research_hole_allocations")
      .select("hole_id")
      .is("released_at", null),
  ]);

  const projects = (projectsRes.data ?? []) as unknown as ProjectWithAllocs[];
  const reservedHolesCount = new Set((allocRes.data ?? []).map((a) => a.hole_id)).size;
  const now = Date.now();

  const buckets: Record<ResearchStatus, typeof projects> = {
    proposed: [], approved: [], active: [], paused: [], completed: [], cancelled: [],
  };
  for (const p of projects) buckets[p.status as ResearchStatus].push(p);

  // KPI stats
  const totalProjects = projects.length;
  const activeCount = buckets.active.length;
  const approvedCount = buckets.approved.length;
  const pendingCount = buckets.proposed.length;
  const completedCount = buckets.completed.length;
  const cancelledCount = buckets.cancelled.length;

  // Deadline alerts (active + approved, with proposed_end, not yet done)
  const alerts = projects
    .filter((p) => (p.status === "active" || p.status === "approved") && p.proposed_end)
    .map((p) => {
      const daysLeft = Math.round((new Date(p.proposed_end!).getTime() - now) / (1000 * 60 * 60 * 24));
      return { p, daysLeft };
    })
    .filter((x) => x.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  // Research types breakdown
  const typeBreakdown = new Map<ResearchType, number>();
  for (const p of projects) {
    const t = p.research_type as ResearchType;
    typeBreakdown.set(t, (typeBreakdown.get(t) ?? 0) + 1);
  }

  // Top institutions
  const instCount = new Map<string, number>();
  for (const p of projects) {
    if (!p.institution) continue;
    instCount.set(p.institution, (instCount.get(p.institution) ?? 0) + 1);
  }
  const topInstitutions = Array.from(instCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Recent projects (latest 5)
  const recent = projects.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            {t("research.title_full")}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {t("research.subtitle")}
          </p>
        </div>
        <Button asChild className="h-10 bg-primary hover:bg-primary/90 text-white shrink-0">
          <Link href="/riset/baru" className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Plus className="h-4 w-4" />
            {t("research.submit")}
          </Link>
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={FlaskConical} label={t("research.kpi_total")}     value={totalProjects}       tone="text-foreground" />
        <KpiCard icon={Clock}        label={t("research.kpi_proposed")}  value={pendingCount}        tone="text-amber-400" />
        <KpiCard icon={CheckCircle2} label={t("research.kpi_approved")}  value={approvedCount}       tone="text-blue-400" />
        <KpiCard icon={Play}         label={t("research.kpi_active")}    value={activeCount}         tone="text-emerald-400" />
        <KpiCard icon={CheckCircle2} label={t("research.kpi_completed")} value={completedCount}      tone="text-teal-400" />
        <KpiCard icon={Sprout}       label={t("research.kpi_used_holes")} value={reservedHolesCount} tone="text-violet-400" />
      </div>

      {/* Deadline alerts */}
      {alerts.length > 0 && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/5">
          <div className="px-4 py-3 border-b border-amber-400/20 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              {t("research.near_deadline")}
            </h3>
            <span className="text-[11px] text-muted-foreground">{alerts.length} {t("research.projects_unit")}</span>
          </div>
          <ul className="divide-y divide-amber-400/10">
            {alerts.map(({ p, daysLeft }) => (
              <li key={p.id}>
                <Link
                  href={`/riset/${p.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-400/5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{p.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.code} · {p.researcher_name}
                    </p>
                  </div>
                  <span className={cn(
                    "text-[11px] font-medium whitespace-nowrap",
                    daysLeft < 0 ? "text-rose-400" : daysLeft <= 3 ? "text-amber-400" : "text-muted-foreground"
                  )}>
                    {daysLeft < 0 ? t("research.overdue_days").replace("{n}", String(Math.abs(daysLeft)))
                      : daysLeft === 0 ? t("research.today")
                      : t("research.days_left").replace("{n}", String(daysLeft))}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Two-column: breakdown + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Main: list tabs */}
        <div className="space-y-3">
          <div className="rounded-lg border border-border/40 bg-card">
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-foreground">{t("research.list_projects")}</h3>
              <span className="text-[11px] text-muted-foreground">
                {t("research.summary_running")
                  .replace("{a}", String(activeCount))
                  .replace("{b}", String(pendingCount))
                  .replace("{c}", String(cancelledCount))}
              </span>
            </div>
            <div className="p-4">
              <ResearchListTabs
                buckets={STATUS_ORDER.map((s) => ({
                  status: s,
                  items: buckets[s].map((p) => ({
                    id: p.id,
                    code: p.code,
                    title: p.title,
                    researcher_name: p.researcher_name,
                    institution: p.institution,
                    research_type: p.research_type as ResearchType,
                    status: p.status as ResearchStatus,
                    proposed_start: p.proposed_start,
                    proposed_end: p.proposed_end,
                    actual_start: p.actual_start,
                    actual_end: p.actual_end,
                    allocated_holes: (p.research_hole_allocations ?? []).filter(
                      (a: { released_at: string | null }) => a.released_at == null
                    ).length,
                    overdue: Boolean(
                      p.proposed_end &&
                      p.status !== "completed" &&
                      p.status !== "cancelled" &&
                      new Date(p.proposed_end).getTime() < now
                    ),
                  })),
                }))}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          {/* Breakdown by type */}
          <div className="rounded-lg border border-border/40 bg-card">
            <div className="px-4 py-3 border-b border-border/30">
              <h3 className="text-[13px] font-semibold text-foreground">{t("research.types")}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("research.types_subtitle")}</p>
            </div>
            <div className="p-3 space-y-1.5">
              {typeBreakdown.size === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-4">{t("research.no_data")}</p>
              ) : (
                Array.from(typeBreakdown.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const pct = totalProjects > 0 ? (count / totalProjects) * 100 : 0;
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-foreground">{t(RESEARCH_TYPE_KEY[type])}</span>
                          <span className="text-muted-foreground tabular-nums">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Top institutions */}
          <div className="rounded-lg border border-border/40 bg-card">
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-muted-foreground" />
                {t("research.top_institutions")}
              </h3>
            </div>
            <div className="p-3">
              {topInstitutions.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-4">{t("research.no_inst")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {topInstitutions.map(([inst, count]) => (
                    <li key={inst} className="flex items-center justify-between text-[12px]">
                      <span className="text-foreground truncate">{inst}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">{count} {t("research.projects_unit")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent */}
          <div className="rounded-lg border border-border/40 bg-card">
            <div className="px-4 py-3 border-b border-border/30">
              <h3 className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {t("research.recent")}
              </h3>
            </div>
            <ul className="divide-y divide-border/30">
              {recent.length === 0 ? (
                <li className="p-4 text-center text-[12px] text-muted-foreground">{t("research.no_research")}</li>
              ) : recent.map((p) => {
                const meta = RESEARCH_STATUS_META[p.status as ResearchStatus];
                return (
                  <li key={p.id}>
                    <Link
                      href={`/riset/${p.id}`}
                      className="flex items-start gap-2 px-4 py-2.5 hover:bg-secondary/40 transition-colors"
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0", meta.dot)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-foreground truncate">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate tabular-nums">
                          {p.code} · {p.researcher_name}
                        </p>
                      </div>
                    </Link>
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
