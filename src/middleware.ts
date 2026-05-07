import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteGate } from "@/lib/auth-types";
import type { UserRole, ProfileStatus } from "@/lib/types/database";

/**
 * Pages that a signed-in user with a *non-active* profile status is
 * allowed to reach. Anything outside this list redirects to
 * `/account-status` so they see a clear explanation instead of RLS
 * failures on data fetch.
 */
const BLOCKED_STATUS_ALLOWLIST = new Set<string>([
  "/account-status",
  "/login",
]);

/**
 * Top-level wrapper that catches any unexpected error from the middleware
 * body and lets the request through. Failing closed (returning 500) would
 * bring the whole site down on a single regression — fail-open is safer
 * for an internal tool. Errors are logged so Vercel still surfaces them.
 */
export async function middleware(request: NextRequest) {
  try {
    return await runMiddleware(request);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[middleware] unhandled error:", err);
    return NextResponse.next({ request });
  }
}

async function runMiddleware(request: NextRequest) {
  // Sanity check env vars early — without them createServerClient throws an
  // opaque error that Vercel surfaces as MIDDLEWARE_INVOCATION_FAILED. Better
  // to log a clear message and let the request through (the page itself will
  // fail with a meaningful error when it can't talk to Supabase).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    // eslint-disable-next-line no-console
    console.error(
      "[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
    );
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isPublicAuthRoute = pathname.startsWith("/auth/");
  // Public registration & landing routes (Sprint 2 Part 2 — added incrementally).
  const isPublicLanding =
    pathname === "/landing" ||
    pathname.startsWith("/daftar/") ||
    pathname === "/tur";

  // Wrap auth lookup in try/catch — Supabase can throw when cookies are
  // malformed or the network blips. Treat any auth error as "no user".
  let user: { id: string } | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[middleware] auth.getUser failed:", err);
    user = null;
  }

  // ── 1. Unauthenticated + protected route → /login ───────────────
  if (!user && !isLoginPage && !isPublicAuthRoute && !isPublicLanding) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── 2. Authenticated on login page → /  ──────────────────────────
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ── 3. Authenticated: enforce profile status + role gates ────────
  if (user) {
    // `.maybeSingle()` returns null cleanly when the profile row doesn't
    // exist (vs `.single()` which produces an error result). Keeps the
    // happy path simple and avoids surprising rejected promises.
    const profileRes = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    const profile = profileRes.data as { role: string; status: string } | null;

    // Missing profile row — let the page render (likely first-signup race).
    if (profile) {
      const status = profile.status as ProfileStatus;
      const role = profile.role as UserRole;

      // 3a. Non-active statuses get funnelled to /account-status.
      if (status !== "active" && status !== "alumni") {
        if (!BLOCKED_STATUS_ALLOWLIST.has(pathname)) {
          const url = request.nextUrl.clone();
          url.pathname = "/account-status";
          return NextResponse.redirect(url);
        }
      }

      // 3b. Role-gated routes: redirect to dashboard if role doesn't match.
      const gate = resolveRouteGate(pathname);
      if (gate && !gate.allowed.includes(role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.searchParams.set("denied", pathname);
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
