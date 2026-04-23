import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * OAuth callback handler.
 *
 * Flow:
 * 1. User klik login Google/Magic Link di /login.
 * 2. Supabase mengarahkan ke Google → Google auth → balik ke Supabase callback
 *    (https://<ref>.supabase.co/auth/v1/callback)
 * 3. Supabase me-redirect browser ke URL yang kita set di `redirectTo`,
 *    yaitu `${origin}/auth/callback?code=XXX&next=/`
 * 4. Route ini menukar code jadi session cookie, lalu redirect ke `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Kalau user cancel/error dari provider
  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", errorDescription ?? error);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "Missing OAuth code");
    return NextResponse.redirect(loginUrl);
  }

  // Siapkan response supaya cookie session bisa di-set
  const response = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchange error:", exchangeError);
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
