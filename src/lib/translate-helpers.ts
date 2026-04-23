import { type Lang } from "./i18n-dict";
import type { InventoryCategory, ExpenseCategory } from "./types/database";

/**
 * Alias map for common plant / commodity names used at SARC UGM.
 * Keyed by normalized ID (lowercase, trimmed). When a user-added
 * commodity doesn't match any alias, we fall back to the original
 * name — we do NOT machine-translate arbitrary user input.
 */
const COMMODITY_ALIAS_EN: Record<string, string> = {
  // Leafy greens
  "bayam": "Spinach",
  "bayam hijau": "Green Spinach",
  "bayam merah": "Red Spinach",
  "kangkung": "Water Spinach",
  "selada": "Lettuce",
  "selada keriting": "Curly Lettuce",
  "selada merah": "Red Lettuce",
  "selada hijau": "Green Lettuce",
  "selada air": "Watercress",
  "selada butterhead": "Butterhead Lettuce",
  "selada romaine": "Romaine Lettuce",
  "selada iceberg": "Iceberg Lettuce",
  "kailan": "Chinese Kale",
  "pakcoy": "Bok Choy",
  "pak choy": "Bok Choy",
  "caisim": "Mustard Greens",
  "sawi": "Mustard Greens",
  "sawi hijau": "Green Mustard",
  "sawi putih": "Napa Cabbage",
  "sawi pagoda": "Tatsoi",
  "kale": "Kale",
  "kale keriting": "Curly Kale",
  "arugula": "Arugula",
  "rocket": "Rocket",
  "bok choy": "Bok Choy",
  "chard": "Chard",
  "swiss chard": "Swiss Chard",
  "mizuna": "Mizuna",
  // Herbs
  "basil": "Basil",
  "kemangi": "Lemon Basil",
  "daun kemangi": "Lemon Basil",
  "daun mint": "Mint",
  "mint": "Mint",
  "parsley": "Parsley",
  "peterseli": "Parsley",
  "cilantro": "Cilantro",
  "ketumbar": "Cilantro",
  "daun ketumbar": "Cilantro",
  "seledri": "Celery",
  "daun seledri": "Celery Leaves",
  "rosemary": "Rosemary",
  "thyme": "Thyme",
  "oregano": "Oregano",
  "dill": "Dill",
  "daun dill": "Dill",
  // Fruit vegetables
  "tomat": "Tomato",
  "tomat ceri": "Cherry Tomato",
  "tomat cherry": "Cherry Tomato",
  "cabai": "Chili",
  "cabai rawit": "Bird's Eye Chili",
  "cabe": "Chili",
  "paprika": "Bell Pepper",
  "mentimun": "Cucumber",
  "timun": "Cucumber",
  "terong": "Eggplant",
  "terung": "Eggplant",
  "stroberi": "Strawberry",
  "strawberry": "Strawberry",
  // Roots
  "wortel": "Carrot",
  "lobak": "Radish",
  "bawang": "Onion",
  "bawang merah": "Shallot",
  "bawang putih": "Garlic",
  "bawang daun": "Spring Onion",
  "daun bawang": "Spring Onion",
  // Others
  "jagung": "Corn",
  "kacang panjang": "Long Beans",
  "buncis": "Green Beans",
  "brokoli": "Broccoli",
  "kembang kol": "Cauliflower",
  "kol": "Cabbage",
  "kubis": "Cabbage",
  "labu": "Pumpkin",
  "oyong": "Luffa",
  "lidah buaya": "Aloe Vera",
  "microgreens": "Microgreens",
  "microgreen": "Microgreen",
  "sprout": "Sprout",
  "kecambah": "Sprouts",
  "bayam brazil": "Brazilian Spinach",
  "gotukola": "Gotu Kola",
  "daun katuk": "Katuk",
  "daun singkong": "Cassava Leaves",
  // Generic fallback category hints
  "tanaman": "Crop",
  "sayur": "Vegetable",
  "sayuran": "Vegetables",
  "buah": "Fruit",
};

/**
 * Return an English display name for a commodity/crop. If the input
 * (case-insensitive) isn't in our alias map, the original string is
 * returned unchanged — preserving user-entered custom names.
 *
 * When `lang === "id"`, the original Indonesian name is always returned.
 */
export function translateCommodity(name: string | null | undefined, lang: Lang): string {
  if (!name) return "";
  if (lang === "id") return name;
  const key = name.trim().toLowerCase();
  return COMMODITY_ALIAS_EN[key] ?? name;
}

/**
 * Safe wrapper for translating a plural / annotated commodity label like
 * "Bayam Hijau (HD-001)" — we only swap the head phrase up to the first
 * open-paren; the rest is preserved.
 */
export function translateCommodityLabel(name: string | null | undefined, lang: Lang): string {
  if (!name) return "";
  if (lang === "id") return name;
  const idx = name.indexOf("(");
  if (idx === -1) return translateCommodity(name, lang);
  const head = name.slice(0, idx).trim();
  const tail = name.slice(idx);
  return `${translateCommodity(head, lang)} ${tail}`;
}

/* ------------------------------------------------------------------ */
/*  Job title alias (HR position field — user-entered data)            */
/* ------------------------------------------------------------------ */

/**
 * Alias map for common Indonesian job titles used in
 * `employee_details.position`. Unknown values fall back to the
 * original string so user-entered custom titles render as-is.
 */
const JOB_TITLE_ALIAS_EN: Record<string, string> = {
  "supervisor": "Supervisor",
  "operator produksi": "Production Operator",
  "teknisi": "Technician",
  "admin": "Admin",
  "peneliti": "Researcher",
  "manajer operasional": "Operations Manager",
  "staf hr": "HR Staff",
  "staf sales": "Sales Staff",
  "petugas nutrisi": "Nutrient Technician",
  "staf lapangan": "Field Staff",
};

export function translateJobTitle(title: string | null | undefined, lang: Lang): string {
  if (!title) return "";
  if (lang === "id") return title;
  const key = title.trim().toLowerCase();
  return JOB_TITLE_ALIAS_EN[key] ?? title;
}

/* ------------------------------------------------------------------ */
/*  Inventory / Expense category labels                                */
/* ------------------------------------------------------------------ */

const INVENTORY_CATEGORY_LABEL: Record<InventoryCategory, Record<Lang, string>> = {
  seed:        { id: "Benih",        en: "Seed" },
  nutrient:    { id: "Nutrisi",      en: "Nutrient" },
  media:       { id: "Media",        en: "Media" },
  ph_solution: { id: "Larutan pH",   en: "pH Solution" },
  packaging:   { id: "Kemasan",      en: "Packaging" },
  equipment:   { id: "Peralatan",    en: "Equipment" },
  product:     { id: "Produk",       en: "Product" },
  other:       { id: "Lainnya",      en: "Other" },
};

const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, Record<Lang, string>> = {
  seed:        { id: "Benih",        en: "Seed" },
  nutrient:    { id: "Nutrisi",      en: "Nutrient" },
  media:       { id: "Media",        en: "Media" },
  ph_solution: { id: "Larutan pH",   en: "pH Solution" },
  packaging:   { id: "Kemasan",      en: "Packaging" },
  utility:     { id: "Utilitas",     en: "Utility" },
  labor:       { id: "Tenaga Kerja", en: "Labor" },
  equipment:   { id: "Peralatan",    en: "Equipment" },
  maintenance: { id: "Perawatan",    en: "Maintenance" },
  other:       { id: "Lainnya",      en: "Other" },
};

export function translateInventoryCategory(cat: InventoryCategory | string | null | undefined, lang: Lang): string {
  if (!cat) return "";
  return INVENTORY_CATEGORY_LABEL[cat as InventoryCategory]?.[lang] ?? String(cat);
}

export function translateExpenseCategory(cat: ExpenseCategory | string | null | undefined, lang: Lang): string {
  if (!cat) return "";
  return EXPENSE_CATEGORY_LABEL[cat as ExpenseCategory]?.[lang] ?? String(cat);
}

/* ------------------------------------------------------------------ */
/*  Locale-aware date/time formatting                                  */
/* ------------------------------------------------------------------ */

function bcp47(lang: Lang): string {
  return lang === "en" ? "en-US" : "id-ID";
}

export function formatDateLocale(
  d: Date | string | null | undefined,
  lang: Lang,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(bcp47(lang), opts);
}

export function formatDateTimeLocale(
  d: Date | string | null | undefined,
  lang: Lang,
  opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString(bcp47(lang), opts);
}
