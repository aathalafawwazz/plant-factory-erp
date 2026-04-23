"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Sprout, Scissors, ShoppingCart,
  CalendarDays, UserCheck, FlaskConical, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useLang } from "@/lib/i18n";

export type ScheduleEventType =
  | "harvest" | "plant" | "sale" | "event" | "visit" | "research";

export interface CalendarMarker {
  date: string;           // YYYY-MM-DD
  type: ScheduleEventType;
  count?: number;
}

export interface UpcomingEvent {
  id: string;
  type: ScheduleEventType;
  title: string;
  description?: string;
  date: string;           // ISO date
  start_time?: string | null;  // "HH:mm" or "HH:mm:ss"
  end_time?: string | null;
  meta?: string;
  href?: string;
}

const TYPE_META: Record<ScheduleEventType, {
  icon: typeof Sprout;
  labelKey: string;
  /** Card bg + border gradient */
  card: string;
  /** Icon pill bg + text */
  pill: string;
  badge: string;
  dot: string;
}> = {
  harvest:  { icon: Scissors,     labelKey: "dmc.label_harvest",  card: "bg-amber-400/10 border-amber-400/30",    pill: "bg-amber-400/15 text-amber-400",    badge: "bg-amber-400/20 text-amber-300 border-amber-400/40",      dot: "bg-amber-400" },
  plant:    { icon: Sprout,       labelKey: "dmc.label_plant",    card: "bg-emerald-400/10 border-emerald-400/30", pill: "bg-emerald-400/15 text-emerald-400", badge: "bg-emerald-400/20 text-emerald-300 border-emerald-400/40", dot: "bg-emerald-400" },
  sale:     { icon: ShoppingCart, labelKey: "dmc.label_sale",     card: "bg-primary/10 border-primary/30",         pill: "bg-primary/15 text-primary",         badge: "bg-primary/20 text-primary border-primary/40",             dot: "bg-primary" },
  event:    { icon: CalendarDays, labelKey: "dmc.label_event",    card: "bg-purple-400/10 border-purple-400/30",   pill: "bg-purple-400/15 text-purple-400",   badge: "bg-purple-400/20 text-purple-300 border-purple-400/40",    dot: "bg-purple-400" },
  visit:    { icon: UserCheck,    labelKey: "dmc.label_visit",    card: "bg-pink-400/10 border-pink-400/30",       pill: "bg-pink-400/15 text-pink-400",       badge: "bg-pink-400/20 text-pink-300 border-pink-400/40",          dot: "bg-pink-400" },
  research: { icon: FlaskConical, labelKey: "dmc.label_research", card: "bg-violet-400/10 border-violet-400/30",   pill: "bg-violet-400/15 text-violet-400",   badge: "bg-violet-400/20 text-violet-300 border-violet-400/40",    dot: "bg-violet-400" },
};

// Day abbr keys in Date.getDay() order (Sunday first).
const DAY_ABBR_KEYS = ["day_short.sun", "day_short.mon", "day_short.tue", "day_short.wed", "day_short.thu", "day_short.fri", "day_short.sat"];

interface Props {
  markers: CalendarMarker[];
  upcoming?: UpcomingEvent[];
  /** Banyaknya hari yang tampil di strip (default 5). */
  stripSize?: number;
}

export function DashboardMiniCalendar({ markers, upcoming = [], stripSize = 5 }: Props) {
  const { t, lang } = useLang();
  const today = new Date();
  const todayISO = toISO(today);

  // Selected date for filtering events
  const [selectedISO, setSelectedISO] = useState<string>(todayISO);

  // Anchor date = leftmost day of strip. Centered on selected initially.
  const [anchor, setAnchor] = useState<Date>(() => {
    const a = new Date(today);
    a.setDate(today.getDate() - Math.floor(stripSize / 2));
    return a;
  });

  // Strip days
  const stripDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < stripSize; i++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      days.push(d);
    }
    return days;
  }, [anchor, stripSize]);

  // Marker lookup
  const markerMap = useMemo(() => {
    const m = new Map<string, Set<ScheduleEventType>>();
    for (const mk of markers) {
      if (!m.has(mk.date)) m.set(mk.date, new Set());
      m.get(mk.date)!.add(mk.type);
    }
    return m;
  }, [markers]);

  // Events for selected date — sorted by start_time
  const eventsForSelected = useMemo(() => {
    return upcoming
      .filter((e) => e.date.slice(0, 10) === selectedISO)
      .sort((a, b) => {
        const ta = (a.start_time ?? "00:00").slice(0, 5);
        const tb = (b.start_time ?? "00:00").slice(0, 5);
        return ta.localeCompare(tb);
      });
  }, [upcoming, selectedISO]);

  // Month label — show the month of selected date for context
  const monthLabel = new Date(selectedISO).toLocaleDateString(lang === "en" ? "en-US" : "id-ID", {
    month: "long", year: "numeric",
  });

  function shiftStrip(delta: number) {
    const next = new Date(anchor);
    next.setDate(anchor.getDate() + delta);
    setAnchor(next);
  }

  function shiftMonth(delta: number) {
    const d = new Date(selectedISO);
    d.setMonth(d.getMonth() + delta);
    const iso = toISO(d);
    setSelectedISO(iso);
    const newAnchor = new Date(d);
    newAnchor.setDate(d.getDate() - Math.floor(stripSize / 2));
    setAnchor(newAnchor);
  }

  function goToday() {
    setSelectedISO(todayISO);
    const a = new Date(today);
    a.setDate(today.getDate() - Math.floor(stripSize / 2));
    setAnchor(a);
  }

  return (
    <div className="rounded-lg border border-border/40 bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-primary" />
          {t("dmc.schedule")}
        </h3>
        <Link
          href="/kalender"
          className="text-[11px] px-2.5 py-1 rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          {t("dmc.view_all")}
        </Link>
      </div>

      {/* Month navigator */}
      <div className="px-4 pt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label={t("dmc.prev_month")}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={goToday}
          className="flex-1 px-3 py-1 rounded-md hover:bg-secondary text-center text-[13px] font-medium text-foreground capitalize transition-colors"
          title={t("dmc.click_today")}
        >
          {monthLabel}
        </button>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label={t("dmc.next_month")}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day strip */}
      <div className="px-3 py-3 flex items-stretch gap-1">
        <button
          type="button"
          onClick={() => shiftStrip(-stripSize)}
          aria-label={t("dmc.shift_back")}
          className="h-auto w-7 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${stripSize}, minmax(0, 1fr))` }}>
          {stripDays.map((d) => {
            const iso = toISO(d);
            const isSelected = iso === selectedISO;
            const isToday = iso === todayISO;
            const types = markerMap.get(iso);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedISO(iso)}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg py-2 px-1 transition-all relative",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "hover:bg-secondary/60 text-foreground"
                )}
              >
                <span className={cn(
                  "text-[10px] font-medium uppercase tracking-wider",
                  isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {t(DAY_ABBR_KEYS[d.getDay()])}
                </span>
                <span className={cn(
                  "text-[15px] font-semibold tabular-nums mt-0.5",
                  isToday && !isSelected && "text-primary"
                )}>
                  {d.getDate()}
                </span>
                {types && types.size > 0 && (
                  <span className="flex gap-0.5 mt-1">
                    {Array.from(types).slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className={cn(
                          "h-1 w-1 rounded-full",
                          isSelected ? "bg-primary-foreground/70" : TYPE_META[t].dot
                        )}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => shiftStrip(stripSize)}
          aria-label={t("dmc.shift_forward")}
          className="h-auto w-7 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Event cards */}
      <div className="border-t border-border/30 px-4 py-3 space-y-2 max-h-[420px] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            {isSameISO(selectedISO, todayISO) ? t("dmc.today") : fmtLongDate(selectedISO, lang)}
          </p>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {eventsForSelected.length} {t("dmc.activities")}
          </span>
        </div>

        {eventsForSelected.length === 0 ? (
          <div className="py-6 text-center">
            <Clock className="h-6 w-6 mx-auto text-muted-foreground/40 mb-1.5" />
            <p className="text-[12px] text-muted-foreground">{t("dmc.no_today")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {eventsForSelected.map((ev) => (
              <ScheduleCard key={ev.id} event={ev} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================
function ScheduleCard({ event }: { event: UpcomingEvent }) {
  const { t } = useLang();
  const meta = TYPE_META[event.type];
  const Icon = meta.icon;
  const timeLabel = formatTimeRange(event.start_time, event.end_time);

  const content = (
    <div className={cn("rounded-lg border p-3", meta.card)}>
      <div className="flex items-start gap-2.5">
        <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", meta.pill)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground truncate">{event.title}</p>
          {timeLabel && (
            <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{timeLabel}</p>
          )}
          {event.description && (
            <p className="text-[11px] text-muted-foreground/90 mt-1 truncate">{event.description}</p>
          )}
          <div className="flex items-center justify-between mt-2 gap-2">
            {event.meta ? (
              <span className="text-[10px] text-muted-foreground tabular-nums">{event.meta}</span>
            ) : <span />}
            <span className={cn(
              "text-[9px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold",
              meta.badge
            )}>
              {t(meta.labelKey)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <li>
      {event.href ? (
        <Link href={event.href} className="block hover:opacity-90 transition-opacity">
          {content}
        </Link>
      ) : content}
    </li>
  );
}

// ============================================================
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameISO(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function fmtLongDate(iso: string, lang: "id" | "en"): string {
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "id-ID", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function formatTimeRange(start?: string | null, end?: string | null): string {
  const s = (start ?? "").slice(0, 5);
  const e = (end ?? "").slice(0, 5);
  if (s && e) return `${s} – ${e}`;
  if (s) return s;
  return "";
}
