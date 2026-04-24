"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";

/**
 * When middleware redirects a user off a role-gated route, it appends
 * `?denied=<original-pathname>` to the landing URL. This tiny client
 * component reads that param, shows a toast to explain why the page
 * didn't open, and removes the param so the URL stays clean.
 *
 * Mount once in the dashboard layout (after the provider tree).
 */
export function RouteDenialToast() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useLang();

  useEffect(() => {
    const denied = params.get("denied");
    if (!denied) return;
    toast.warning(
      t("route_denied.title"),
      { description: t("route_denied.body").replace("{path}", denied) }
    );
    // Strip the param so a refresh / back-forward doesn't re-fire the toast.
    const url = new URL(window.location.href);
    url.searchParams.delete("denied");
    router.replace(url.pathname + (url.search || ""), { scroll: false });
  }, [params, router, t]);

  return null;
}
