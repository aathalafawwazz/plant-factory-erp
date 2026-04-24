import { Suspense } from "react";
import { BottomNav, DesktopSidebar } from "@/components/nav-sidebar";
import { TopNavbar } from "@/components/top-navbar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { CurrentUserProvider } from "@/components/current-user-provider";
import { RouteDenialToast } from "@/components/route-denial-toast";
import { getCurrentUser } from "@/lib/auth-helpers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Single server-side fetch of identity + role + status. Shared via
  // CurrentUserProvider to every client component below without extra
  // round-trips. Middleware already guarantees `user` exists here (it
  // redirects unauthenticated users to /login) but we guard anyway.
  const user = await getCurrentUser();
  const displayName = user?.displayName ?? "User";

  return (
    <div className="min-h-screen">
      <CurrentUserProvider user={user}>
        <KeyboardShortcuts />
        <Suspense fallback={null}>
          <RouteDenialToast />
        </Suspense>
        <DesktopSidebar displayName={displayName} />
        <main className="md:pl-[var(--sidebar-width,220px)] pb-20 md:pb-0 transition-all duration-200">
          <TopNavbar displayName={displayName} />
          <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
        <BottomNav />
      </CurrentUserProvider>
    </div>
  );
}
