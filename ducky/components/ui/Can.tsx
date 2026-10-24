"use client";

import { useSession } from "@/lib/session";
import { can, type Permission } from "@/lib/permissions";

/**
 * Renders children only when the signed-in role has `allow`.
 *
 * UX only: the same permission must be enforced by middleware or the API that
 * actually does the work. Never let this be the only check.
 */
export function Can({ allow, children }: { allow: Permission; children: React.ReactNode }) {
  const session = useSession();
  return can(session?.role, allow) ? <>{children}</> : null;
}
