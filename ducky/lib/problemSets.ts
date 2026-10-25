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
  /** Session id for each problem, in problem order. */
  sessionIds: string[];
}

export const PROBLEM_SETS: ProblemSetRecord[] = [
  {
    id: "phys-1401-ps3",
    classId: "phys-1401",
    number: 3,
    title: "Free fall",
    summary: "Two balls, different masses, dropped from the same height.",
    problems: 3,
    completed: 2,
    due: "Fri, Oct 30",
    posted: "Mon, Oct 20",
    sessionIds: ["demo-phys-3-p1", "demo-phys-3-p2", "demo"],
  },
  {
    id: "phys-1401-ps2",
    classId: "phys-1401",
    number: 2,
    title: "Projectile motion",
    summary: "Launch angles, components, and how far a ball actually travels.",
    problems: 3,
    completed: 0,
    due: "Wed, Oct 28",
    posted: "Fri, Oct 16",
    sessionIds: ["demo-phys-2", "demo-phys-2-p2", "demo-phys-2-p3"],
  },
  {
    id: "cs-314-stacks",
    classId: "cs-314",
    number: 1,
    title: "Stacks and queues",
    summary: "Track stack and queue state, then evaluate a postfix expression.",
    problems: 3,
    completed: 0,
    due: "Mon, Nov 2",
    posted: "Thu, Oct 22",
    sessionIds: ["demo-cs-stacks-p1", "demo-cs-stacks-p2", "demo-cs-stacks-p3"],
  },
  {
    id: "cs-314-sorting",
    classId: "cs-314",
    number: 2,
    title: "Sorting",
    summary: "Insertion sort traces, mergesort's merge step, and worst-case runtime.",
    problems: 3,
    completed: 0,
    due: "Mon, Nov 9",
    posted: "Fri, Oct 23",
    sessionIds: ["demo-cs-sorting-p1", "demo-cs-sorting-p2", "demo-cs-sorting-p3"],
  },
  {
    id: "cs-314-bst",
    classId: "cs-314",
    number: 3,
    title: "Binary search trees",
    summary: "Insertion, traversals, search paths, and recursive tree code.",
    problems: 3,
    completed: 0,
    due: "Mon, Nov 16",
    posted: "Fri, Oct 23",
    sessionIds: ["demo-cs-bst-p1", "demo-cs-bst-p2", "demo-cs-bst-p3"],
  },
  {
    id: "math-325k-ps1",
    classId: "math-325k",
    number: 1,
    title: "Mathematical induction",
    summary: "Sum identities, divisibility, and strong induction.",
    problems: 3,
    completed: 0,
    due: "Fri, Nov 6",
    posted: "Mon, Oct 19",
    sessionIds: ["demo-math-325k-ps1-p1", "demo-math-325k-ps1-p2", "demo-math-325k-ps1-p3"],
  },
  {
    id: "math-325k-ps2",
    classId: "math-325k",
    number: 2,
    title: "Functions and countability",
    summary: "Injective, surjective, bijective, and which infinite sets can be listed.",
    problems: 4,
    completed: 0,
    due: "Fri, Nov 13",
    posted: "Wed, Oct 21",
    sessionIds: [
      "demo-math-325k-ps2-p1",
      "demo-math-325k-ps2-p2",
      "demo-math-325k-ps2-p3",
      "demo-math-325k-ps2-p4",
    ],
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

/** The set a session belongs to, if it is one of the demo problem sessions. */
export function findProblemSetBySession(sessionId: string): ProblemSetRecord | undefined {
  return PROBLEM_SETS.find((set) => set.sessionIds.includes(sessionId));
}

/** The problem the student should pick up when opening the set card. */
export function entrySessionId(set: ProblemSetRecord): string {
  // Finished sets start over from the first problem when reviewed.
  if (set.completed >= set.problems) return set.sessionIds[0];
  return set.sessionIds[Math.min(set.completed, set.sessionIds.length - 1)];
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
  // Keep showing the set the student is already working on; otherwise start
  // with the lowest-numbered set rather than the newest one.
  const inProgress = unfinished.filter((set) => set.completed > 0);
  const next = inProgress[0] ?? [...unfinished].sort((a, b) => a.number - b.number)[0] ?? null;
  return {
    problems,
    completed,
    due: next?.due ?? null,
    activeSet: next,
  };
}
