import type { UserRole, ProfileStatus } from "@/lib/types/database";

/**
 * Pure module — no server imports. Safe to bring into client components.
 *
 * `auth-helpers.ts` (server-only, pulls in `supabase/server`) re-exports
 * from here so callers can keep `import { ... } from "@/lib/auth-helpers"`
 * when they're already in a server context.
 */

/**
 * The profile view used everywhere in role/status-gated code. Thin
 * projection of `profiles` — only the fields middleware and
 * <RoleGate /> actually care about.
 */
export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: ProfileStatus;
}

/* ------------------------------------------------------------------ */
/*  Role gates (composable predicates)                                 */
/* ------------------------------------------------------------------ */

export type RoleSet = UserRole | UserRole[] | "any";

export function roleMatches(userRole: UserRole, allowed: RoleSet): boolean {
  if (allowed === "any") return true;
  if (Array.isArray(allowed)) return allowed.includes(userRole);
  return userRole === allowed;
}

/**
 * Combined role+status predicate used by the middleware. Returns one of:
 *   - "ok"              : user is authenticated, active, role matches
 *   - "unauthenticated" : no session
 *   - "pending"         : awaiting admin approval
 *   - "suspended"       : admin-disabled
 *   - "alumni"          : read-only carve-out (treated per-route)
 *   - "role-denied"     : authenticated but role doesn't match `allowed`
 */
export type GateVerdict =
  | "ok"
  | "unauthenticated"
  | "pending"
  | "suspended"
  | "alumni"
  | "role-denied";

export function evaluateGate(
  user: CurrentUser | null,
  allowed: RoleSet,
  allowAlumni = false
): GateVerdict {
  if (!user) return "unauthenticated";
  if (user.status === "pending") return "pending";
  if (user.status === "suspended") return "suspended";
  if (user.status === "alumni") return allowAlumni ? "ok" : "alumni";
  if (!roleMatches(user.role, allowed)) return "role-denied";
  return "ok";
}

/* ------------------------------------------------------------------ */
/*  Route access matrix — single source of truth for middleware        */
/* ------------------------------------------------------------------ */

/**
 * Route prefixes that ONLY specific roles may access. The middleware
 * walks the pathname against this table; routes not listed are
 * accessible to any authenticated active user (subject to RLS at the
 * data layer).
 *
 * Keep in sync with docs/sprint-2-rls-matrix.md.
 */
export const ROUTE_ROLE_GATES: Array<{
  prefix: string;
  allowed: UserRole[];
  description: string;
}> = [
  // HR — admin + operator only
  { prefix: "/hr",           allowed: ["admin", "operator"],              description: "HR dashboard and sub-pages" },
  // Finance — admin + operator only
  { prefix: "/pengeluaran",  allowed: ["admin", "operator"],              description: "Expenses" },
  // Sales — admin + operator + viewer
  { prefix: "/sales",        allowed: ["admin", "operator", "viewer"],    description: "Sales (viewer read-only)" },
  // Inventory — admin + operator + viewer
  { prefix: "/inventory",    allowed: ["admin", "operator", "viewer"],    description: "Inventory" },
  // Admin console
  { prefix: "/settings/users", allowed: ["admin"],                        description: "User management" },
];

/**
 * Resolve the gate for a given pathname. Returns null when the path is
 * not role-gated (i.e., any authenticated active user may access).
 */
export function resolveRouteGate(pathname: string): { allowed: UserRole[] } | null {
  // Longest-prefix match so `/settings/users` beats hypothetical `/settings`.
  const match = ROUTE_ROLE_GATES
    .filter((g) => pathname === g.prefix || pathname.startsWith(g.prefix + "/"))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match ? { allowed: match.allowed } : null;
}
