"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CLASS_BY_ID, DEMO_ENROLLMENT_IDS, findClassByCode, normalizeJoinCode, type ClassRecord } from "./classes";
import { useSession } from "./session";

const KEY_PREFIX = "ducky-classes-v1:";

export type JoinResult = { ok: true; record: ClassRecord } | { ok: false; error: string };

/**
 * Enrolled classes for the signed-in student.
 *
 * Real classes (and their published sets) come from Supabase via /api/classes.
 * Demo classes are seeded from `session.classIds` and extended with demo-code
 * joins stored in localStorage per user id. Any other code goes to the server's
 * `join_class()` RPC.
 */
export function useEnrolledClasses() {
  const session = useSession();
  const userId = session?.userId ?? "anon";

  const seed = useMemo(() => {
    const fromSession = (session?.classIds ?? []).filter((id) => Boolean(CLASS_BY_ID[id]));
    // Supabase class ids are UUIDs and never match the mock catalog, so a real
    // session would otherwise render an empty page. Show the demo class until
    // this catalog is replaced by a `classes` query.
    return fromSession.length > 0 ? fromSession : DEMO_ENROLLMENT_IDS;
  }, [session?.classIds]);

  const [ids, setIds] = useState<string[]>(seed);
  const [hydrated, setHydrated] = useState(false);
  const [real, setReal] = useState<ClassRecord[]>([]);
  const [realLoaded, setRealLoaded] = useState(false);

  const loadReal = useCallback(async (): Promise<ClassRecord[]> => {
    try {
      const res = await fetch("/api/classes", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { classes?: ClassRecord[] };
      const list = res.ok && Array.isArray(body.classes) ? body.classes : [];
      setReal(list);
      return list;
    } catch {
      return [];
    } finally {
      setRealLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadReal();
  }, [loadReal]);

  // Read the per-user list once after hydration, merging in any classes the
  // session already says we are enrolled in.
  useEffect(() => {
    let stored: string[] = [];
    try {
      const raw = window.localStorage.getItem(KEY_PREFIX + userId);
      if (raw) {
        stored = (JSON.parse(raw) as unknown[])
          .filter((id): id is string => typeof id === "string" && Boolean(CLASS_BY_ID[id]));
      }
    } catch {
      /* storage unavailable or corrupt: fall back to the seed */
    }
    setIds(Array.from(new Set([...seed, ...stored])));
    setHydrated(true);
  }, [userId, seed]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(ids));
    } catch {
      /* storage unavailable: in-memory only */
    }
  }, [ids, hydrated, userId]);

  const join = useCallback(
    async (code: string): Promise<JoinResult> => {
      const record = findClassByCode(code);
      if (record) {
        if (ids.includes(record.id)) return { ok: false, error: "You're already in that class." };
        setIds((prev) => [record.id, ...prev]);
        return { ok: true, record };
      }
      if (real.some((c) => c.joinCode === normalizeJoinCode(code))) return { ok: false, error: "You're already in that class." };
      try {
        const res = await fetch("/api/classes/join", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const body = (await res.json().catch(() => ({}))) as { classId?: string; error?: string };
        if (!res.ok || !body.classId) return { ok: false, error: body.error ?? "Couldn't join that class. Try again." };
        const joined = (await loadReal()).find((c) => c.id === body.classId);
        return joined ? { ok: true, record: joined } : { ok: false, error: "Joined, but the class didn't load. Refresh the page." };
      } catch {
        return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
      }
    },
    [ids, real, loadReal],
  );

  const classes = useMemo(
    () => [...real, ...ids.map((id) => CLASS_BY_ID[id]).filter((record): record is ClassRecord => Boolean(record))],
    [ids, real],
  );

  return { classes, join, ready: hydrated && realLoaded };
}
