// Hole status configuration — vibrant colors for dark theme
export const HOLE_STATUS = {
  empty: {
    label: "Kosong",
    color: "bg-[oklch(0.25_0.01_260)] text-[oklch(0.55_0.01_260)]",
    dotColor: "bg-[oklch(0.40_0.01_260)]",
    cellColor: "bg-[oklch(0.22_0.008_260)] hover:bg-[oklch(0.27_0.01_260)]",
  },
  planted: {
    label: "Ditanam",
    color: "bg-[oklch(0.30_0.12_260/0.3)] text-[oklch(0.75_0.15_260)]",
    dotColor: "bg-[oklch(0.65_0.18_260)]",
    cellColor: "bg-[oklch(0.35_0.12_260)] hover:bg-[oklch(0.40_0.14_260)]",
  },
  growing: {
    label: "Tumbuh",
    color: "bg-[oklch(0.35_0.12_150/0.3)] text-[oklch(0.75_0.16_150)]",
    dotColor: "bg-[oklch(0.65_0.20_150)]",
    cellColor: "bg-[oklch(0.38_0.14_150)] hover:bg-[oklch(0.43_0.16_150)]",
  },
  ready_harvest: {
    label: "Siap Panen",
    color: "bg-[oklch(0.38_0.12_80/0.3)] text-[oklch(0.80_0.14_80)]",
    dotColor: "bg-[oklch(0.75_0.17_80)]",
    cellColor: "bg-[oklch(0.45_0.14_80)] hover:bg-[oklch(0.50_0.16_80)]",
  },
  harvested: {
    label: "Dipanen",
    color: "bg-[oklch(0.32_0.10_180/0.3)] text-[oklch(0.72_0.12_180)]",
    dotColor: "bg-[oklch(0.65_0.14_180)]",
    cellColor: "bg-[oklch(0.35_0.10_180)] hover:bg-[oklch(0.40_0.12_180)]",
  },
  maintenance: {
    label: "Perawatan",
    color: "bg-[oklch(0.35_0.14_25/0.3)] text-[oklch(0.75_0.16_25)]",
    dotColor: "bg-[oklch(0.60_0.20_25)]",
    cellColor: "bg-[oklch(0.40_0.16_25)] hover:bg-[oklch(0.45_0.18_25)]",
  },
} as const;

export type HoleStatus = keyof typeof HOLE_STATUS;

// Cycle status labels
export const CYCLE_STATUS = {
  planted: "Ditanam",
  growing: "Tumbuh",
  ready_harvest: "Siap Panen",
  harvested: "Dipanen",
  cancelled: "Dibatalkan",
} as const;

// Visual condition options
export const VISUAL_CONDITIONS = [
  { value: "segar", label: "Segar" },
  { value: "layu", label: "Layu" },
  { value: "bercak", label: "Bercak" },
  { value: "rusak", label: "Rusak" },
] as const;

// Post harvest handling options
export const POST_HARVEST_HANDLING = [
  { value: "cuci", label: "Cuci" },
  { value: "potong", label: "Potong" },
  { value: "kemas", label: "Kemas" },
  { value: "langsung", label: "Langsung Distribusi" },
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
