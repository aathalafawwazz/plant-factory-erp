// Server-only module. Do NOT import from client components — it pulls
// `supabase/server` which depends on `next/headers`. Client code should
// use `@/lib/auth-types` (pure) + `useCurrentUser()` instead.
import { createClient } from "@/lib/supabase/server";
import type { UserRole, ProfileStatus } from "@/lib/types/database";
import type { CurrentUser } from "./auth-types";

// Re-export pure pieces so existing `import { ... } from "@/lib/auth-helpers"`
// server-side calls keep working without migration churn.
export type {
  CurrentUser,
  RoleSet,
  GateVerdict,
} from "./auth-types";
export {
  roleMatches,
  evaluateGate,
  ROUTE_ROLE_GATES,
  resolveRouteGate,
} from "./auth-types";

/**
 * Read the current session + profile on the server. Returns null when
 * the user is unauthenticated OR their profile row is missing (the
 * latter should not happen under normal signup — the handle_new_user
 * trigger creates the row — but we handle it defensively).
 *
 * Server-only — uses `cookies()` via `supabase/server`. Client components
 * must read the same data via `<CurrentUserProvider>` + `useCurrentUser()`.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    email: user.email ?? "",
    displayName: profile.display_name || user.email || "User",
    role: profile.role as UserRole,
    status: profile.status as ProfileStatus,
  };
}
