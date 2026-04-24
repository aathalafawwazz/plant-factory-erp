"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sprout,
  Scissors,
  Thermometer,
  Droplets,
  ShoppingCart,
  Clock,
  Calendar as CalendarIcon,
  Tag,
  UserCheck,
  FlaskConical,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { RoleGate } from "@/components/role-gate";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  startHour: number; // 0-23
  endHour: number; // 0-23
  type: "tanam" | "panen" | "lingkungan" | "nutrisi" | "order" | "kunjungan" | "riset";
  title: string;
  subtitle?: string;
  href?: string;   // optional navigation target for click-through
}

type ViewMode = "daily" | "weekly" | "monthly";
type EventType = CalendarEvent["type"];

// Event block styles — theme-aware so text stays legible on both modes.
// Light: soft tint bg (/15) + dark ink text for contrast on white panels.
// Dark:  stronger tint bg (/20) + pale text that pops on dark surfaces.
const EVENT_STYLES: Record<EventType, string> = {
  tanam:      "bg-blue-500/15   border-l-blue-500   text-blue-800   dark:bg-blue-500/20   dark:text-blue-200",
  panen:      "bg-teal-500/15   border-l-teal-500   text-teal-800   dark:bg-teal-500/20   dark:text-teal-100",
  lingkungan: "bg-amber-500/15  border-l-amber-500  text-amber-800  dark:bg-amber-500/20  dark:text-amber-100",
  nutrisi:    "bg-purple-500/15 border-l-purple-500 text-purple-800 dark:bg-purple-500/20 dark:text-purple-100",
  order:      "bg-green-500/15  border-l-green-500  text-green-800  dark:bg-green-500/20  dark:text-green-100",
  kunjungan:  "bg-pink-500/15   border-l-pink-500   text-pink-800   dark:bg-pink-500/20   dark:text-pink-100",
  riset:      "bg-violet-500/15 border-l-violet-500 text-violet-800 dark:bg-violet-500/20 dark:text-violet-100",
};

const EVENT_DOT_COLORS: Record<EventType, string> = {
  tanam: "bg-blue-500",
  panen: "bg-teal-500",
  lingkungan: "bg-amber-500",
  nutrisi: "bg-purple-500",
  order: "bg-green-500",
  kunjungan: "bg-pink-500",
  riset: "bg-violet-500",
};

const FILTER_CHECK_COLORS: Record<EventType, string> = {
  tanam: "accent-blue-500",
  panen: "accent-teal-500",
  lingkungan: "accent-amber-500",
  nutrisi: "accent-purple-500",
  order: "accent-green-500",
  kunjungan: "accent-pink-500",
  riset: "accent-violet-500",
};

// i18n keys for event labels — resolve via t() at usage site
const EVENT_LABEL_KEYS: Record<EventType, string> = {
  tanam: "cal.event.tanam",
  panen: "cal.event.panen",
  lingkungan: "cal.event.lingkungan",
  nutrisi: "cal.event.nutrisi",
  order: "cal.event.order",
  kunjungan: "cal.event.kunjungan",
  riset: "cal.event.riset",
};

const EVENT_ICONS: Record<EventType, React.ReactNode> = {
  tanam: <Sprout className="size-3.5" />,
  panen: <Scissors className="size-3.5" />,
  lingkungan: <Thermometer className="size-3.5" />,
  nutrisi: <Droplets className="size-3.5" />,
  order: <ShoppingCart className="size-3.5" />,
  kunjungan: <UserCheck className="size-3.5" />,
  riset: <FlaskConical className="size-3.5" />,
};

const MINI_DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];
// i18n keys — resolved at call site
const WEEK_DAY_NAME_KEYS = [
  "day_short.mon",
  "day_short.tue",
  "day_short.wed",
  "day_short.thu",
  "day_short.fri",
  "day_short.sat",
  "day_short.sun",
];
const MONTH_NAME_KEYS = [
  "month.jan", "month.feb", "month.mar", "month.apr", "month.may", "month.jun",
  "month.jul", "month.aug", "month.sep", "month.oct", "month.nov", "month.dec",
];

const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateStr(raw: string): string {
  return raw.slice(0, 10);
}

function extractHour(raw: string): number {
  try {
    const d = new Date(raw);
    return d.getHours();
  } catch {
    return 8;
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(d: Date, monthNames: string[]): string {
  return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/* ------------------------------------------------------------------ */
/*  Overlap layout (Google Calendar style)                             */
/* ------------------------------------------------------------------ */

interface LayoutEvent extends CalendarEvent {
  column: number;
  totalColumns: number;
  clusterId: number; // events in same overlap cluster share this id
}

interface OverflowMarker {
  clusterId: number;
  startHour: number;
  endHour: number;
  date: string;
  hiddenEvents: CalendarEvent[];
  column: number; // which column the badge sits in
  totalColumns: number;
}

// Layout events: detect overlap clusters, cap at MAX_VISIBLE_COLS, emit overflow markers
const MAX_VISIBLE_COLS = 3;

function layoutEventsWithOverflow(events: CalendarEvent[]): {
  laid: LayoutEvent[];
  overflows: OverflowMarker[];
} {
  if (events.length === 0) return { laid: [], overflows: [] };

  const sorted = [...events].sort(
    (a, b) => a.startHour - b.startHour || b.endHour - a.endHour
  );

  // Step 1: assign columns greedily to ALL events (unlimited cols)
  interface WithCol extends CalendarEvent { col: number }
  const withCol: WithCol[] = [];
  const colEnds: number[] = [];
  for (const ev of sorted) {
    let col = -1;
    for (let c = 0; c < colEnds.length; c++) {
      if (ev.startHour >= colEnds[c]) { col = c; break; }
    }
    if (col === -1) { col = colEnds.length; colEnds.push(0); }
    colEnds[col] = ev.endHour;
    withCol.push({ ...ev, col });
  }

  // Step 2: group into overlap clusters (events that transitively overlap)
  const clusters: WithCol[][] = [];
  for (const ev of withCol) {
    let placed = false;
    for (const cluster of clusters) {
      if (cluster.some((c) => c.startHour < ev.endHour && c.endHour > ev.startHour)) {
        cluster.push(ev);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([ev]);
  }

  // Step 3: for each cluster, cap visible columns
  const laid: LayoutEvent[] = [];
  const overflows: OverflowMarker[] = [];
  let clusterId = 0;

  for (const cluster of clusters) {
    clusterId++;
    const clusterCols = Math.max(...cluster.map((e) => e.col)) + 1;

    if (clusterCols <= MAX_VISIBLE_COLS) {
      // All fit — render all
      for (const ev of cluster) {
        laid.push({ ...ev, column: ev.col, totalColumns: clusterCols, clusterId });
      }
    } else {
      // Show first (MAX_VISIBLE_COLS - 1) columns, reserve last column for overflow badge
      const visibleCols = MAX_VISIBLE_COLS - 1;
      const visible = cluster.filter((e) => e.col < visibleCols);
      const hidden = cluster.filter((e) => e.col >= visibleCols);

      for (const ev of visible) {
        laid.push({ ...ev, column: ev.col, totalColumns: MAX_VISIBLE_COLS, clusterId });
      }

      if (hidden.length > 0) {
        // Overflow badge spans cluster's time range
        const minStart = Math.min(...hidden.map((e) => e.startHour));
        const maxEnd = Math.max(...hidden.map((e) => e.endHour));
        overflows.push({
          clusterId,
          startHour: minStart,
          endHour: maxEnd,
          date: cluster[0].date,
          hiddenEvents: hidden.map(({ col: _c, ...rest }) => rest),
          column: visibleCols,
          totalColumns: MAX_VISIBLE_COLS,
        });
      }
    }
  }

  return { laid, overflows };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function KalenderPage() {
  const { t } = useLang();
  const supabase = createClient();
  const today = useMemo(() => new Date(), []);
  const todayStr = formatDate(today);

  // Resolved translated arrays
  const MONTH_NAMES = useMemo(() => MONTH_NAME_KEYS.map((k) => t(k)), [t]);
  const WEEK_DAY_NAMES = useMemo(() => WEEK_DAY_NAME_KEYS.map((k) => t(k)), [t]);
  const EVENT_LABELS = useMemo(() => {
    const map: Record<EventType, string> = {} as Record<EventType, string>;
    (Object.keys(EVENT_LABEL_KEYS) as EventType[]).forEach((k) => {
      map[k] = t(EVENT_LABEL_KEYS[k]);
    });
    return map;
  }, [t]);

  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState<Record<string, boolean>>({
    tanam: true,
    panen: true,
    lingkungan: true,
    nutrisi: true,
    order: true,
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [overflowView, setOverflowView] = useState<OverflowMarker | null>(null);

  // Mini calendar month (can be navigated independently)
  const [miniYear, setMiniYear] = useState(today.getFullYear());
  const [miniMonth, setMiniMonth] = useState(today.getMonth());

  /* ---------- navigation ------------------------------------------- */

  const goToday = useCallback(() => setCurrentDate(new Date()), []);

  const goPrev = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "daily") d.setDate(d.getDate() - 1);
      else if (viewMode === "weekly") d.setDate(d.getDate() - 7);
      else d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, [viewMode]);

  const goNext = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "daily") d.setDate(d.getDate() + 1);
      else if (viewMode === "weekly") d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, [viewMode]);

  // Sync mini calendar when currentDate changes
  useEffect(() => {
    setMiniYear(currentDate.getFullYear());
    setMiniMonth(currentDate.getMonth());
  }, [currentDate]);

  /* ---------- data fetching ---------------------------------------- */

  // Compute the date range we need based on view
  const fetchRange = useMemo(() => {
    const d = new Date(currentDate);
    let start: Date;
    let end: Date;

    if (viewMode === "daily") {
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } else if (viewMode === "weekly") {
      const week = getWeekDays(d);
      start = week[0];
      end = week[6];
    } else {
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    }

    // Add buffer for weekly view that may span months
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() + 1);

    return { startDate: formatDate(start), endDate: formatDate(end) };
  }, [currentDate, viewMode]);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setLoading(true);
      const { startDate, endDate } = fetchRange;
      const allEvents: CalendarEvent[] = [];

      // planting_cycles -> tanam + panen
      const { data: cycles } = await supabase
        .from("planting_cycles")
        .select(
          "id, planted_at, harvested_at, crop_catalog_id, crop_catalog:crop_catalog_id(name_id)"
        )
        .or(
          `planted_at.gte.${startDate},planted_at.lte.${endDate}T23:59:59,harvested_at.gte.${startDate},harvested_at.lte.${endDate}T23:59:59`
        );

      if (cycles) {
        for (const c of cycles) {
          const cropName = (c as any).crop_catalog?.name_id ?? t("cal.plant_default");
          if (c.planted_at) {
            const d = toDateStr(c.planted_at);
            if (d >= startDate && d <= endDate) {
              const hour = extractHour(c.planted_at);
              allEvents.push({
                id: `tanam-${c.id}`,
                date: d,
                startHour: hour,
                endHour: hour + 1,
                type: "tanam",
                title: `${t("cal.tanam_prefix")} ${cropName}`,
              });
            }
          }
          if (c.harvested_at) {
            const d = toDateStr(c.harvested_at);
            if (d >= startDate && d <= endDate) {
              const hour = extractHour(c.harvested_at);
              allEvents.push({
                id: `panen-${c.id}`,
                date: d,
                startHour: hour,
                endHour: hour + 1,
                type: "panen",
                title: `${t("cal.panen_prefix")} ${cropName}`,
              });
            }
          }
        }
      }

      // environmental_logs -> lingkungan
      const { data: envLogs } = await supabase
        .from("environmental_logs")
        .select("id, recorded_at, rack, tier")
        .gte("recorded_at", startDate)
        .lte("recorded_at", `${endDate}T23:59:59`);

      if (envLogs) {
        for (const e of envLogs) {
          const hour = extractHour(e.recorded_at);
          allEvents.push({
            id: `env-${e.id}`,
            date: toDateStr(e.recorded_at),
            startHour: hour,
            endHour: hour + 1,
            type: "lingkungan",
            title: t("cal.env_log"),
            subtitle: e.rack
              ? `${t("cal.rack")} ${e.rack}${e.tier != null ? ` T${e.tier}` : ""}`
              : undefined,
          });
        }
      }

      // nutrient_logs -> nutrisi
      const { data: nutLogs } = await supabase
        .from("nutrient_logs")
        .select("id, mixed_at, formula_name")
        .gte("mixed_at", startDate)
        .lte("mixed_at", `${endDate}T23:59:59`);

      if (nutLogs) {
        for (const n of nutLogs) {
          const hour = extractHour(n.mixed_at);
          allEvents.push({
            id: `nut-${n.id}`,
            date: toDateStr(n.mixed_at),
            startHour: hour,
            endHour: hour + 1,
            type: "nutrisi",
            title: t("cal.nutrisi_label"),
            subtitle: n.formula_name || undefined,
          });
        }
      }

      // sales_orders -> order
      const { data: orders } = await supabase
        .from("sales_orders")
        .select(
          "id, order_date, status, grand_total, customer_id, customers:customer_id(name)"
        )
        .gte("order_date", startDate)
        .lte("order_date", `${endDate}T23:59:59`);

      if (orders) {
        for (const o of orders) {
          const custName = (o as any).customers?.name ?? "";
          const hour = extractHour(o.order_date);
          allEvents.push({
            id: `order-${o.id}`,
            date: toDateStr(o.order_date),
            startHour: hour,
            endHour: hour + 1,
            type: "order",
            title: t("cal.order_label"),
            subtitle: custName || undefined,
          });
        }
      }

      // visits -> kunjungan
      const { data: visits } = await supabase
        .from("visits")
        .select("id, code, visit_date, start_time, end_time, organization, purpose, group_size, visit_type, status")
        .gte("visit_date", startDate)
        .lte("visit_date", endDate)
        .neq("status", "cancelled");

      if (visits) {
        for (const v of visits) {
          const startHour = v.start_time
            ? parseInt(String(v.start_time).slice(0, 2), 10)
            : 9;
          const endHour = v.end_time
            ? parseInt(String(v.end_time).slice(0, 2), 10)
            : Math.min(startHour + 1, 22);
          allEvents.push({
            id: `visit-${v.id}`,
            date: toDateStr(v.visit_date),
            startHour: Number.isFinite(startHour) ? startHour : 9,
            endHour: Number.isFinite(endHour) && endHour > startHour ? endHour : startHour + 1,
            type: "kunjungan",
            title: v.organization,
            subtitle: `${v.purpose} · ${v.group_size} ${t("cal.purpose_orang")}`,
            href: `/kunjungan/${v.id}`,
          });
        }
      }

      // research_projects -> riset (milestones: mulai + akhir)
      const { data: researches } = await supabase
        .from("research_projects")
        .select("id, code, title, researcher_name, proposed_start, proposed_end, actual_start, actual_end, status")
        .or(
          `proposed_start.gte.${startDate},proposed_start.lte.${endDate},proposed_end.gte.${startDate},proposed_end.lte.${endDate},actual_start.gte.${startDate},actual_start.lte.${endDate},actual_end.gte.${startDate},actual_end.lte.${endDate}`
        )
        .neq("status", "cancelled");

      if (researches) {
        for (const r of researches) {
          const startDay = (r.actual_start as string | null) ?? (r.proposed_start as string | null);
          const endDay = (r.actual_end as string | null) ?? (r.proposed_end as string | null);
          if (startDay) {
            const ds = toDateStr(startDay);
            if (ds >= startDate && ds <= endDate) {
              allEvents.push({
                id: `riset-start-${r.id}`,
                date: ds,
                startHour: 8,
                endHour: 9,
                type: "riset",
                title: `${t("cal.start_prefix")}${r.title}`,
                subtitle: `${r.code} · ${r.researcher_name}`,
                href: `/riset/${r.id}`,
              });
            }
          }
          if (endDay) {
            const de = toDateStr(endDay);
            if (de >= startDate && de <= endDate) {
              allEvents.push({
                id: `riset-end-${r.id}`,
                date: de,
                startHour: 16,
                endHour: 17,
                type: "riset",
                title: `${t("cal.deadline_prefix")}${r.title}`,
                subtitle: `${r.code} · ${r.researcher_name}`,
                href: `/riset/${r.id}`,
              });
            }
          }
        }
      }

      if (!cancelled) {
        setEvents(allEvents);
        setLoading(false);
      }
    }

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, [fetchRange]);

  /* ---------- derived data ----------------------------------------- */

  const filteredEvents = useMemo(
    () => events.filter((ev) => filters[ev.type]),
    [events, filters]
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of filteredEvents) {
      (map[ev.date] ??= []).push(ev);
    }
    return map;
  }, [filteredEvents]);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const todayEvents = useMemo(
    () => eventsByDate[todayStr] ?? [],
    [eventsByDate, todayStr]
  );

  /* ---------- mini calendar data ----------------------------------- */

  const miniDays = useMemo(
    () => getDaysInMonth(miniYear, miniMonth),
    [miniYear, miniMonth]
  );

  const miniFirstDayOffset = useMemo(() => {
    return new Date(miniYear, miniMonth, 1).getDay(); // 0=Sun, which aligns with S M T W T F S
  }, [miniYear, miniMonth]);

  function miniPrev() {
    if (miniMonth === 0) {
      setMiniMonth(11);
      setMiniYear((y) => y - 1);
    } else {
      setMiniMonth((m) => m - 1);
    }
  }

  function miniNext() {
    if (miniMonth === 11) {
      setMiniMonth(0);
      setMiniYear((y) => y + 1);
    } else {
      setMiniMonth((m) => m + 1);
    }
  }

  function isInCurrentWeek(d: Date): boolean {
    if (viewMode !== "weekly") return false;
    const weekStart = weekDays[0];
    const weekEnd = weekDays[6];
    return d >= weekStart && d <= weekEnd;
  }

  /* ---------- filter toggle ---------------------------------------- */

  function toggleFilter(type: string) {
    setFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  /* ---------- current time line ------------------------------------ */

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const currentTimeTop = useMemo(() => {
    const h = now.getHours();
    const m = now.getMinutes();
    if (h < START_HOUR || h >= END_HOUR) return null;
    return ((h - START_HOUR) * 60 + m) * (60 / 60); // 60px per hour
  }, [now]);

  /* ---------- header text ------------------------------------------ */

  const headerLabel = useMemo(() => {
    if (viewMode === "daily") return formatShortDate(currentDate, MONTH_NAMES);
    if (viewMode === "weekly") {
      const start = weekDays[0];
      const end = weekDays[6];
      if (start.getMonth() === end.getMonth()) {
        return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} - ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [viewMode, currentDate, weekDays, MONTH_NAMES]);

  /* ================================================================== */
  /*  RENDER                                                             */
  /* ================================================================== */

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* ---- LEFT SIDEBAR ---- */}
      <aside className="hidden md:flex w-[280px] shrink-0 flex-col border-r border-border/50 bg-card p-4 space-y-6 overflow-y-auto">
        {/* Mini calendar */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">
              {MONTH_NAMES[miniMonth]} {miniYear}
            </span>
            <div className="flex gap-1">
              <button
                onClick={miniPrev}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary/50 text-muted-foreground"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                onClick={miniNext}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary/50 text-muted-foreground"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {MINI_DAY_HEADERS.map((d, i) => (
              <div
                key={`mh-${i}`}
                className="h-7 w-7 flex items-center justify-center text-[10px] text-muted-foreground font-medium"
              >
                {d}
              </div>
            ))}

            {Array.from({ length: miniFirstDayOffset }).map((_, i) => (
              <div key={`me-${i}`} className="h-7 w-7" />
            ))}

            {miniDays.map((d) => {
              const ds = formatDate(d);
              const isToday = ds === todayStr;
              const isSelected = isSameDay(d, currentDate);
              const inWeek = isInCurrentWeek(d);

              return (
                <button
                  key={ds}
                  onClick={() => setCurrentDate(new Date(d))}
                  className={cn(
                    "h-7 w-7 rounded-full text-[11px] flex items-center justify-center cursor-pointer transition-colors",
                    isToday && "bg-primary text-white font-bold",
                    !isToday && isSelected && "bg-secondary text-foreground",
                    !isToday && !isSelected && inWeek && "bg-secondary/40 text-foreground",
                    !isToday && !isSelected && !inWeek && "text-muted-foreground hover:bg-secondary/30"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Meeting reminder — next upcoming event */}
        <div>
          {todayEvents.length === 0 ? (
            <div className="rounded-xl bg-secondary/50 border border-border/40 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                {t("cal.no_event_today")}
              </p>
            </div>
          ) : (
            <div
              onClick={() => setSelectedEvent(todayEvents[0])}
              className="rounded-xl bg-gradient-to-br from-[oklch(0.45_0.12_180)] to-[oklch(0.40_0.14_190)] p-4 cursor-pointer hover:brightness-110 transition-all text-white shadow-lg shadow-[oklch(0.40_0.14_190)/0.3]"
            >
              <p className="text-[10px] opacity-80 uppercase tracking-wider mb-1">
                {t("cal.reminder")}
              </p>
              <div className="flex items-center gap-1.5 mb-2">
                <span>{EVENT_ICONS[todayEvents[0].type]}</span>
                <h4 className="text-sm font-semibold">
                  {todayEvents[0].title}
                </h4>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] opacity-90">
                <Clock className="size-3" />
                <span>
                  {formatHour(todayEvents[0].startHour)} -{" "}
                  {formatHour(todayEvents[0].endHour)}
                </span>
              </div>
              {todayEvents.length > 1 && (
                <p className="text-[10px] opacity-70 mt-2 border-t border-white/20 pt-2">
                  +{todayEvents.length - 1} {t("cal.event_others")}
                </p>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Filters */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t("cal.filter")}
          </h3>
          <div className="space-y-2">
            {(Object.keys(EVENT_LABELS) as EventType[]).map((type) => (
              <label
                key={type}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={filters[type]}
                  onChange={() => toggleFilter(type)}
                  className={cn(
                    "h-3.5 w-3.5 rounded border-border cursor-pointer",
                    FILTER_CHECK_COLORS[type]
                  )}
                />
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    EVENT_DOT_COLORS[type]
                  )}
                />
                <span className="text-xs text-foreground group-hover:text-foreground/80">
                  {EVENT_LABELS[type]}
                </span>
              </label>
            ))}
          </div>
        </div>
      </aside>

      {/* ---- MAIN AREA ---- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b border-border/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-secondary/50 text-muted-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <h2 className="text-sm font-semibold text-foreground min-w-[180px] text-center">
              {headerLabel}
            </h2>
            <button
              onClick={goNext}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-secondary/50 text-muted-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToday}
              className="h-7 text-[11px] ml-1"
            >
              {t("cal.today")}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-md border border-border/50 overflow-hidden">
              {(
                [
                  ["daily", t("cal.daily")],
                  ["weekly", t("cal.weekly")],
                  ["monthly", t("cal.monthly")],
                ] as [ViewMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "h-8 px-3 text-[12px] font-medium transition-colors",
                    viewMode === mode
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <RoleGate roles={["admin", "operator"]} fallback={null}>
              <Button
                size="sm"
                className="h-8 text-[12px] gap-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-zinc-900 font-semibold shadow-md shadow-amber-500/20"
                onClick={() => toast.info(t("common.coming_soon"))}
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">{t("cal.create_event")}</span>
              </Button>
            </RoleGate>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground animate-pulse">
              {t("cal.loading")}
            </p>
          </div>
        )}

        {/* ---- VIEW: WEEKLY ---- */}
        {viewMode === "weekly" && !loading && (
          <div className="flex-1 overflow-y-auto">
            {/* Week column headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/30 sticky top-0 z-[5] bg-background/95 backdrop-blur-sm">
              <div className="h-16 flex items-end justify-end pr-2 pb-1">
                <span className="text-[9px] text-muted-foreground">GMT+07</span>
              </div>
              {weekDays.map((d, i) => {
                const isToday = isSameDay(d, today);
                return (
                  <div
                    key={i}
                    className={cn(
                      "h-16 flex flex-col items-center justify-center border-l border-border/20 transition-colors",
                      isToday && "bg-primary/10"
                    )}
                  >
                    <span className={cn(
                      "text-[10px] uppercase tracking-wider",
                      isToday ? "text-primary font-medium" : "text-muted-foreground"
                    )}>
                      {WEEK_DAY_NAMES[i]}
                    </span>
                    <span
                      className={cn(
                        "text-2xl font-bold mt-0.5",
                        isToday
                          ? "text-primary"
                          : "text-foreground"
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="relative grid grid-cols-[60px_repeat(7,1fr)]">
              {/* Hour row backgrounds */}
              {HOURS.map((h) => (
                <div key={`row-${h}`} className="contents">
                  <div className="h-[60px] flex items-start justify-end pr-2 pt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {formatHour(h)}
                    </span>
                  </div>
                  {weekDays.map((_, di) => (
                    <div key={`bg-${h}-${di}`} className="h-[60px] border-l border-t border-border/20" />
                  ))}
                </div>
              ))}

              {/* Event overlay — one container per day column */}
              {weekDays.map((d, di) => {
                const ds = formatDate(d);
                const dayEvents = filteredEvents.filter((ev) => ev.date === ds);
                const { laid, overflows } = layoutEventsWithOverflow(dayEvents);
                const firstHour = HOURS[0];

                return (
                  <div
                    key={`events-${di}`}
                    className="absolute"
                    style={{
                      left: `calc(60px + ${di} * (100% - 60px) / 7)`,
                      width: `calc((100% - 60px) / 7)`,
                      top: 0,
                      bottom: 0,
                    }}
                  >
                    {laid.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                        }}
                        className={cn(
                          "absolute rounded-lg border-l-[3px] px-2 py-1.5 text-[10px] overflow-hidden cursor-pointer hover:brightness-110 hover:shadow-lg transition-all z-[2] backdrop-blur-sm",
                          EVENT_STYLES[ev.type]
                        )}
                        style={{
                          top: `${(ev.startHour - firstHour) * 60 + 2}px`,
                          height: `${Math.max(1, ev.endHour - ev.startHour) * 60 - 4}px`,
                          left: `calc(${(ev.column / ev.totalColumns) * 100}% + 2px)`,
                          width: `calc(${(1 / ev.totalColumns) * 100}% - 4px)`,
                        }}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="opacity-80">{EVENT_ICONS[ev.type]}</span>
                          <div className="font-semibold truncate text-[11px]">{ev.title}</div>
                        </div>
                        <div className="opacity-70 truncate flex items-center gap-1">
                          <Clock className="size-2.5" />
                          {formatHour(ev.startHour)} - {formatHour(ev.endHour)}
                        </div>
                      </div>
                    ))}

                    {/* Overflow badges — "+N lainnya" */}
                    {overflows.map((ov) => (
                      <button
                        key={`ov-${ov.clusterId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOverflowView(ov);
                        }}
                        className="absolute rounded-lg bg-muted/60 hover:bg-muted border border-border/60 px-2 py-1.5 text-[10px] overflow-hidden cursor-pointer transition-all z-[2] backdrop-blur-sm flex flex-col items-center justify-center text-foreground font-medium"
                        style={{
                          top: `${(ov.startHour - firstHour) * 60 + 2}px`,
                          height: `${Math.max(1, ov.endHour - ov.startHour) * 60 - 4}px`,
                          left: `calc(${(ov.column / ov.totalColumns) * 100}% + 2px)`,
                          width: `calc(${(1 / ov.totalColumns) * 100}% - 4px)`,
                        }}
                      >
                        <span className="text-[14px] font-bold leading-none">+{ov.hiddenEvents.length}</span>
                        <span className="text-[9px] opacity-70 mt-0.5">{t("cal.others_more")}</span>
                      </button>
                    ))}
                  </div>
                );
              })}

              {/* Current time red line */}
              {currentTimeTop !== null && (
                <div
                  className="absolute left-[60px] right-0 h-[2px] bg-red-500 z-[3] pointer-events-none"
                  style={{ top: `${currentTimeTop}px` }}
                >
                  <div className="absolute -left-1.5 -top-[3px] h-2 w-2 rounded-full bg-red-500" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- VIEW: DAILY ---- */}
        {viewMode === "daily" && !loading && (
          <div className="flex-1 overflow-y-auto">
            <div className="relative">
              {HOURS.map((h) => {
                const ds = formatDate(currentDate);
                const hourEvents = (eventsByDate[ds] ?? []).filter(
                  (ev) => ev.startHour === h
                );
                return (
                  <div
                    key={`dh-${h}`}
                    className="grid grid-cols-[60px_1fr] min-h-[60px]"
                  >
                    <div className="flex items-start justify-end pr-2 pt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {formatHour(h)}
                      </span>
                    </div>
                    <div className="border-l border-t border-border/20 relative min-h-[60px] p-0.5">
                      {hourEvents.map((ev) => {
                        const duration = Math.max(
                          1,
                          ev.endHour - ev.startHour
                        );
                        return (
                          <div
                            key={ev.id}
                            onClick={() => setSelectedEvent(ev)}
                            className={cn(
                              "rounded-md border-l-2 px-3 py-1.5 text-[11px] mb-0.5 cursor-pointer hover:brightness-110 transition-all",
                              EVENT_STYLES[ev.type]
                            )}
                            style={{
                              minHeight: `${duration * 60 - 4}px`,
                            }}
                          >
                            <div className="flex items-center gap-1.5 font-medium">
                              {EVENT_ICONS[ev.type]}
                              {ev.title}
                            </div>
                            {ev.subtitle && (
                              <div className="opacity-70 mt-0.5">
                                {ev.subtitle}
                              </div>
                            )}
                            <div className="opacity-60 mt-0.5">
                              {formatHour(ev.startHour)} -{" "}
                              {formatHour(ev.endHour)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Current time red line */}
              {isSameDay(currentDate, today) && currentTimeTop !== null && (
                <div
                  className="absolute left-[60px] right-0 h-[2px] bg-red-500 z-[3] pointer-events-none"
                  style={{ top: `${currentTimeTop}px` }}
                >
                  <div className="absolute -left-1.5 -top-[3px] h-2 w-2 rounded-full bg-red-500" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- VIEW: MONTHLY ---- */}
        {viewMode === "monthly" && !loading && (
          <MonthlyView
            currentDate={currentDate}
            today={today}
            todayStr={todayStr}
            eventsByDate={eventsByDate}
            onSelectDay={(d) => {
              setCurrentDate(d);
              setViewMode("daily");
            }}
          />
        )}

        {/* Event detail dialog */}
        <Dialog
          open={selectedEvent !== null}
          onOpenChange={(v) => {
            if (!v) setSelectedEvent(null);
          }}
        >
          <DialogContent
            showCloseButton={true}
            className="sm:max-w-[400px] bg-card border-border/50 p-0 gap-0"
          >
            {selectedEvent && (
              <>
                <DialogHeader className="px-5 pt-5 pb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-3 w-3 rounded-full",
                        EVENT_DOT_COLORS[selectedEvent.type]
                      )}
                    />
                    <DialogTitle className="text-base">
                      {selectedEvent.title}
                    </DialogTitle>
                  </div>
                </DialogHeader>
                <Separator className="bg-border/30" />
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2 text-[13px]">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {formatHour(selectedEvent.startHour)} -{" "}
                      {formatHour(selectedEvent.endHour)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {new Date(selectedEvent.date).toLocaleDateString(
                        "id-ID",
                        {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <Badge
                      className={cn(
                        "text-[10px]",
                        EVENT_STYLES[selectedEvent.type]
                      )}
                    >
                      {EVENT_LABELS[selectedEvent.type]}
                    </Badge>
                  </div>
                  {selectedEvent.subtitle && (
                    <div className="text-[13px] text-muted-foreground">
                      {selectedEvent.subtitle}
                    </div>
                  )}
                  {selectedEvent.href && (
                    <div className="pt-2">
                      <Button
                        asChild
                        className="w-full h-10 bg-primary hover:bg-primary/90 text-white"
                      >
                        <Link
                          href={selectedEvent.href}
                          className="inline-flex items-center justify-center gap-1.5"
                          onClick={() => setSelectedEvent(null)}
                        >
                          {t("common.open_detail")}
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Overflow events dialog — "+N lainnya" */}
        <Dialog
          open={overflowView !== null}
          onOpenChange={(v) => {
            if (!v) setOverflowView(null);
          }}
        >
          <DialogContent showCloseButton={true} className="sm:max-w-[440px] bg-card border-border/50 p-0 gap-0">
            {overflowView && (
              <>
                <DialogHeader className="px-5 pt-5 pb-3">
                  <DialogTitle className="text-base">
                    {overflowView.hiddenEvents.length} {t("cal.overflow_other")}
                  </DialogTitle>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    {new Date(overflowView.date).toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {" • "}
                    {formatHour(overflowView.startHour)} - {formatHour(overflowView.endHour)}
                  </p>
                </DialogHeader>
                <Separator className="bg-border/30" />
                <div className="px-5 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
                  {[...overflowView.hiddenEvents]
                    .sort((a, b) => a.startHour - b.startHour)
                    .map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => {
                          setOverflowView(null);
                          setSelectedEvent(ev);
                        }}
                        className={cn(
                          "w-full text-left rounded-lg border-l-[3px] px-3 py-2 transition-all hover:brightness-110",
                          EVENT_STYLES[ev.type]
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="opacity-80">{EVENT_ICONS[ev.type]}</span>
                          <span className="font-semibold text-[13px]">{ev.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] opacity-80">
                          <Clock className="size-3" />
                          {formatHour(ev.startHour)} - {formatHour(ev.endHour)}
                          {ev.subtitle && <span className="opacity-70">• {ev.subtitle}</span>}
                        </div>
                      </button>
                    ))}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Mobile filter legend (visible on small screens) */}
        <div className="md:hidden border-t border-border/30 px-3 py-2 flex flex-wrap gap-2">
          {(Object.keys(EVENT_LABELS) as EventType[]).map((type) => (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-colors",
                filters[type]
                  ? "border-border/50 text-foreground"
                  : "border-transparent text-muted-foreground opacity-40"
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full", EVENT_DOT_COLORS[type])}
              />
              {EVENT_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Monthly View Component                                             */
/* ------------------------------------------------------------------ */

function MonthlyView({
  currentDate,
  today,
  todayStr,
  eventsByDate,
  onSelectDay,
}: {
  currentDate: Date;
  today: Date;
  todayStr: string;
  eventsByDate: Record<string, CalendarEvent[]>;
  onSelectDay: (d: Date) => void;
}) {
  const { t } = useLang();
  const WEEK_DAY_NAMES = useMemo(() => WEEK_DAY_NAME_KEYS.map((k) => t(k)), [t]);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const firstDayOffset = useMemo(() => {
    const jsDay = new Date(year, month, 1).getDay(); // 0=Sun
    return jsDay === 0 ? 6 : jsDay - 1; // Monday start
  }, [year, month]);

  const trailingCells = useMemo(() => {
    const total = firstDayOffset + days.length;
    const remainder = total % 7;
    return remainder === 0 ? 0 : 7 - remainder;
  }, [firstDayOffset, days.length]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK_DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-[10px] text-muted-foreground uppercase text-center py-1 font-medium"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {/* Leading empty cells */}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div
            key={`lead-${i}`}
            className="rounded-lg border border-border/20 bg-muted/20 p-1.5 min-h-[80px]"
          />
        ))}

        {/* Day cells */}
        {days.map((d) => {
          const ds = formatDate(d);
          const isToday = ds === todayStr;
          const dayEvents = eventsByDate[ds] ?? [];
          const showDots = dayEvents.slice(0, 5);
          const extra = dayEvents.length - 5;

          return (
            <div
              key={ds}
              onClick={() => onSelectDay(new Date(d))}
              className={cn(
                "rounded-lg border p-1.5 min-h-[80px] cursor-pointer transition-colors",
                isToday
                  ? "border-primary bg-primary/10"
                  : "border-border/20 bg-card hover:bg-secondary/20"
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  isToday
                    ? "text-primary"
                    : "text-foreground"
                )}
              >
                {d.getDate()}
              </span>

              <div className="mt-1 flex flex-wrap gap-0.5">
                {showDots.map((ev) => (
                  <span
                    key={ev.id}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      EVENT_DOT_COLORS[ev.type]
                    )}
                  />
                ))}
                {extra > 0 && (
                  <span className="text-[9px] leading-none text-muted-foreground ml-0.5">
                    +{extra}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Trailing empty cells */}
        {Array.from({ length: trailingCells }).map((_, i) => (
          <div
            key={`trail-${i}`}
            className="rounded-lg border border-border/20 bg-muted/20 p-1.5 min-h-[80px]"
          />
        ))}
      </div>
    </div>
  );
}
