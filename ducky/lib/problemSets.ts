/**
 * Demo problem sets posted to each class. Replace with a Supabase
 * `assignments` + `problems` query once the student view reads from the backend.
 */

export interface ProblemSetRecord {
  id: string;
  classId: string;
  /** Shown as "Problem Set N". */
  number: number;
  title: string;
  summary: string;
  problems: number;
  /** Problems this student has finished in this set. */
  completed: number;
  due: string | null;
  posted: string;
  /** The tutoring session opened from this set. */
  sessionId: string;
}

export const PROBLEM_SETS: ProblemSetRecord[] = [
  {
    id: "phys-1401-ps3",
    classId: "phys-1401",
    number: 3,
    title: "Free fall",
    summary: "Two balls, different masses, dropped from the same height.",
    problems: 6,
    completed: 2,
    due: "Fri, Oct 30",
    posted: "Mon, Oct 20",
    sessionId: "demo",
  },
  {
    id: "phys-1401-ps2",
    classId: "phys-1401",
    number: 2,
    title: "Projectile motion",
    summary: "Launch angles, components, and how far a ball actually travels.",
    problems: 5,
    completed: 0,
    due: "Wed, Oct 28",
    posted: "Fri, Oct 16",
    sessionId: "demo-phys-2",
  },
  {
    id: "cs-314-ps1",
    classId: "cs-314",
    number: 1,
    title: "Insertion sort",
    summary: "Trace the passes, count comparisons, and name the worst case.",
    problems: 4,
    completed: 0,
    due: "Mon, Nov 2",
    posted: "Thu, Oct 22",
    sessionId: "demo-cs",
  },
  {
    id: "cs-314-ps2",
    classId: "cs-314",
    number: 2,
    title: "Hash maps",
    summary: "Buckets, collisions, and why average O(1) hides a linear worst case.",
    problems: 4,
    completed: 0,
    due: "Mon, Nov 9",
    posted: "Fri, Oct 23",
    sessionId: "demo-cs-2",
  },
];

const BY_CLASS: Record<string, ProblemSetRecord[]> = PROBLEM_SETS.reduce(
  (byClass, set) => {
    (byClass[set.classId] ??= []).push(set);
    return byClass;
  },
  {} as Record<string, ProblemSetRecord[]>,
);

/** Problem sets posted to a class, newest first. */
export function getProblemSets(classId: string): ProblemSetRecord[] {
  return [...(BY_CLASS[classId] ?? [])].sort((a, b) => b.number - a.number);
}

export interface ClassProgress {
  problems: number;
  completed: number;
  /** Due date of the first unfinished set, if any. */
  due: string | null;
  /** The set the student should pick up next. */
  activeSet: ProblemSetRecord | null;
}

/** Roll the class's problem sets up into the summary shown on the class card. */
export function getClassProgress(classId: string): ClassProgress {
  const sets = getProblemSets(classId);
  const problems = sets.reduce((total, set) => total + set.problems, 0);
  const completed = sets.reduce((total, set) => total + set.completed, 0);
  const unfinished = sets.filter((set) => set.completed < set.problems);
  return {
    problems,
    completed,
    due: unfinished.find((set) => set.due)?.due ?? null,
    activeSet: unfinished[0] ?? null,
  };
}
