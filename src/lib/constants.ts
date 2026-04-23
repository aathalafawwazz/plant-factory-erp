// Hole status configuration — theme-aware (light default + dark: variants)
// `label` = ID fallback; use `labelKey` with t() for proper i18n.
// Pattern: `color` = badge chip, `dotColor` = solid indicator dot, `cellColor` = rack cell fill.
export const HOLE_STATUS = {
  empty: {
    label: "Kosong",
    labelKey: "hole_status.empty",
    color: "bg-[oklch(0.93_0.005_260)] text-[oklch(0.45_0.01_260)] dark:bg-[oklch(0.25_0.01_260)] dark:text-[oklch(0.70_0.01_260)]",
    dotColor: "bg-[oklch(0.70_0.01_260)] dark:bg-[oklch(0.50_0.01_260)]",
    cellColor: "bg-[oklch(0.94_0.005_260)] hover:bg-[oklch(0.90_0.006_260)] dark:bg-[oklch(0.22_0.008_260)] dark:hover:bg-[oklch(0.27_0.01_260)]",
  },
  planted: {
    label: "Ditanam",
    labelKey: "hole_status.planted",
    color: "bg-[oklch(0.93_0.08_250/0.6)] text-[oklch(0.42_0.16_250)] dark:bg-[oklch(0.30_0.12_250/0.3)] dark:text-[oklch(0.78_0.15_250)]",
    dotColor: "bg-[oklch(0.55_0.18_250)] dark:bg-[oklch(0.70_0.15_250)]",
    cellColor: "bg-[oklch(0.62_0.17_250)] hover:bg-[oklch(0.57_0.18_250)] dark:bg-[oklch(0.40_0.15_250)] dark:hover:bg-[oklch(0.45_0.17_250)]",
  },
  growing: {
    label: "Tumbuh",
    labelKey: "hole_status.growing",
    color: "bg-[oklch(0.92_0.08_150/0.6)] text-[oklch(0.38_0.15_150)] dark:bg-[oklch(0.35_0.12_150/0.3)] dark:text-[oklch(0.75_0.16_150)]",
    dotColor: "bg-[oklch(0.55_0.18_150)] dark:bg-[oklch(0.65_0.20_150)]",
    cellColor: "bg-[oklch(0.62_0.17_150)] hover:bg-[oklch(0.57_0.18_150)] dark:bg-[oklch(0.38_0.14_150)] dark:hover:bg-[oklch(0.43_0.16_150)]",
  },
  ready_harvest: {
    label: "Siap Panen",
    labelKey: "hole_status.ready_harvest",
    color: "bg-[oklch(0.93_0.09_80/0.6)] text-[oklch(0.42_0.15_70)] dark:bg-[oklch(0.38_0.12_80/0.3)] dark:text-[oklch(0.80_0.14_80)]",
    dotColor: "bg-[oklch(0.65_0.19_75)] dark:bg-[oklch(0.75_0.17_80)]",
    cellColor: "bg-[oklch(0.68_0.17_80)] hover:bg-[oklch(0.63_0.18_80)] dark:bg-[oklch(0.45_0.14_80)] dark:hover:bg-[oklch(0.50_0.16_80)]",
  },
  harvested: {
    label: "Dipanen",
    labelKey: "hole_status.harvested",
    color: "bg-[oklch(0.92_0.06_180/0.6)] text-[oklch(0.38_0.12_180)] dark:bg-[oklch(0.32_0.10_180/0.3)] dark:text-[oklch(0.72_0.12_180)]",
    dotColor: "bg-[oklch(0.55_0.14_180)] dark:bg-[oklch(0.65_0.14_180)]",
    cellColor: "bg-[oklch(0.60_0.13_180)] hover:bg-[oklch(0.55_0.14_180)] dark:bg-[oklch(0.35_0.10_180)] dark:hover:bg-[oklch(0.40_0.12_180)]",
  },
  maintenance: {
    label: "Perawatan",
    labelKey: "hole_status.maintenance",
    color: "bg-[oklch(0.92_0.08_25/0.6)] text-[oklch(0.45_0.18_25)] dark:bg-[oklch(0.35_0.14_25/0.3)] dark:text-[oklch(0.75_0.16_25)]",
    dotColor: "bg-[oklch(0.55_0.20_25)] dark:bg-[oklch(0.60_0.20_25)]",
    cellColor: "bg-[oklch(0.62_0.19_25)] hover:bg-[oklch(0.57_0.20_25)] dark:bg-[oklch(0.40_0.16_25)] dark:hover:bg-[oklch(0.45_0.18_25)]",
  },
} as const;

export type HoleStatus = keyof typeof HOLE_STATUS;

// Cycle status labels — use t(`cycle_status.<key>`) for i18n
export const CYCLE_STATUS = {
  planted: "Ditanam",
  growing: "Tumbuh",
  ready_harvest: "Siap Panen",
  harvested: "Dipanen",
  cancelled: "Dibatalkan",
} as const;

// Visual condition options — use labelKey with t()
export const VISUAL_CONDITIONS = [
  { value: "segar",  label: "Segar",  labelKey: "visual.segar" },
  { value: "layu",   label: "Layu",   labelKey: "visual.layu" },
  { value: "bercak", label: "Bercak", labelKey: "visual.bercak" },
  { value: "rusak",  label: "Rusak",  labelKey: "visual.rusak" },
] as const;

// Post harvest handling options — use labelKey with t()
export const POST_HARVEST_HANDLING = [
  { value: "cuci",     label: "Cuci",                 labelKey: "handling.cuci" },
  { value: "potong",   label: "Potong",               labelKey: "handling.potong" },
  { value: "kemas",    label: "Kemas",                labelKey: "handling.kemas" },
  { value: "langsung", label: "Langsung Distribusi",  labelKey: "handling.langsung" },
] as const;

// Rack configuration
export const RACK_CONFIG = {
  racks: ["A", "B"] as const,
  tiers: [1, 2, 3] as const,
  lanes: [1, 2, 3, 4] as const,
  holesPerLane: 20,
  totalHoles: 480,
};

// Quality grades
export const QUALITY_GRADES = [
  { value: "A", label: "Grade A — Terbaik" },
  { value: "B", label: "Grade B — Baik" },
  { value: "C", label: "Grade C — Cukup" },
] as const;
