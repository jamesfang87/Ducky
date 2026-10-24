"use client";

import { createContext, useContext } from "react";
import type { Session } from "./users";

/**
 * Carries the server-resolved session into client components.
 *
 * Seeded by the route layouts from `requireRole()`, so no client fetch is
 * needed and there is no "flash of wrong UI" while `/me` loads.
 */
const Ctx = createContext<Session | null>(null);

export function SessionProvider({ session, children }: { session: Session; children: React.ReactNode }) {
  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
}

export function useSession(): Session | null {
  return useContext(Ctx);
}
