"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import type { Profile } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PeriodFilter = "week" | "month" | "3months" | "all";

interface UserWorkload {
  userId: string;
  displayName: string;
  role: string;
  planting: number;
  harvesting: number;
  environment: number;
  nutrient: number;
  total: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BAR_COLORS = {
  planting: "#638cff",
  harvesting: "#2dd4bf",
  environment: "#f59e0b",
  nutrient: "#818fff",
};

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "week", label: "Minggu Ini" },
  { value: "month", label: "Bulan Ini" },
  { value: "3months", label: "3 Bulan" },
  { value: "all", label: "Semua" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getPeriodStart(period: PeriodFilter): string | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday as start
    now.setDate(now.getDate() - diff);
  } else if (period === "month") {
    now.setDate(1);
  } else if (period === "3months") {
    now.setMonth(now.getMonth() - 3);
  }
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function countByUser(
  rows: { [key: string]: string | null }[] | null,
  field: string
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!rows) return counts;
  for (const row of rows) {
    const uid = row[field];
    if (uid) {
      counts[uid] = (counts[uid] || 0) + 1;
    }
  }
  return counts;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function BebanKerjaPage() {
  const supabase = createClient();

  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [workloads, setWorkloads] = useState<UserWorkload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);

    const periodStart = getPeriodStart(period);

    // Fetch profiles
    const { data: profiles } = await supabase.from("profiles").select("*");
    const profileMap = new Map<string, Profile>();
    if (profiles) {
      for (const p of profiles) {
        profileMap.set(p.id, p);
      }
    }

    // Build queries with optional date filtering
    let plantingQuery = supabase
      .from("planting_cycles")
      .select("created_by")
      .not("created_by", "is", null);
    if (periodStart) plantingQuery = plantingQuery.gte("planted_at", periodStart);

    let harvestQuery = supabase
      .from("planting_cycles")
      .select("created_by")
      .eq("status", "harvested")
      .not("created_by", "is", null);
    if (periodStart) harvestQuery = harvestQuery.gte("harvested_at", periodStart);

    let envQuery = supabase
      .from("environmental_logs")
      .select("recorded_by")
      .not("recorded_by", "is", null);
    if (periodStart) envQuery = envQuery.gte("recorded_at", periodStart);

    let nutrientQuery = supabase
      .from("nutrient_logs")
      .select("mixed_by")
      .not("mixed_by", "is", null);
    if (periodStart) nutrientQuery = nutrientQuery.gte("mixed_at", periodStart);

    const [plantingRes, harvestRes, envRes, nutrientRes] = await Promise.all([
      plantingQuery,
      harvestQuery,
      envQuery,
      nutrientQuery,
    ]);

    const plantingCounts = countByUser(
      plantingRes.data as { created_by: string | null }[] | null,
      "created_by"
    );
    const harvestCounts = countByUser(
      harvestRes.data as { created_by: string | null }[] | null,
      "created_by"
    );
    const envCounts = countByUser(
      envRes.data as { recorded_by: string | null }[] | null,
      "recorded_by"
    );
    const nutrientCounts = countByUser(
      nutrientRes.data as { mixed_by: string | null }[] | null,
      "mixed_by"
    );

    // Collect all unique user IDs
    const allUserIds = new Set<string>([
      ...Object.keys(plantingCounts),
      ...Object.keys(harvestCounts),
      ...Object.keys(envCounts),
      ...Object.keys(nutrientCounts),
    ]);

    const result: UserWorkload[] = [];
    for (const uid of allUserIds) {
      const profile = profileMap.get(uid);
      const planting = plantingCounts[uid] || 0;
      const harvesting = harvestCounts[uid] || 0;
      const environment = envCounts[uid] || 0;
      const nutrient = nutrientCounts[uid] || 0;

      result.push({
        userId: uid,
        displayName: profile?.display_name || uid.slice(0, 8),
        role: profile?.role || "operator",
        planting,
        harvesting,
        environment,
        nutrient,
        total: planting + harvesting + environment + nutrient,
      });
    }

    // Sort by total descending
    result.sort((a, b) => b.total - a.total);
    setWorkloads(result);
    setLoading(false);
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Beban Kerja</h1>
        <Select
          value={period}
          onValueChange={(v) => v !== null && setPeriod(v as PeriodFilter)}
        >
          <SelectTrigger className="w-[160px] h-9 bg-secondary border-border/50 text-[13px]">
            <SelectValue>{PERIOD_OPTIONS.find((o) => o.value === period)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            Memuat data beban kerja...
          </CardContent>
        </Card>
      )}

      {!loading && workloads.length === 0 && (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Belum ada data aktivitas untuk periode ini.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && workloads.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workloads.map((w) => (
            <div
              key={w.userId}
              className="rounded-lg border border-border/40 bg-card p-4 space-y-3"
            >
              {/* Header: name + role */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-foreground">
                    {w.displayName}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[11px] capitalize"
                  >
                    {w.role}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Total: {w.total}
                </span>
              </div>

              {/* 4-column stat grid */}
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">Tanam</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: BAR_COLORS.planting }}
                  >
                    {w.planting}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">Panen</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: BAR_COLORS.harvesting }}
                  >
                    {w.harvesting}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">Lingkungan</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: BAR_COLORS.environment }}
                  >
                    {w.environment}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">Nutrisi</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: BAR_COLORS.nutrient }}
                  >
                    {w.nutrient}
                  </p>
                </div>
              </div>

              {/* Activity distribution bar */}
              {w.total > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex h-3 w-full rounded overflow-hidden">
                    {w.planting > 0 && (
                      <div
                        style={{
                          width: `${(w.planting / w.total) * 100}%`,
                          backgroundColor: BAR_COLORS.planting,
                        }}
                        title={`Tanam: ${w.planting}`}
                      />
                    )}
                    {w.harvesting > 0 && (
                      <div
                        style={{
                          width: `${(w.harvesting / w.total) * 100}%`,
                          backgroundColor: BAR_COLORS.harvesting,
                        }}
                        title={`Panen: ${w.harvesting}`}
                      />
                    )}
                    {w.environment > 0 && (
                      <div
                        style={{
                          width: `${(w.environment / w.total) * 100}%`,
                          backgroundColor: BAR_COLORS.environment,
                        }}
                        title={`Lingkungan: ${w.environment}`}
                      />
                    )}
                    {w.nutrient > 0 && (
                      <div
                        style={{
                          width: `${(w.nutrient / w.total) * 100}%`,
                          backgroundColor: BAR_COLORS.nutrient,
                        }}
                        title={`Nutrisi: ${w.nutrient}`}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {w.planting > 0 && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span
                          className="inline-block w-2 h-2 rounded-sm"
                          style={{ backgroundColor: BAR_COLORS.planting }}
                        />
                        Tanam {((w.planting / w.total) * 100).toFixed(0)}%
                      </span>
                    )}
                    {w.harvesting > 0 && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span
                          className="inline-block w-2 h-2 rounded-sm"
                          style={{ backgroundColor: BAR_COLORS.harvesting }}
                        />
                        Panen {((w.harvesting / w.total) * 100).toFixed(0)}%
                      </span>
                    )}
                    {w.environment > 0 && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span
                          className="inline-block w-2 h-2 rounded-sm"
                          style={{ backgroundColor: BAR_COLORS.environment }}
                        />
                        Lingkungan {((w.environment / w.total) * 100).toFixed(0)}%
                      </span>
                    )}
                    {w.nutrient > 0 && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span
                          className="inline-block w-2 h-2 rounded-sm"
                          style={{ backgroundColor: BAR_COLORS.nutrient }}
                        />
                        Nutrisi {((w.nutrient / w.total) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-3 w-full rounded bg-secondary" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
