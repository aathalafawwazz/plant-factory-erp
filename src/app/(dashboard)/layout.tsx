import { createClient } from "@/lib/supabase/server";
import { BottomNav, DesktopSidebar } from "@/components/nav-sidebar";
import { TopNavbar } from "@/components/top-navbar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { getServerT } from "@/lib/i18n-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getServerT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let displayName = user?.email ?? t("common.user_fallback");
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, role")
      .eq("id", user.id)
      .single();
    if (profile?.display_name) {
      displayName = profile.display_name;
    }
  }

  return (
    <div className="min-h-screen">
      <KeyboardShortcuts />
      <DesktopSidebar displayName={displayName} />
      <main className="md:pl-[var(--sidebar-width,220px)] pb-20 md:pb-0 transition-all duration-200">
        <TopNavbar displayName={displayName} />
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
