"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Lang = "id" | "en";

// Translation dictionary
const dict: Record<string, Record<Lang, string>> = {
  // Nav
  "nav.dashboard": { id: "Dashboard", en: "Dashboard" },
  "nav.cultivation": { id: "Budidaya", en: "Cultivation" },
  "nav.hole_map": { id: "Peta Lubang", en: "Hole Map" },
  "nav.plant_log": { id: "Log Tanam", en: "Plant Log" },
  "nav.harvest_log": { id: "Log Panen", en: "Harvest Log" },
  "nav.env_log": { id: "Log Lingkungan", en: "Env Log" },
  "nav.nutrient_log": { id: "Log Nutrisi", en: "Nutrient Log" },
  "nav.commodity": { id: "Komoditas", en: "Commodities" },
  "nav.report": { id: "Laporan", en: "Reports" },
  "nav.calendar": { id: "Kalender", en: "Calendar" },
  "nav.hr": { id: "Human Resource", en: "Human Resource" },
  "nav.hr_dashboard": { id: "Dashboard HR", en: "HR Dashboard" },
  "nav.attendance": { id: "Absensi", en: "Attendance" },
  "nav.workload": { id: "Beban Kerja", en: "Workload" },
  "nav.payroll": { id: "Penggajian", en: "Payroll" },
  "nav.sales": { id: "Sales", en: "Sales" },
  "nav.sales_dashboard": { id: "Dashboard Sales", en: "Sales Dashboard" },
  "nav.customers": { id: "Pelanggan", en: "Customers" },
  "nav.orders": { id: "Order", en: "Orders" },
  "nav.sales_log": { id: "Log Penjualan", en: "Sales Log" },
  "nav.sales_report": { id: "Laporan Sales", en: "Sales Report" },
  "nav.logout": { id: "Keluar", en: "Logout" },
  // Common
  "common.save": { id: "Simpan", en: "Save" },
  "common.cancel": { id: "Batal", en: "Cancel" },
  "common.edit": { id: "Edit", en: "Edit" },
  "common.delete": { id: "Hapus", en: "Delete" },
  "common.loading": { id: "Memuat...", en: "Loading..." },
  "common.search": { id: "Cari...", en: "Search..." },
  // Dashboard
  "dashboard.title": { id: "Dashboard", en: "Dashboard" },
  "dashboard.subtitle": { id: "Ringkasan kondisi plant factory", en: "Plant factory overview" },
  "dashboard.active_holes": { id: "Total Lubang Aktif", en: "Total Active Holes" },
  "dashboard.status_dist": { id: "Distribusi Status Lubang", en: "Hole Status Distribution" },
  // Settings
  "settings.theme": { id: "Tema", en: "Theme" },
  "settings.dark": { id: "Gelap", en: "Dark" },
  "settings.light": { id: "Terang", en: "Light" },
  "settings.system": { id: "Sistem", en: "System" },
  "settings.language": { id: "Bahasa", en: "Language" },
};

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType>({
  lang: "id",
  setLang: () => {},
  t: (key) => key,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    const saved = localStorage.getItem("pfms-lang") as Lang | null;
    if (saved) setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("pfms-lang", l);
  }

  function t(key: string): string {
    return dict[key]?.[lang] ?? key;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
