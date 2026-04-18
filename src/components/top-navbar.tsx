"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Bell, Settings, Sun, Moon, Monitor, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopNavbarProps {
  displayName: string;
  notifCount?: number;
}

export function TopNavbar({ displayName, notifCount = 0 }: TopNavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="sticky top-0 z-40 h-14 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center gap-3 px-4">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("common.search")} className="h-9 bg-secondary border-border/50 pl-9 text-[13px]" />
      </div>

      {/* Right icons: Notif → Settings → Profile */}
      <div className="ml-auto flex items-center gap-1">
        {/* Notifications */}
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 relative">
          <Bell className="h-4 w-4" />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[9px] text-white flex items-center justify-center">
              {notifCount}
            </span>
          )}
        </Button>

        {/* Settings dropdown */}
        <div className="relative" ref={settingsRef}>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => { setSettingsOpen((v) => !v); setProfileOpen(false); }}>
            <Settings className="h-4 w-4" />
          </Button>
          {settingsOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border/50 bg-card shadow-xl p-3 space-y-3 z-50">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t("settings.theme")}</span>
                <div className="flex gap-1">
                  {[
                    { key: "light", icon: Sun, label: t("settings.light") },
                    { key: "dark", icon: Moon, label: t("settings.dark") },
                    { key: "system", icon: Monitor, label: t("settings.system") },
                  ].map(({ key, icon: Icon, label }) => (
                    <Button key={key} variant="ghost" size="sm" className={cn("h-8 flex-1 gap-1.5 text-xs", theme === key && "bg-secondary")} onClick={() => setTheme(key)}>
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t("settings.language")}</span>
                <div className="flex gap-1">
                  {[{ key: "id" as const, label: "Bahasa Indonesia" }, { key: "en" as const, label: "English" }].map(({ key, label }) => (
                    <Button key={key} variant="ghost" size="sm" className={cn("h-8 flex-1 text-xs", lang === key && "bg-secondary")} onClick={() => setLang(key)}>
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile + Logout dropdown */}
        <div className="relative" ref={profileRef}>
          <Button variant="ghost" size="sm" className="h-9 px-2 gap-2" onClick={() => { setProfileOpen((v) => !v); setSettingsOpen(false); }}>
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-[11px] font-semibold text-primary">{displayName.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-[12px] text-foreground hidden sm:inline">{displayName}</span>
          </Button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-border/50 bg-card shadow-xl z-50">
              <div className="p-3 border-b border-border/30">
                <p className="text-[13px] font-medium text-foreground">{displayName}</p>
                <p className="text-[11px] text-muted-foreground">Plant Factory ERP</p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t("nav.logout")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
