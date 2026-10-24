"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CLASS_BY_ID, DEMO_ENROLLMENT_IDS, findClassByCode, type ClassRecord } from "./classes";
import { useSession } from "./session";

const KEY_PREFIX = "ducky-classes-v1:";

export type JoinResult = { ok: true; record: ClassRecord } | { ok: false; error: string };

/**
 * Enrolled classes for the signed-in student.
 *
 * Seeded from `session.classIds`, then extended with joins stored in
 * localStorage per user id. Mock only: a join does not reach the server, so it
 * lives in this browser. Replace with `enrollments` + `join_class()` later.
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
    (code: string): JoinResult => {
      const record = findClassByCode(code);
      if (!record) {
        return { ok: false, error: "No class matches that code. Ask your teacher for the current one." };
      }
      if (ids.includes(record.id)) {
        return { ok: false, error: "You're already in that class." };
      }
      setIds((prev) => [record.id, ...prev]);
      return { ok: true, record };
    },
    [ids],
  );

  const classes = useMemo(
    () => ids.map((id) => CLASS_BY_ID[id]).filter((record): record is ClassRecord => Boolean(record)),
    [ids],
  );

  return { classes, join };
}
