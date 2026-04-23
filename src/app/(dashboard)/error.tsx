"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { useLang } from "@/lib/i18n";

/**
 * Route-level error boundary for every page under `/(dashboard)`.
 * Next.js calls this when a render/data-fetch error bubbles up.
 * The `reset` function re-renders the segment — useful for transient
 * failures (network blip, stale cache). If that doesn't work, a link
 * back to the dashboard is also provided.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLang();

  useEffect(() => {
    // Log to browser console so devs can read the stack; production should
    // pipe this to an error-tracking service (Sentry/etc.) instead.
    // eslint-disable-next-line no-console
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-card shadow-lg p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">
              {t("error.page_title")}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {t("error.page_subtitle")}
            </p>
          </div>
        </div>

        {error.message && (
          <details className="rounded-md border border-border/50 bg-secondary/40 px-3 py-2 text-[12px] text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium text-foreground">
              {t("error.technical_details")}
            </summary>
            <p className="mt-2 break-words font-mono text-[11px]">{error.message}</p>
            {error.digest && (
              <p className="mt-1 text-[10px] opacity-70">
                digest: <span className="font-mono">{error.digest}</span>
              </p>
            )}
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button onClick={reset} className="flex-1 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {t("error.retry")}
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/" className="inline-flex items-center justify-center gap-1.5">
              <Home className="h-3.5 w-3.5" />
              {t("error.back_home")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
