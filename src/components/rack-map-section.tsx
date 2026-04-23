"use client";

import { useState, useEffect, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

interface Props {
  title?: string;
  children: ReactNode;        // RackMap
  statsRow?: ReactNode;       // 6 status cards at top of left column
  sidePanel?: ReactNode;      // HoleActionPanel
  storageKey?: string;
}

export function RackMapSection({
  title,
  children,
  statsRow,
  sidePanel,
  storageKey = "pfms-rackmap-collapsed",
}: Props) {
  const { t } = useLang();
  const resolvedTitle = title ?? t("rmap.title");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === "true") setCollapsed(true);
  }, [storageKey]);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  }

  return (
    <section>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="group flex items-center gap-1.5 mb-3 text-[15px] font-semibold text-foreground hover:text-primary transition-colors"
      >
        <span className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground group-hover:text-primary transition-colors">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
        <span>{resolvedTitle}</span>
        {collapsed && (
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">{t("rmap.collapsed")}</span>
        )}
      </button>

      {!collapsed && (
        <div
          className={cn(
            "grid gap-4 items-stretch",
            sidePanel ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1"
          )}
        >
          <div className="min-w-0 flex flex-col gap-4">
            {statsRow}
            <div className="min-w-0">{children}</div>
          </div>
          {sidePanel && (
            <aside className="min-w-0 relative">
              <div className="absolute inset-0 overflow-hidden">{sidePanel}</div>
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
