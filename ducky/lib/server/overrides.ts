import "server-only";

/** A teacher's change to an AI rubric score. Both numbers are kept so the grade is explainable (RUB-3). */
export interface ScoreOverride {
  id: string;
  ai: number;
  teacher: number;
  reason: string;
  by: string;
  at: number;
}

const g = globalThis as typeof globalThis & { __duckyOverrides?: Map<string, ScoreOverride> };
const overrides: Map<string, ScoreOverride> = (g.__duckyOverrides ??= new Map());

export const listOverrides = (): ScoreOverride[] => [...overrides.values()];
export const saveOverride = (o: ScoreOverride): void => void overrides.set(o.id, o);
export const clearOverride = (id: string): void => void overrides.delete(id);
