"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { useLang } from "@/lib/i18n";
import { useCurrentUser } from "@/components/current-user-provider";
import type { UserRole } from "@/lib/types/database";
import {
  LayoutDashboard, Grid3X3, Sprout, Scissors, Thermometer,
  Droplets, Leaf, FileBarChart, Users, LogOut, ChevronDown,
  ChevronLeft, ChevronRight,
  Clock, BarChart3, Wallet, ShoppingCart, Sun, Moon, Monitor, CalendarDays,
  Boxes, Receipt, FlaskConical, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  mobile?: boolean;
  /**
   * When set, only users with one of these roles see this item. Missing
   * means "any authenticated active user". Keep in sync with
   * ROUTE_ROLE_GATES in `@/lib/auth-helpers.ts`.
   */
  roles?: UserRole[];
  children?: { href: string; labelKey: string; roles?: UserRole[] }[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, mobile: true },
  {
    href: "/lubang",
    labelKey: "nav.cultivation",
    icon: Sprout,
    mobile: true,
    // Cultivation is hidden from researchers & supervisors (they can still
    // technically read holes via `<RoleGate>`-wrapped components that need
    // them, but the module as a whole isn't part of their workflow).
    roles: ["admin", "operator", "viewer"],
    children: [
      { href: "/lubang", labelKey: "nav.hole_map" },
      { href: "/panen", labelKey: "nav.harvest_log" },
      { href: "/lingkungan", labelKey: "nav.env_log" },
      { href: "/nutrisi", labelKey: "nav.nutrient_log" },
      { href: "/komoditas", labelKey: "nav.commodity" },
      { href: "/laporan", labelKey: "nav.report" },
    ],
  },
  {
    href: "/inventory",
    labelKey: "nav.inventory",
    icon: Boxes,
    roles: ["admin", "operator", "viewer"],
    children: [
      { href: "/inventory", labelKey: "nav.inventory_dashboard" },
      { href: "/inventory/items", labelKey: "nav.inventory_items" },
      { href: "/inventory/transaksi", labelKey: "nav.inventory_txn" },
      { href: "/pengeluaran", labelKey: "nav.expenses", roles: ["admin", "operator"] },
    ],
  },
  {
    href: "/hr",
    labelKey: "nav.hr",
    icon: Users,
    roles: ["admin", "operator"],
    children: [
      { href: "/hr", labelKey: "nav.hr_dashboard" },
      { href: "/hr/absensi", labelKey: "nav.attendance" },
      { href: "/hr/beban-kerja", labelKey: "nav.workload" },
      { href: "/hr/penggajian", labelKey: "nav.payroll" },
    ],
  },
  {
    href: "/sales",
    labelKey: "nav.sales",
    icon: ShoppingCart,
    mobile: true,
    roles: ["admin", "operator", "viewer"],
    children: [
      { href: "/sales", labelKey: "nav.sales_dashboard" },
      { href: "/sales/pelanggan", labelKey: "nav.customers" },
      { href: "/sales/order", labelKey: "nav.orders" },
      { href: "/sales/log", labelKey: "nav.sales_log" },
      { href: "/sales/laporan", labelKey: "nav.sales_report" },
    ],
  },
  { href: "/riset", labelKey: "nav.research", icon: FlaskConical },
  // Visits is operational — admin/operator schedule + record, viewer reads.
  // Researchers focus on their projects; supervisors review. Neither
  // touches tour / kunjungan so we hide the menu.
  { href: "/kunjungan", labelKey: "nav.visits", icon: UserCheck, roles: ["admin", "operator", "viewer"] },
  { href: "/kalender", labelKey: "nav.calendar", icon: CalendarDays, mobile: true },
];

function filterNavByRole(items: NavItem[], role: UserRole | undefined): NavItem[] {
  if (!role) return [];
  return items
    .filter((i) => !i.roles || i.roles.includes(role))
    .map((i) => ({
      ...i,
      children: i.children?.filter((c) => !c.roles || c.roles.includes(role)),
    }));
}

const CULTIVATION_PATHS = ["/lubang", "/tanam", "/panen", "/lingkungan", "/nutrisi", "/komoditas", "/laporan"];

function isGroupActive(item: NavItem, pathname: string): boolean {
  if (item.children) {
    return item.children.some((child) =>
      child.href === "/" ? pathname === "/" : pathname.startsWith(child.href)
    );
  }
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}

const MOBILE_ITEMS: { href: string; labelKey: string; icon: LucideIcon }[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/lubang", labelKey: "nav.cultivation", icon: Sprout },
  { href: "/kalender", labelKey: "nav.calendar", icon: CalendarDays },
  { href: "/sales", labelKey: "nav.sales", icon: ShoppingCart },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLang();
  const user = useCurrentUser();
  const visibleMobileItems = useMemo(() => {
    if (!user) return [];
    return MOBILE_ITEMS.filter((item) => {
      if (item.href === "/sales") return ["admin", "operator", "viewer"].includes(user.role);
      if (item.href === "/lubang") return ["admin", "operator", "viewer"].includes(user.role);
      return true;
    });
  }, [user]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar/95 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around h-16">
        {visibleMobileItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : item.labelKey === "nav.cultivation"
              ? CULTIVATION_PATHS.some((p) => pathname.startsWith(p))
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center shrink-0 w-[72px] py-2 transition-all",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 1.5} />
              <span
                className={cn(
                  "text-[10px] mt-1 leading-tight text-center truncate w-full px-1",
                  isActive ? "font-semibold" : "font-normal"
                )}
              >
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DesktopSidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const { t } = useLang();
  const user = useCurrentUser();
  const navItems = useMemo(() => filterNavByRole(NAV_ITEMS, user?.role), [user?.role]);

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pfms-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  // Listen for the global Ctrl+B shortcut (dispatched by <KeyboardShortcuts />).
  useEffect(() => {
    function onToggle(e: Event) {
      const detail = (e as CustomEvent<{ collapsed: boolean }>).detail;
      if (detail && typeof detail.collapsed === "boolean") setCollapsed(detail.collapsed);
    }
    window.addEventListener("pfms:sidebar-toggle", onToggle);
    return () => window.removeEventListener("pfms:sidebar-toggle", onToggle);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", collapsed ? "60px" : "220px");
  }, [collapsed]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      localStorage.setItem("pfms-sidebar-collapsed", String(!v));
      return !v;
    });
  }

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(
      navItems.filter((i) => i.children && isGroupActive(i, pathname)).map((i) => i.labelKey)
    )
  );

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <aside className={cn(
      "hidden md:flex md:flex-col md:fixed md:inset-y-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
      collapsed ? "md:w-[60px]" : "md:w-[220px]"
    )}>
      {/* Floating collapse/expand button (attached to right edge, vertical center) */}
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-20 h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-primary/50 shadow-sm transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand — fixed, does not scroll */}
        <div className="shrink-0 px-4 py-4 border-b border-border/50">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2.5")}>
            <Image
              src="/agrosphere-logo.svg"
              alt="Agrosphere"
              width={32}
              height={32}
              priority
              className="h-8 w-8 shrink-0"
            />
            {!collapsed && (
              <div className="flex flex-col justify-center min-w-0 leading-tight">
                <h1
                  className="text-[15px] font-semibold pb-0.5 truncate"
                  style={{
                    background: "linear-gradient(90deg, #45DFB1 0%, #0AD1C8 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    lineHeight: 1.15,
                  }}
                >
                  Agrosphere
                </h1>
                <p className="text-[11px] text-muted-foreground truncate">SmartAgri UGM</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation — scrolls independently when content exceeds viewport */}
        <nav className="flex-1 min-h-0 px-2 py-2 pb-6 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isGroupActive(item, pathname);
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = openGroups.has(item.labelKey);

            if (hasChildren) {
              if (collapsed) {
                return (
                  <Link
                    key={item.labelKey}
                    href={item.href}
                    title={t(item.labelKey)}
                    className={cn(
                      "flex items-center justify-center w-full px-2.5 py-[7px] rounded-md text-[13px] transition-all group",
                      active
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                  </Link>
                );
              }

              return (
                <div key={item.labelKey}>
                  <button
                    onClick={() => toggleGroup(item.labelKey)}
                    className={cn(
                      "flex items-center justify-between w-full px-2.5 py-[7px] rounded-md text-[13px] transition-all group",
                      active
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span>{t(item.labelKey)}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <div className="ml-4 pl-3 border-l border-border/30 mt-0.5 space-y-0.5">
                      {item.children!.map((child) => {
                        const childActive = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "block px-2.5 py-[6px] rounded-md text-[12px] transition-all",
                              childActive
                                ? "bg-primary/15 text-primary font-medium"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}
                          >
                            {t(child.labelKey)}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? t(item.labelKey) : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] transition-all group",
                  collapsed && "justify-center",
                  active
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {!collapsed && <span>{t(item.labelKey)}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
