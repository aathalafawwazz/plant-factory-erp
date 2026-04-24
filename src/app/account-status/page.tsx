import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getServerT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { Hourglass, Ban, LogOut } from "lucide-react";

/**
 * Landing page for users whose profile status blocks them from the
 * main app (`pending` or `suspended`). Middleware funnels them here —
 * here we explain why they can't proceed and offer a logout.
 *
 * `active` and `alumni` users who land here via deep-link get bounced
 * back to the dashboard so they're not confused by an error UI that
 * doesn't apply to them.
 */
export default async function AccountStatusPage() {
  const user = await getCurrentUser();
  const t = await getServerT();

  if (!user) redirect("/login");
  if (user.status === "active" || user.status === "alumni") redirect("/");

  const Icon = user.status === "pending" ? Hourglass : Ban;
  const title = user.status === "pending"
    ? t("account_status.pending_title")
    : t("account_status.suspended_title");
  const body = user.status === "pending"
    ? t("account_status.pending_body")
    : t("account_status.suspended_body");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="max-w-md w-full rounded-xl border border-border/60 bg-card shadow-lg p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            user.status === "pending" ? "bg-amber-500/15 text-amber-600" : "bg-destructive/15 text-destructive"
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">{title}</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">{user.email}</p>
          </div>
        </div>

        <p className="text-[13px] text-foreground leading-relaxed">{body}</p>

        <div className="rounded-md border border-border/50 bg-secondary/40 px-3 py-2.5 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>{t("account_status.role_label")}</span>
            <span className="font-medium text-foreground">{user.role}</span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span>{t("account_status.status_label")}</span>
            <span className="font-medium text-foreground capitalize">{user.status}</span>
          </div>
        </div>

        <form action={async () => {
          "use server";
          const supabase = await createClient();
          await supabase.auth.signOut();
          redirect("/login");
        }}>
          <button
            type="submit"
            className="w-full h-10 rounded-lg border border-border hover:bg-muted transition-colors text-[13px] font-medium inline-flex items-center justify-center gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("account_status.logout")}
          </button>
        </form>
      </div>
    </div>
  );
}
