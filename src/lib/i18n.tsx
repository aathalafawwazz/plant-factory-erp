"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { translate, DEFAULT_LANG, type Lang } from "./i18n-dict";

// Re-export for call sites that used to pull these from `@/lib/i18n`.
export { translate, type Lang };

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => key,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("pfms-lang") as Lang | null;
    if (saved === "id" || saved === "en") setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    if (l === lang) return;
    setLangState(l);
    localStorage.setItem("pfms-lang", l);
    // Mirror to cookie so server components pick it up on the next SSR pass.
    // 1 year max-age; SameSite=Lax is enough for same-site reads.
    document.cookie = `pfms-lang=${l}; path=/; max-age=31536000; SameSite=Lax`;
    // Refresh the server tree so pages rendered via getServerI18n() re-fetch
    // with the new lang cookie — no manual browser refresh needed.
    router.refresh();
  }

  function t(key: string): string {
    return translate(key, lang);
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
