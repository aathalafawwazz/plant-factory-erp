"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CurrentUser, RoleSet } from "@/lib/auth-helpers";
import { roleMatches } from "@/lib/auth-helpers";

/**
 * Client-side context that carries the current user's identity, role,
 * and profile status. Hydrated once by the server via the dashboard
 * layout — subsequent reads are zero-cost.
 *
 * Why a provider instead of a server call per component? Every
 * RoleGate invocation would otherwise trigger a `supabase.auth.getUser()`
 * on the server during render, which adds up fast on pages with many
 * conditional elements. The provider pays the cost once.
 */
const CurrentUserContext = createContext<CurrentUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: ReactNode;
}) {
  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  );
}

/** Returns the current user, or null when unauthenticated. */
export function useCurrentUser(): CurrentUser | null {
  return useContext(CurrentUserContext);
}

/**
 * Shorthand boolean for role membership. Callers that need pure gating
 * without rendering should prefer this over `<RoleGate>`.
 *
 *   const canEdit = useHasRole(["admin", "operator"]);
 */
export function useHasRole(allowed: RoleSet): boolean {
  const u = useCurrentUser();
  if (!u) return false;
  if (u.status !== "active") return false;
  return roleMatches(u.role, allowed);
}
