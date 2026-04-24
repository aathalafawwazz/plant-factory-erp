"use client";

import { type ReactNode } from "react";
import type { RoleSet } from "@/lib/auth-types";
import { useHasRole, useCurrentUser } from "@/components/current-user-provider";

interface RoleGateProps {
  /**
   * Which roles may see the children. Pass a single role, an array,
   * or "any" to allow every authenticated active user.
   */
  roles: RoleSet;
  /**
   * Optional replacement when the user does NOT match. Default: null
   * (the element is hidden entirely).
   */
  fallback?: ReactNode;
  /**
   * When true, children still render but receive a `disabled` prop if
   * the user lacks the role. Only meaningful when the direct child is a
   * Button/input/etc. Tree-level hiding (default behaviour) is usually
   * the right call.
   */
  disableInstead?: boolean;
  /**
   * When true, alumni users are allowed to see the gated content
   * (useful for read-only archives). Default: false — alumni are
   * treated as not-active.
   */
  allowAlumni?: boolean;
  children: ReactNode;
}

/**
 * Element-level role gate. Typical usage:
 *
 *   <RoleGate roles={["admin","operator"]}>
 *     <Button onClick={handleDelete}>Delete</Button>
 *   </RoleGate>
 *
 * For read-only carve-outs (e.g. alumni browsing their archived project):
 *
 *   <RoleGate roles="researcher" allowAlumni>
 *     <ProjectArchiveList />
 *   </RoleGate>
 */
export function RoleGate({
  roles,
  fallback = null,
  disableInstead = false,
  allowAlumni = false,
  children,
}: RoleGateProps) {
  const user = useCurrentUser();
  const baseMatch = useHasRole(roles);
  const match =
    baseMatch || (allowAlumni && user?.status === "alumni" && (roles === "any" || (Array.isArray(roles) ? roles : [roles]).includes(user.role)));

  if (match) return <>{children}</>;
  if (disableInstead) {
    // Shallow clone of a React element with a disabled prop — only
    // works when the child is a single element.
    if (typeof children === "object" && children && "props" in (children as object)) {
      const child = children as React.ReactElement<{ disabled?: boolean; "aria-disabled"?: boolean }>;
      const Cloned = child.type as React.ElementType;
      return (
        <Cloned
          {...child.props}
          disabled
          aria-disabled="true"
          title="You do not have permission to use this control."
        />
      );
    }
    return <>{fallback}</>;
  }
  return <>{fallback}</>;
}
