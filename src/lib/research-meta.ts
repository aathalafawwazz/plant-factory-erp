import type { ResearchStatus, ResearchType } from "@/lib/types/database";

/**
 * Meta untuk research status. `label` = ID fallback, `labelKey` untuk t().
 */
export const RESEARCH_STATUS_META: Record<
  ResearchStatus,
  { label: string; labelKey: string; tone: string; dot: string }
> = {
  proposed:  { label: "Diajukan",   labelKey: "research_status.proposed",  tone: "bg-amber-400/10 text-amber-400 border-amber-400/30",        dot: "bg-amber-400" },
  approved:  { label: "Disetujui",  labelKey: "research_status.approved",  tone: "bg-blue-400/10 text-blue-400 border-blue-400/30",           dot: "bg-blue-400" },
  active:    { label: "Berjalan",   labelKey: "research_status.active",    tone: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30", dot: "bg-emerald-400" },
  paused:    { label: "Ditunda",    labelKey: "research_status.paused",    tone: "bg-zinc-400/10 text-zinc-400 border-zinc-400/30",           dot: "bg-zinc-400" },
  completed: { label: "Selesai",    labelKey: "research_status.completed", tone: "bg-teal-400/10 text-teal-400 border-teal-400/30",           dot: "bg-teal-400" },
  cancelled: { label: "Dibatalkan", labelKey: "research_status.cancelled", tone: "bg-rose-500/10 text-rose-400 border-rose-500/30",           dot: "bg-rose-500" },
};

export const RESEARCH_TYPE_LABEL: Record<ResearchType, string> = {
  skripsi:   "Skripsi",
  tesis:     "Tesis",
  disertasi: "Disertasi",
  dosen:     "Dosen",
  eksternal: "Eksternal",
  internal:  "Internal",
};

/** i18n key untuk research_type, gunakan `research_type.<value>`. */
export const RESEARCH_TYPE_KEY: Record<ResearchType, string> = {
  skripsi:   "research_type.skripsi",
  tesis:     "research_type.tesis",
  disertasi: "research_type.disertasi",
  dosen:     "research_type.dosen",
  eksternal: "research_type.eksternal",
  internal:  "research_type.internal",
};

export const RESEARCH_PHASES = [
  "Persiapan",
  "Penyemaian",
  "Penanaman",
  "Pemeliharaan",
  "Pengukuran",
  "Panen",
  "Analisis",
  "Penulisan",
] as const;

/** i18n keys untuk phases — mapping value ke key `research_phase.<value>`. */
export const RESEARCH_PHASE_KEY = Object.fromEntries(
  RESEARCH_PHASES.map((p) => [p, `research_phase.${p}`])
) as Record<(typeof RESEARCH_PHASES)[number], string>;
