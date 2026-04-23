import type { VisitStatus, VisitType } from "@/lib/types/database";

/**
 * Meta untuk visit status. `label` = ID fallback, `labelKey` untuk t().
 */
export const VISIT_STATUS_META: Record<
  VisitStatus,
  { label: string; labelKey: string; tone: string; dot: string }
> = {
  scheduled: { label: "Terjadwal",   labelKey: "visit_status.scheduled", tone: "bg-amber-400/10 text-amber-400 border-amber-400/30",        dot: "bg-amber-400" },
  confirmed: { label: "Dikonfirmasi",labelKey: "visit_status.confirmed", tone: "bg-blue-400/10 text-blue-400 border-blue-400/30",            dot: "bg-blue-400" },
  ongoing:   { label: "Berlangsung", labelKey: "visit_status.ongoing",   tone: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",  dot: "bg-emerald-400" },
  completed: { label: "Selesai",     labelKey: "visit_status.completed", tone: "bg-teal-400/10 text-teal-400 border-teal-400/30",            dot: "bg-teal-400" },
  cancelled: { label: "Dibatalkan",  labelKey: "visit_status.cancelled", tone: "bg-rose-500/10 text-rose-400 border-rose-500/30",            dot: "bg-rose-500" },
  no_show:   { label: "Tidak Hadir", labelKey: "visit_status.no_show",   tone: "bg-zinc-400/10 text-zinc-400 border-zinc-400/30",            dot: "bg-zinc-400" },
};

export const VISIT_TYPE_META: Record<VisitType, { label: string; labelKey: string; shortLabel: string; shortLabelKey: string; emoji: string; color: string }> = {
  tour:         { label: "Tur Umum",          labelKey: "visit_type.tour",         shortLabel: "Tur",        shortLabelKey: "visit_type_short.tour",         emoji: "🌱", color: "text-emerald-400" },
  meeting:      { label: "Rapat",             labelKey: "visit_type.meeting",      shortLabel: "Rapat",      shortLabelKey: "visit_type_short.meeting",      emoji: "💼", color: "text-blue-400" },
  field_trip:   { label: "Kunjungan Belajar", labelKey: "visit_type.field_trip",   shortLabel: "Belajar",    shortLabelKey: "visit_type_short.field_trip",   emoji: "🎓", color: "text-violet-400" },
  media:        { label: "Media/Pers",        labelKey: "visit_type.media",        shortLabel: "Media",      shortLabelKey: "visit_type_short.media",        emoji: "📸", color: "text-pink-400" },
  partnership:  { label: "Mitra/Partnership", labelKey: "visit_type.partnership",  shortLabel: "Mitra",      shortLabelKey: "visit_type_short.partnership",  emoji: "🤝", color: "text-amber-400" },
  training:     { label: "Pelatihan",         labelKey: "visit_type.training",     shortLabel: "Pelatihan",  shortLabelKey: "visit_type_short.training",     emoji: "🧪", color: "text-teal-400" },
  government:   { label: "Pemerintahan",      labelKey: "visit_type.government",   shortLabel: "Pemerintah", shortLabelKey: "visit_type_short.government",   emoji: "🏛️", color: "text-sky-400" },
  other:        { label: "Lainnya",           labelKey: "visit_type.other",        shortLabel: "Lainnya",    shortLabelKey: "visit_type_short.other",        emoji: "✨", color: "text-muted-foreground" },
};

export const VISIT_AREAS = [
  "Ruang Produksi",
  "Ruang Semai",
  "Ruang Kontrol",
  "Lab Nutrisi",
  "Gudang",
  "Area Packing",
  "Ruang Presentasi",
] as const;

/** i18n keys untuk areas — gunakan t(`visit_area.<value>`). */
export const VISIT_AREA_KEY = Object.fromEntries(
  VISIT_AREAS.map((a) => [a, `visit_area.${a}`])
) as Record<(typeof VISIT_AREAS)[number], string>;
