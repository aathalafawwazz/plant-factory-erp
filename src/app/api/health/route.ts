import { NextResponse } from "next/server";

/**
 * Lightweight health check that proves the deploy is reachable WITHOUT
 * any external dependency. Returns the runtime + a presence flag for the
 * Supabase env vars (without leaking the values), so when the dashboard
 * is mysteriously 500-ing you can hit `/api/health` to see whether:
 *   - the deploy is up at all
 *   - the env vars are wired
 *
 * No auth, no DB. Safe to expose publicly.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    runtime: process.env.NEXT_RUNTIME ?? "unknown",
    env: {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  });
}
