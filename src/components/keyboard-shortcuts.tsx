"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";

/**
 * Global keyboard shortcuts — mounted once from the dashboard layout so every
 * route shares the same bindings.
 *
 *   Ctrl+Shift+D   Cycle theme  (light → dark → system)
 *   Ctrl+Shift+L   Toggle language (EN ↔ ID)
 *   Ctrl+B         Toggle sidebar collapse
 *
 * All bindings skip when focus is inside an editable field (input/textarea/
 * contenteditable) so keystrokes in forms stay untouched.
 */
export function KeyboardShortcuts() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { lang, setLang, t } = useLang();

  useEffect(() => {
    function isEditable(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function handler(e: KeyboardEvent) {
      if (isEditable(e.target)) return;

      // Ctrl+Shift+D → cycle theme
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        const order = ["light", "dark", "system"] as const;
        const current = (theme as typeof order[number]) ?? "system";
        const next = order[(order.indexOf(current) + 1) % order.length];
        setTheme(next);
        const label =
          next === "light" ? t("settings.light") :
          next === "dark"  ? t("settings.dark")  :
          t("settings.system");
        toast.success(`${t("settings.theme")}: ${label}`, { duration: 1500 });
        return;
      }

      // Ctrl+Shift+L → toggle language
      if (e.ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l")) {
        e.preventDefault();
        const next = lang === "en" ? "id" : "en";
        setLang(next);
        toast.success(
          `${t("settings.language")}: ${next === "en" ? t("settings.english") : t("settings.indonesia")}`,
          { duration: 1500 }
        );
        return;
      }

      // Ctrl+B → toggle sidebar (same localStorage key `pfms-sidebar-collapsed`
      // that nav-sidebar.tsx uses, then force a storage-like update by dispatching
      // a custom event so the sidebar reacts without a full reload)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        const cur = localStorage.getItem("pfms-sidebar-collapsed") === "true";
        const next = !cur;
        localStorage.setItem("pfms-sidebar-collapsed", String(next));
        window.dispatchEvent(new CustomEvent("pfms:sidebar-toggle", { detail: { collapsed: next } }));
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // Note: resolvedTheme intentionally omitted from deps — handler reads fresh
    // state from closures that refresh on each render via `theme`/`lang` change.
  }, [theme, setTheme, resolvedTheme, lang, setLang, t]);

  return null;
}
