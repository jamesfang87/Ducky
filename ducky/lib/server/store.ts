import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_POLICY, HINTS, INITIAL_STEPS, MISCONCEPTIONS, PROBLEM } from "@/lib/mock";
import type { Policy, Problem } from "@/lib/types";

/**
 * Temporary in-memory data store for the tutoring loop. Every route goes through
 * these functions, so swapping in Supabase later only changes this file.
 *
 * Each signed-in user gets their own copy of a session template ("demo",
 * "demo-cs-stacks-p1"), keyed by (sessionId, userId), so nobody can read or advance
 * someone else's session.
 */

/** Server-side misconception: ids are per subject, so wider than the UI's physics-only union. */
export interface ServerMisconception {
  id: string;
  label: string;
}

/** One detected misconception (feeds the tracker + teacher heatmap). */
export interface ServerMisconceptionEvent {
  id: string;
  misconception: string;
  problem: number;
  student: string;
  at: number;
}

/** The teacher's policy as the server enforces it. */
export type ServerPolicy = Policy;

export interface Solution {
  text: string;
  /** Spoken sentences matching any of these leak the answer (GRD-4, simple version). */
  finalAnswerPatterns: RegExp[];
}

export interface ServerSession {
  id: string;
  userId: string;
  student: string;
  problemIndex: number;
  hintsUsed: number;
  currentStep: number;
  /** Reasoning steps the student has explained correctly (0-based, sorted). */
  completedSteps: number[];
  /** The step the student was on when their last hint was used. */
  stepWhenHintsRanOut: number | null;
  revealed: boolean;
  /** The student explained their full reasoning; the tutor asks no more questions. */
  completed: boolean;
  creditEligible: boolean;
  /** Visual explanations generated so far, and whether one is being made now (rate limit). */
  visualsMade: number;
  visualBusy: boolean;
  /** Study-resource searches so far (each costs a SerpApi credit unless cached). */
  resourceSearches: number;
}

export interface StoredTurn {
  role: "student" | "tutor";
  text: string;
  via?: "voice" | "text";
  at: number;
}

export interface GuardEvent {
  kind: "answer_leak" | "hint_limit" | "visual_declined" | "visual_failed" | "jailbreak" | "answer_hunt" | "rate_limit";
  excerpt: string;
  at: number;
}

export interface RevealEvent {
  id: string;
  student: string;
  problem: number;
  stepIndex: number;
  stepLabel: string;
  at: number;
}

/** A student raised their hand. The packet is what the teacher needs to step in without asking "what's wrong?". */
export interface Escalation {
  id: string;
  sessionId: string;
  userId: string;
  student: string;
  problem: number;
  problemText: string;
  note: string;
  stepLabel: string;
  completedSteps: number;
  totalSteps: number;
  hintsUsed: number;
  hintLimit: number;
  openMisconceptions: string[];
  lastTurns: { role: "student" | "tutor"; text: string }[];
  at: number;
  status: "open" | "resolved";
  teacherNote?: string;
}

export interface ResolvedEvent {
  userId: string;
  student: string;
  misconception: string;
  problem: number;
  at: number;
}

export interface Template {
  problem: Problem;
  policy: ServerPolicy;
  solution: Solution;
  misconceptions: ServerMisconception[];
  hints: string[];
  steps: string[];
  startStep: number;
  /** Ducky's first line, shown before the student says anything. */
  opening: string;
  /** Session id of the next problem in the same set, if any. */
  next?: string | null;
}

const TEMPLATES: Record<string, Template> = {
  "demo-phys-3-p1": {
    problem: {
      index: 1,
      total: 3,
      course: "PHYS 1401",
      set: "Problem Set 3 · Free fall",
      prompt:
        "A ball is dropped from rest at h = 45 m. Ignoring air resistance, how long does it take to reach the ground, and how fast is it moving just before impact?",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "With v₀ = 0, h = ½gt² gives t = √(2h/g) = √(90/9.8) ≈ 3.03 s. " +
        "The impact speed is v = gt ≈ 9.8 × 3.03 ≈ 29.7 m/s downward.",
      finalAnswerPatterns: [/3\.0\d?\s*s/i, /29(\.\d+)?\s*m\/s/i],
    },
    misconceptions: [
      { id: "ff-forgets-v0-zero", label: "Uses a non-zero initial velocity for a dropped ball" },
      { id: "ff-g-as-speed", label: "Treats 9.8 as a speed instead of an acceleration" },
      { id: "ff-sign-error", label: "Mixes up signs and gets a negative fall time" },
      { id: "ff-linear-fall", label: "Thinks fall time is proportional to height instead of √height" },
    ],
    hints: [
      "With v₀ = 0, how does height depend on time? Start from h = ½gt².",
      "Once you have the fall time, how do you get speed from acceleration?",
    ],
    steps: [
      "Pick the free-fall equation that relates height and time",
      "Solve for the time to fall 45 m",
      "Use v = gt to get the impact speed",
      "Check units and direction",
    ],
    startStep: 0,
    opening: "The ball is dropped, not thrown. What is its velocity at the moment it leaves your hand?",
  },
  "demo-phys-3-p2": {
    problem: {
      index: 2,
      total: 3,
      course: "PHYS 1401",
      set: "Problem Set 3 · Free fall",
      prompt:
        "Two identical balls are dropped from rest, one from 20 m and one from 80 m. How many times longer does the higher ball take to land? Explain why the answer does not depend on mass.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "t = √(2h/g), so the ratio is √(80/20) = √4 = 2: the higher ball takes twice as long. " +
        "Mass cancels because a = F/m = mg/m = g, so both balls accelerate at the same rate.",
      finalAnswerPatterns: [/(twice|two times|2 times)/i, /√\s*\(?\s*80\s*\/\s*20/i],
    },
    misconceptions: [
      { id: "ff-mass-changes-time", label: "Thinks the heavier ball lands first" },
      { id: "ff-linear-scaling", label: "Says four times longer because the height is four times bigger" },
      { id: "ff-ratio-inverted", label: "Computes the time ratio upside down" },
      { id: "ff-bigger-force-bigger-accel", label: "Confuses a bigger force with a bigger acceleration" },
    ],
    hints: [
      "Write the fall time as a function of height. What happens when you divide the two times?",
      "Where does mass appear in a = F/m for gravity, and what happens to it?",
    ],
    steps: [
      "Write the fall time as a function of height",
      "Take the ratio of the two times",
      "Show that g cancels",
      "Explain why mass drops out of a = F/m",
    ],
    startStep: 0,
    opening: "Before calculating: does the heavier ball take longer to fall? Why or why not?",
  },
  demo: {
    problem: PROBLEM,
    policy: DEFAULT_POLICY,
    solution: {
      text: "t = √(2h/g) ≈ 2.02 s for both balls. Mass cancels because a = F/m = mg/m = g, so both accelerate at g.",
      finalAnswerPatterns: [/2\.02/, /√\s*\(?\s*2\s*h\s*\/\s*g/i, /sqrt\s*\(?\s*2\s*h\s*\/\s*g/i],
    },
    misconceptions: MISCONCEPTIONS,
    hints: [...HINTS],
    steps: INITIAL_STEPS.map((s) => s.label),
    startStep: Math.max(0, INITIAL_STEPS.findIndex((s) => s.status === "current")),
    opening: "Before we calculate anything: if you drop both balls at the same moment, what do you expect to happen?",
  },
  "demo-phys-2": {
    problem: {
      index: 1,
      total: 3,
      course: "PHYS 1401",
      set: "Problem Set 2 · Projectile motion",
      prompt:
        "A ball is launched from level ground at 20 m/s at 30° above the horizontal. Ignoring air resistance, find the maximum height it reaches and how far from the launch point it lands. Explain why the horizontal and vertical motions can be treated separately.",
    },
    policy: DEFAULT_POLICY,
    solution: {
      text:
        "Split the launch velocity: v₀ₓ = 20 cos 30° ≈ 17.3 m/s and v₀ᵧ = 20 sin 30° = 10 m/s. " +
        "At the top vᵧ = 0, so t_up = v₀ᵧ/g ≈ 1.02 s and h = v₀ᵧ²/(2g) ≈ 5.1 m. " +
        "The flight lasts 2 t_up ≈ 2.04 s, so the range is v₀ₓ × 2.04 ≈ 35 m. " +
        "Gravity acts only vertically, so vₓ stays constant while vᵧ changes at 9.8 m/s²; that is why the two directions are independent.",
      finalAnswerPatterns: [/35(\.\d+)?\s*m/i, /5\.1(?:0)?\s*m/i, /17\.3\s*m\/s/i],
    },
    misconceptions: [
      { id: "pm-uses-speed-not-components", label: "Uses 20 m/s as one velocity instead of splitting it into components" },
      { id: "pm-gravity-slows-horizontal", label: "Thinks gravity also slows the horizontal motion" },
      { id: "pm-top-velocity-zero", label: "Says the whole velocity is zero at the top, not just the vertical part" },
      { id: "pm-path-length-as-range", label: "Uses the path length instead of the horizontal distance for range" },
      { id: "pm-forgets-full-flight", label: "Uses the time to the top as the total flight time" },
    ],
    hints: [
      "Start by drawing the launch velocity at 30°. What are its horizontal and vertical components?",
      "At the highest point, what is the vertical velocity? Use vᵧ = v₀ᵧ − gt to find how long that takes.",
    ],
    steps: [
      "Split the launch velocity into x and y components",
      "Find the time to reach the highest point",
      "Use the vertical motion to get the maximum height",
      "Double the time and multiply by vₓ for the range",
      "Explain why the two directions are independent",
    ],
    startStep: 0,
    opening: "Before any equations: at the highest point of the flight, what is happening to the ball's velocity?",
  },
  "demo-phys-2-p2": {
    problem: {
      index: 2,
      total: 3,
      course: "PHYS 1401",
      set: "Problem Set 2 · Projectile motion",
      prompt:
        "A ball is kicked from level ground at 15 m/s at 45°. Ignoring air resistance, find the maximum height and the horizontal range.",
    },
    policy: DEFAULT_POLICY,
    solution: {
      text:
        "At 45°, v₀ₓ = v₀ᵧ = 15 cos 45° ≈ 10.6 m/s. " +
        "The time to the top is 10.6/9.8 ≈ 1.08 s, so h = v₀ᵧ²/(2g) ≈ 5.7 m. " +
        "The flight lasts about 2.16 s, so the range is 10.6 × 2.16 ≈ 22.9 m.",
      finalAnswerPatterns: [/22\.9\s*m/i, /5\.7\s*m/i, /10\.6\s*m\/s/i],
    },
    misconceptions: [
      { id: "pm2-uses-15-as-vy", label: "Uses 15 m/s as the vertical component" },
      { id: "pm2-forgets-double", label: "Uses only the upward half of the flight for the range" },
      { id: "pm2-adds-components", label: "Adds the components instead of using them separately" },
      { id: "pm2-swaps-sin-cos", label: "Swaps sine and cosine for the components" },
    ],
    hints: [
      "At 45°, how do the horizontal and vertical components compare?",
      "Once you find the time to the top, how long is the whole flight?",
    ],
    steps: [
      "Split 15 m/s at 45° into components",
      "Find the time to reach the top",
      "Get the maximum height",
      "Use the full flight time for the range",
    ],
    startStep: 0,
    opening: "At 45°, what is special about the horizontal and vertical components of the kick?",
  },
  "demo-phys-2-p3": {
    problem: {
      index: 3,
      total: 3,
      course: "PHYS 1401",
      set: "Problem Set 2 · Projectile motion",
      prompt:
        "A ball rolls off a 20 m cliff horizontally at 12 m/s. How long is it in the air, and how far from the base of the cliff does it land?",
    },
    policy: DEFAULT_POLICY,
    solution: {
      text:
        "The initial vertical velocity is zero, so 20 = ½gt² gives t = √(40/9.8) ≈ 2.02 s. " +
        "Horizontal velocity stays 12 m/s, so the ball lands 12 × 2.02 ≈ 24.2 m from the base.",
      finalAnswerPatterns: [/2\.0\d?\s*s/i, /24(\.\d+)?\s*m/i],
    },
    misconceptions: [
      { id: "pm3-horizontal-delays-fall", label: "Thinks the horizontal speed keeps the ball in the air longer" },
      { id: "pm3-uses-12-vertically", label: "Uses 12 m/s as the vertical velocity" },
      { id: "pm3-forgets-zero-v0", label: "Forgets that the initial vertical velocity is zero" },
      { id: "pm3-adds-speeds", label: "Adds horizontal and vertical speeds to get the fall time" },
    ],
    hints: [
      "The ball starts with no vertical speed. How long does it take to fall 20 m?",
      "Nothing pushes horizontally once it leaves the cliff, so what is vₓ during the fall?",
    ],
    steps: [
      "Set the initial vertical velocity to zero",
      "Solve the vertical fall for the time",
      "Use the constant horizontal velocity for the distance",
      "Explain why horizontal speed does not change the fall time",
    ],
    startStep: 0,
    opening: "The ball leaves the cliff horizontally. What is its vertical velocity at that instant?",
  },
  "demo-cs-stacks-p1": {
    problem: {
      index: 1,
      total: 3,
      course: "CS 314",
      set: "Problem Set 1 · Stacks and queues",
      prompt:
        "What does this code print?\n\n" +
        "Deque<Integer> stack = new ArrayDeque<>();\n" +
        "stack.push(4);\n" +
        "stack.push(7);\n" +
        "stack.push(2);\n" +
        "stack.pop();\n" +
        "stack.push(9);\n" +
        "System.out.print(stack.peek());\n" +
        "System.out.print(stack.pop());\n" +
        "System.out.print(stack.size());",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "The stack is [4], then [4, 7], then [4, 7, 2]. The pop removes 2, leaving [4, 7]. " +
        "Pushing 9 gives [4, 7, 9]. peek prints 9 without removing it, pop prints 9 and removes it, " +
        "and size prints 2. Output: 992.",
      finalAnswerPatterns: [/\b9\s*,?\s*9\s*,?\s*2\b/],
    },
    misconceptions: [
      { id: "stk-peek-removes", label: "Thinks peek removes the top element" },
      { id: "stk-lifo-vs-fifo", label: "Treats the stack as a queue" },
      { id: "stk-size-order", label: "Counts the size before the second pop" },
      { id: "stk-top-direction", label: "Reads the bottom of the stack instead of the top" },
    ],
    hints: [
      "Track the stack after the three pushes and the first pop.",
      "Does peek remove anything? How many elements are left after the second pop?",
    ],
    steps: [
      "Track the stack after each push",
      "Apply pop and note that it removes the top",
      "Distinguish peek from pop",
      "Count the remaining elements for size",
    ],
    startStep: 0,
    opening: "What is on top of the stack after the first three pushes?",
  },
  "demo-cs-stacks-p2": {
    problem: {
      index: 2,
      total: 3,
      course: "CS 314",
      set: "Problem Set 1 · Stacks and queues",
      prompt:
        "What does this code print?\n\n" +
        "Queue<Integer> q = new ArrayDeque<>();\n" +
        "q.add(4);\n" +
        "q.add(7);\n" +
        "q.add(2);\n" +
        "q.remove();\n" +
        "q.add(9);\n" +
        "System.out.print(q.peek());\n" +
        "System.out.print(q.remove());\n" +
        "System.out.print(q.size());",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "The queue is [4, 7, 2]. remove() takes the front 4, leaving [7, 2], and adding 9 gives [7, 2, 9]. " +
        "peek prints 7 without removing it, remove prints 7 and leaves [2, 9], and size prints 2. Output: 772.",
      finalAnswerPatterns: [/\b7\s*,?\s*7\s*,?\s*2\b/],
    },
    misconceptions: [
      { id: "q-fifo-vs-lifo", label: "Uses LIFO order for the queue" },
      { id: "q-peek-removes", label: "Thinks peek removes the front element" },
      { id: "q-remove-end", label: "Removes the newest element instead of the oldest" },
      { id: "q-size-order", label: "Counts the size before the second removal" },
    ],
    hints: [
      "After the three adds, which element is at the front of the queue?",
      "Does peek change the queue, and what does remove take?",
    ],
    steps: [
      "Track the queue after each add",
      "Remove from the front and add to the back",
      "Distinguish peek from remove",
      "Count the remaining elements for size",
    ],
    startStep: 0,
    opening: "After the three adds, which element is at the front of the queue?",
  },
  "demo-cs-stacks-p3": {
    problem: {
      index: 3,
      total: 3,
      course: "CS 314",
      set: "Problem Set 1 · Stacks and queues",
      prompt:
        "Evaluate the postfix expression 5 3 + 8 2 - * using a stack. Give the final value and the stack after each operator.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Push 5 and 3, then '+' pops 3 and 5 and pushes 8. Push 8 and 2, then '-' pops 2 and 8 and pushes 6. " +
        "Finally '*' pops 6 and 8 and pushes 48. Final value: 48. " +
        "The stack is [8] after '+', [8, 6] after '-', and [48] after '*'.",
      finalAnswerPatterns: [/\b48\b/],
    },
    misconceptions: [
      { id: "postfix-operand-order", label: "Reverses the operands for subtraction or division" },
      { id: "postfix-operator-push", label: "Pushes operators instead of applying them" },
      { id: "postfix-infix", label: "Evaluates it as if it were infix" },
      { id: "postfix-final-stack", label: "Stops before the final operator" },
    ],
    hints: [
      "Where do 5 and 3 go when you read the expression left to right?",
      "When you see '-', which two values does it combine, and in what order?",
    ],
    steps: [
      "Push operands as you read them",
      "On an operator, pop two values",
      "Apply the operator with the second pop on the left",
      "Push the result",
      "Read the final stack",
    ],
    startStep: 0,
    opening: "Where do 5 and 3 go when you read the expression left to right?",
  },
  "demo-cs-sorting-p1": {
    problem: {
      index: 1,
      total: 3,
      course: "CS 314",
      set: "Problem Set 2 · Sorting",
      prompt:
        "Show the array after each pass of insertion sort on [7, 3, 9, 1, 5], then give the total number of comparisons, including the comparison that stops each inner loop.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Pass 1 inserts 3: [3, 7, 9, 1, 5], 1 comparison. " +
        "Pass 2 inserts 9: [3, 7, 9, 1, 5], 1 comparison. " +
        "Pass 3 inserts 1: [1, 3, 7, 9, 5], 3 comparisons. " +
        "Pass 4 inserts 5: [1, 3, 5, 7, 9], 3 comparisons. " +
        "Total: 8 comparisons.",
      finalAnswerPatterns: [/\[\s*1\s*,\s*3\s*,\s*5\s*,\s*7\s*,\s*9\s*\]/i, /8\s*comparisons?/i],
    },
    misconceptions: [
      { id: "ins-swaps-not-shifts", label: "Swaps elements instead of shifting the prefix" },
      { id: "ins-missing-pass", label: "Skips a pass or stops before the last element" },
      { id: "ins-count-success-only", label: "Counts only comparisons that trigger a shift" },
      { id: "ins-unsorted-prefix", label: "Loses the sorted-prefix invariant" },
    ],
    hints: [
      "After the first pass, what does the array look like?",
      "For 5, how many elements does it compare against before it stops?",
    ],
    steps: [
      "Start with [7] as the sorted prefix",
      "Insert 3, shifting 7 right",
      "Insert 9 and note one comparison",
      "Insert 1 and count three comparisons",
      "Insert 5 and count three comparisons",
    ],
    startStep: 0,
    opening: "After the first pass, what does the array look like?",
  },
  "demo-cs-sorting-p2": {
    problem: {
      index: 2,
      total: 3,
      course: "CS 314",
      set: "Problem Set 2 · Sorting",
      prompt:
        "A mergesort call on [38, 27, 43, 3, 9, 82, 10] splits it into [38, 27, 43] and [3, 9, 82, 10], then sorts each half. " +
        "The sorted halves are [27, 38, 43] and [3, 9, 10, 82]. Give the array after the merge step and the number of comparisons the merge makes.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Compare the fronts: 27 vs 3 → 3; 27 vs 9 → 9; 27 vs 10 → 10; 27 vs 82 → 27; 38 vs 82 → 38; 43 vs 82 → 43. " +
        "The left half is empty, so copy the remaining 82. " +
        "Merged array: [3, 9, 10, 27, 38, 43, 82]. The merge makes 6 comparisons.",
      finalAnswerPatterns: [
        /\[\s*3\s*,\s*9\s*,\s*10\s*,\s*27\s*,\s*38\s*,\s*43\s*,\s*82\s*\]/i,
        /6\s*comparisons?/i,
      ],
    },
    misconceptions: [
      { id: "merge-compares-nonfront", label: "Compares arbitrary elements instead of the two fronts" },
      { id: "merge-forgets-remainder", label: "Leaves out the rest of a half after one side empties" },
      { id: "merge-counts-copies", label: "Counts copies as comparisons" },
      { id: "merge-unsorted-halves", label: "Merges the unsorted halves instead of the sorted ones" },
    ],
    hints: [
      "Which two elements does the merge compare first?",
      "After 10 is copied, what are the two front elements?",
    ],
    steps: [
      "Put a pointer at the front of each sorted half",
      "Compare the two front values and copy the smaller",
      "Advance that half's pointer",
      "Repeat until one half is empty, then copy the rest",
      "Count the comparisons between fronts",
    ],
    startStep: 0,
    opening: "Which two elements does the merge compare first?",
  },
  "demo-cs-sorting-p3": {
    problem: {
      index: 3,
      total: 3,
      course: "CS 314",
      set: "Problem Set 2 · Sorting",
      prompt: "What is the worst-case runtime of insertion sort, and what input shape produces it?",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "The worst case is O(n²). It happens on reverse-sorted input: each new element shifts past every earlier element, " +
        "so the total work is 1 + 2 + … + (n − 1) = n(n − 1)/2, which is O(n²).",
      finalAnswerPatterns: [/O\s*\(\s*n\s*(?:\^?2|²)\s*\)/i, /reverse[- ]sorted/i],
    },
    misconceptions: [
      { id: "ins2-confuses-best", label: "Gives the best-case O(n) instead of the worst case" },
      { id: "ins2-wrong-input", label: "Names sorted or random input as the worst case" },
      { id: "ins2-linear", label: "Says O(n) because there is one outer loop" },
      { id: "ins2-no-series", label: "Knows each element moves but cannot sum the work" },
    ],
    hints: [
      "Which input makes the inner loop work hardest?",
      "For the element at position i, how many earlier elements might it pass?",
    ],
    steps: [
      "Identify the best and worst input shapes",
      "Count the shifts for one element",
      "Sum the shifts over all elements",
      "Simplify the sum to Big-O",
    ],
    startStep: 0,
    opening: "Which input makes the inner loop work hardest?",
  },
  "demo-cs-bst-p1": {
    problem: {
      index: 1,
      total: 3,
      course: "CS 314",
      set: "Problem Set 3 · Binary search trees",
      prompt:
        "Insert 50, 30, 70, 20, 40, 60, 80 into an empty binary search tree. Give the inorder and preorder traversals.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "The root is 50; 30 goes left and 70 right. Then 20 and 40 go below 30, and 60 and 80 go below 70. " +
        "Inorder (left, root, right): 20, 30, 40, 50, 60, 70, 80. " +
        "Preorder (root, left, right): 50, 30, 20, 40, 70, 60, 80.",
      finalAnswerPatterns: [
        /20\s*,?\s*30\s*,?\s*40\s*,?\s*50\s*,?\s*60\s*,?\s*70\s*,?\s*80/,
        /50\s*,?\s*30\s*,?\s*20\s*,?\s*40\s*,?\s*70\s*,?\s*60\s*,?\s*80/,
      ],
    },
    misconceptions: [
      { id: "bst-inorder-wrong", label: "Uses root-left-right for inorder" },
      { id: "bst-insert-order", label: "Ignores comparisons and inserts by level" },
      { id: "bst-duplicates", label: "Places equal keys on both sides" },
      { id: "bst-preorder-wrong", label: "Gives the inorder sequence for preorder" },
    ],
    hints: [
      "Where does 30 go relative to the root 50?",
      "In inorder, do you visit the root before or after the left subtree?",
    ],
    steps: [
      "Insert each key by comparing with the current node",
      "Build the tree shape",
      "Inorder: left, root, right",
      "Preorder: root, left, right",
    ],
    startStep: 0,
    opening: "Where does 30 go relative to the root 50?",
  },
  "demo-cs-bst-p2": {
    problem: {
      index: 2,
      total: 3,
      course: "CS 314",
      set: "Problem Set 3 · Binary search trees",
      prompt:
        "Using the BST from Problem 1 (root 50, with 30, 70, 20, 40, 60, 80 inserted), list the nodes visited when searching for 60.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Start at 50: 60 > 50, so go right to 70. Then 60 < 70, so go left to 60 and stop. " +
        "The search visits 50, 70, 60.",
      finalAnswerPatterns: [/50\s*(?:,|→|->)\s*70\s*(?:,|→|->)\s*60/],
    },
    misconceptions: [
      { id: "search-stops-root", label: "Stops at the root without comparing" },
      { id: "search-wrong-direction", label: "Goes left when the target is larger" },
      { id: "search-inorder", label: "Lists an inorder traversal instead of the search path" },
      { id: "search-misses", label: "Says 60 is not in the tree" },
    ],
    hints: [
      "60 is larger than 50. Which subtree do you search?",
      "At 70, is 60 smaller or larger? Which way do you go?",
    ],
    steps: [
      "Compare the target with the current node",
      "Go left if it is smaller, right if it is larger",
      "Repeat until found or the child is null",
      "List only the nodes visited",
    ],
    startStep: 0,
    opening: "60 is larger than 50. Which subtree do you search?",
  },
  "demo-cs-bst-p3": {
    problem: {
      index: 3,
      total: 3,
      course: "CS 314",
      set: "Problem Set 3 · Binary search trees",
      prompt:
        "Using the same BST, give the exact output of this method:\n\n" +
        "void mystery(Node n) {\n" +
        "  if (n == null) return;\n" +
        "  mystery(n.right);\n" +
        "  System.out.print(n.val + \" \");\n" +
        "  mystery(n.left);\n" +
        "}",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "The method recurses right, prints the node, then recurses left: right, root, left. " +
        "That is reverse inorder, so the values come out from largest to smallest: " +
        "80 70 60 50 40 30 20.",
      finalAnswerPatterns: [/80\s+70\s+60\s+50\s+40\s+30\s+20/],
    },
    misconceptions: [
      { id: "rev-inorder-as-inorder", label: "Reads the method as left-root-right" },
      { id: "rev-prints-root-first", label: "Prints the root before recursing right" },
      { id: "rev-misses-leaves", label: "Skips leaves or stops early" },
      { id: "rev-postorder", label: "Calls the traversal postorder" },
    ],
    hints: [
      "The method recurses right before printing. Which node prints first?",
      "For a BST, what order does right-root-left produce?",
    ],
    steps: [
      "Read the order of recursive calls and the print",
      "Identify right, root, left",
      "Recognize that as reverse inorder",
      "Apply it to the tree",
    ],
    startStep: 0,
    opening: "The method recurses right before printing. Which node prints first?",
  },
  "demo-math-325k-ps1-p1": {
    problem: {
      index: 1,
      total: 3,
      course: "MATH 325K",
      set: "Problem Set 1 · Mathematical induction",
      prompt:
        "Prove by induction that for every integer n ≥ 1, 1 + 3 + 5 + ⋯ + (2n − 1) = n².",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Base case n = 1: the left side is 1 and the right side is 1² = 1. " +
        "Assume for some k ≥ 1 that 1 + 3 + ⋯ + (2k − 1) = k². " +
        "Then the sum for k + 1 is k² + (2(k + 1) − 1) = k² + 2k + 1 = (k + 1)². " +
        "So P(k) implies P(k + 1), and by induction the identity holds for every n ≥ 1.",
      finalAnswerPatterns: [],
    },
    misconceptions: [
      { id: "ind-missing-base", label: "Skips the base case" },
      { id: "ind-assumes-result", label: "Assumes P(k + 1) instead of proving it" },
      { id: "ind-wrong-next-term", label: "Adds 2k − 1 instead of 2k + 1" },
      { id: "ind-no-conclusion", label: "Does the algebra but never invokes induction" },
    ],
    hints: [
      "Start with n = 1. What is the left side, and what is the right side?",
      "Write the sum for k + 1. How does it relate to the sum for k? What term did you add?",
    ],
    steps: [
      "Write P(n) and check the base case n = 1",
      "State the induction hypothesis for n = k",
      "Add the next term, 2k + 1, to both sides",
      "Simplify k² + 2k + 1 and conclude P(k + 1)",
      "Invoke induction to finish",
    ],
    startStep: 0,
    opening: "Before any algebra: what does P(1) say, and is it true?",
  },
  "demo-math-325k-ps1-p2": {
    problem: {
      index: 2,
      total: 3,
      course: "MATH 325K",
      set: "Problem Set 1 · Mathematical induction",
      prompt: "Prove by induction that for every integer n ≥ 0, 7 divides 8ⁿ − 1.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Base case n = 0: 8⁰ − 1 = 0 = 7 · 0. " +
        "Assume 8^k − 1 = 7m for some integer m. " +
        "Then 8^(k+1) − 1 = 8 · 8^k − 1 = 8(8^k − 1) + 7 = 8(7m) + 7 = 7(8m + 1). " +
        "That is divisible by 7, so P(k + 1) holds. By induction, 7 divides 8ⁿ − 1 for every n ≥ 0.",
      finalAnswerPatterns: [],
    },
    misconceptions: [
      { id: "ind2-wrong-base", label: "Starts at n = 1 while claiming the result for n ≥ 0" },
      { id: "ind2-no-hypothesis", label: "Never uses the assumption that 8^k − 1 is divisible by 7" },
      { id: "ind2-loses-seven", label: "Rewrites incorrectly and loses the extra +7" },
      { id: "ind2-assumes-conclusion", label: "Assumes 8^(k+1) − 1 is divisible by 7" },
    ],
    hints: [
      "What is 8⁰ − 1? Is it divisible by 7?",
      "Write 8^(k+1) as 8 · 8^k. How can you make the hypothesis 8^k − 1 appear?",
    ],
    steps: [
      "Check the base case n = 0",
      "Write the induction hypothesis as a multiple of 7",
      "Rewrite 8^(k+1) − 1 to expose 8^k − 1",
      "Factor out 7 and conclude",
    ],
    startStep: 0,
    opening: "What does the statement say for n = 0, and why is that the right base case?",
  },
  "demo-math-325k-ps1-p3": {
    problem: {
      index: 3,
      total: 3,
      course: "MATH 325K",
      set: "Problem Set 1 · Mathematical induction",
      prompt:
        "Prove that every integer n ≥ 12 can be written as 4a + 5b for some nonnegative integers a and b.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Base cases: 12 = 4 · 3, 13 = 4 · 2 + 5, 14 = 4 + 5 · 2, and 15 = 5 · 3. " +
        "For the strong step, assume every integer from 12 through k − 1 has such a representation, with k ≥ 16. " +
        "Then k − 4 ≥ 12, so k − 4 = 4a + 5b for some a, b ≥ 0. " +
        "Adding one more 4 gives k = 4(a + 1) + 5b. " +
        "By strong induction, every n ≥ 12 has a representation.",
      finalAnswerPatterns: [],
    },
    misconceptions: [
      { id: "ind3-one-base", label: "Checks only n = 12 and assumes the rest follow" },
      { id: "ind3-weak-hypothesis", label: "Assumes only P(k) instead of every value below k" },
      { id: "ind3-negative-coeff", label: "Allows negative a or b" },
      { id: "ind3-gap", label: "Uses k − 4 without checking k − 4 ≥ 12" },
    ],
    hints: [
      "Which four values do you need to check so that subtracting 4 always lands on a known value?",
      "If k − 4 is representable, how do you represent k?",
    ],
    steps: [
      "Check the four base cases 12, 13, 14, and 15",
      "State the strong hypothesis for every value from 12 through k − 1",
      "For k ≥ 16, note k − 4 ≥ 12 and apply the hypothesis",
      "Add one 4 to get the representation for k",
    ],
    startStep: 0,
    opening: "Why might a single base case not be enough for this problem?",
  },
  "demo-math-325k-ps2-p1": {
    problem: {
      index: 1,
      total: 4,
      course: "MATH 325K",
      set: "Problem Set 2 · Functions and countability",
      prompt:
        "Let A = {1, 2, 3}, B = {a, b, c}, and C = {a, b}. Classify each function as injective, surjective, bijective, or neither, and explain: f: A → B with f(1) = a, f(2) = b, f(3) = c; g: A → B with g(1) = a, g(2) = a, g(3) = b; h: A → C with h(1) = a, h(2) = b, h(3) = a. Then give an example of a function that is injective but not surjective.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "f is bijective: its three outputs are distinct and every element of B is hit. " +
        "g is neither: 1 and 2 share a, so it is not injective, and c is never hit, so it is not surjective. " +
        "h is surjective but not injective: both a and b are hit, but 1 and 3 share a. " +
        "An injective-only example is k: {1, 2} → B with k(1) = a and k(2) = b: the outputs are distinct, but c is not hit.",
      finalAnswerPatterns: [],
    },
    misconceptions: [
      { id: "fn-codomain-range", label: "Treats the codomain as the range" },
      { id: "fn-injective-one-output", label: "Thinks injective means each input has one output" },
      { id: "fn-counts-sizes", label: "Uses set sizes alone without checking the actual mapping" },
      { id: "fn-bijective-everywhere", label: "Calls any function with distinct outputs bijective without checking coverage" },
    ],
    hints: [
      "For injectivity, do any two inputs share an output?",
      "For surjectivity, is every element of the codomain actually used?",
    ],
    steps: [
      "Recall what injective, surjective, and bijective mean",
      "Classify f by checking distinct outputs and coverage of B",
      "Classify g: find a repeated output and a missed codomain element",
      "Classify h: find a repeated output but check whether C is covered",
      "Build an injective-only example by making the codomain larger than the domain",
    ],
    startStep: 0,
    opening: "Start with definitions: what has to be true for a function to be injective?",
  },
  "demo-math-325k-ps2-p2": {
    problem: {
      index: 2,
      total: 4,
      course: "MATH 325K",
      set: "Problem Set 2 · Functions and countability",
      prompt: "Define f: Z → Z by f(n) = 2n. Is f injective? Is f surjective? Justify both answers.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Injective: if f(a) = f(b), then 2a = 2b, so a = b. " +
        "Not surjective: 1 is in the codomain Z, but 2n = 1 has no integer solution. " +
        "The range is the even integers, not all of Z. So f is injective but not surjective.",
      finalAnswerPatterns: [],
    },
    misconceptions: [
      { id: "fn2-injective-implies-surjective", label: "Assumes injective means surjective" },
      { id: "fn2-domain-confusion", label: "Confuses the domain with the codomain" },
      { id: "fn2-odd-preimage", label: "Claims every odd integer has an integer half" },
      { id: "fn2-bijective", label: "Calls it bijective because its graph is a line" },
    ],
    hints: [
      "If 2a = 2b, what can you divide both sides by?",
      "Try to solve 2n = 1 for an integer n. What happens?",
    ],
    steps: [
      "Write the definitions of injective and surjective for this domain and codomain",
      "Prove injectivity by assuming f(a) = f(b)",
      "Look for an integer in the codomain with no preimage",
      "Conclude that f is injective but not surjective",
    ],
    startStep: 0,
    opening: "Before deciding, say what injective and surjective each require here.",
  },
  "demo-math-325k-ps2-p3": {
    problem: {
      index: 3,
      total: 4,
      course: "MATH 325K",
      set: "Problem Set 2 · Functions and countability",
      prompt:
        "Show that the set of integers Z is countably infinite by describing a bijection with N or an explicit listing.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "List the integers as 0, 1, −1, 2, −2, 3, −3, … . " +
        "Every integer appears exactly once: 0 at the start, and each n ≥ 1 appears as n followed by −n. " +
        "So this listing is a bijection N → Z, and Z is countably infinite.",
      finalAnswerPatterns: [],
    },
    misconceptions: [
      { id: "cnt-infinite-uncountable", label: "Thinks every infinite set is uncountable" },
      { id: "cnt-positives-only", label: "Lists only the nonnegative integers" },
      { id: "cnt-duplicates", label: "Lists an integer twice and misses another" },
      { id: "cnt-subset-larger", label: "Thinks Z cannot be countable because N is a subset of Z" },
    ],
    hints: [
      "Can you write the integers in a sequence that never skips one?",
      "Where does 3 appear in 0, 1, −1, 2, −2, …? Where does −3 appear?",
    ],
    steps: [
      "Recall the definition of countably infinite",
      "Propose a listing that alternates positive and negative integers",
      "Show every integer appears exactly once",
      "Conclude that the listing is a bijection with N",
    ],
    startStep: 0,
    opening: "What does it mean, precisely, for a set to be countably infinite?",
  },
  "demo-math-325k-ps2-p4": {
    problem: {
      index: 4,
      total: 4,
      course: "MATH 325K",
      set: "Problem Set 2 · Functions and countability",
      prompt: "Prove that the open interval (0, 1) is uncountable using Cantor's diagonal argument.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Suppose (0, 1) were countable, so its elements could be listed as r1, r2, r3, … . " +
        "Write each rn as a decimal 0.dn1 dn2 dn3 … . " +
        "Define d = 0.e1 e2 e3 … by choosing en ≠ dnn, avoiding 0 and 9 (pick 1 unless dnn = 1, then pick 2). " +
        "Then d is in (0, 1), but d differs from rn in the nth digit for every n, so d is not in the list. " +
        "That contradiction shows (0, 1) is uncountable.",
      finalAnswerPatterns: [],
    },
    misconceptions: [
      { id: "diag-9-issue", label: "Ignores the two-decimal-expansion problem (0.4999… = 0.5000…)" },
      { id: "diag-one-missing", label: "Thinks one missing number is not a contradiction" },
      { id: "diag-finite-list", label: "Argues about a finite list instead of a complete infinite list" },
      { id: "diag-not-in-interval", label: "Builds a number outside (0, 1)" },
    ],
    hints: [
      "Suppose you had a complete list. What could you change in the first number to make a new number?",
      "How do you change the nth digit so the new number cannot equal the nth number on the list?",
    ],
    steps: [
      "Assume for contradiction that (0, 1) can be listed",
      "Write the decimal digits of each number on the list",
      "Build a new number that differs from the nth number in the nth digit",
      "Choose digits away from 0 and 9 to avoid duplicate decimal representations",
      "Show the new number is in (0, 1) but missing from the list",
    ],
    startStep: 0,
    opening: "What would it mean to have a complete list of every number between 0 and 1?",
  },
};

interface Db {
  sessions: Map<string, ServerSession>;
  turns: Map<string, StoredTurn[]>;
  misconceptionEvents: ServerMisconceptionEvent[];
  guardEvents: (GuardEvent & { sessionKey: string })[];
  revealEvents: RevealEvent[];
  escalations: Escalation[];
  /** Misconceptions a student worked through, with who, so a teacher can pair them with someone stuck (HUM-2). */
  resolvedEvents: ResolvedEvent[];
  /** Students who said teachers may suggest them as a peer helper. */
  peerOptIn: Set<string>;
  /** Session keys whose saved chat has already been read from Supabase this process. */
  hydrated: Set<string>;
  /** Templates for teacher-uploaded problems, loaded from Supabase (lib/server/assignments.ts). */
  uploaded: Map<string, { template: Template; at: number }>;
}

// Kept on globalThis so `next dev` hot reloads don't wipe the demo state.
const g = globalThis as typeof globalThis & { __duckyDb?: Db };
const db: Db = (g.__duckyDb ??= {
  sessions: new Map(),
  turns: new Map(),
  misconceptionEvents: [],
  guardEvents: [],
  revealEvents: [],
  escalations: [],
  resolvedEvents: [],
  peerOptIn: new Set(),
  hydrated: new Set(),
  uploaded: new Map(),
});
db.hydrated ??= new Set();
db.escalations ??= [];
db.resolvedEvents ??= [];
db.peerOptIn ??= new Set();
db.uploaded ??= new Map();

/** Built-in demo template, or an uploaded problem's (cached by `cacheTemplate`). */
const templateOf = (sessionId: string): Template | undefined => TEMPLATES[sessionId] ?? db.uploaded.get(sessionId)?.template;

export const isDemoSession = (sessionId: string): boolean => sessionId in TEMPLATES;

export function cacheTemplate(sessionId: string, template: Template): void {
  db.uploaded.set(sessionId, { template, at: Date.now() });
}

const keyOf = (s: Pick<ServerSession, "id" | "userId">) => `${s.id}:${s.userId}`;

/** A fresh copy of a template's session state for one student. */
function initialState(t: Template, sessionId: string, userId: string, student: string): ServerSession {
  return {
    id: sessionId,
    userId,
    student,
    problemIndex: t.problem.index,
    hintsUsed: 0,
    currentStep: t.startStep,
    completedSteps: Array.from({ length: t.startStep }, (_, i) => i),
    stepWhenHintsRanOut: null,
    revealed: false,
    completed: false,
    creditEligible: true,
    visualsMade: 0,
    visualBusy: false,
    resourceSearches: 0,
  };
}

/** Returns the caller's own copy of the session, creating it on first use. Null if no such session. */
export function getSession(sessionId: string, user: { userId: string; name: string }): ServerSession | null {
  const t = templateOf(sessionId);
  if (!t) return null;
  const key = `${sessionId}:${user.userId}`;
  let s = db.sessions.get(key);
  if (!s) {
    s = initialState(t, sessionId, user.userId, user.name);
    db.sessions.set(key, s);
  }
  return s;
}

/**
 * Wipe this student's progress and transcript for one question, leaving every
 * other session alone. The caller deletes the saved chat before calling this.
 */
export function resetSession(s: ServerSession): ServerSession {
  const t = tpl(s);
  const key = keyOf(s);
  const fresh = initialState(t, s.id, s.userId, s.student);
  db.sessions.set(key, fresh);
  db.turns.delete(key);
  // The saved chat was deleted, so don't rehydrate it from Supabase on the next turn.
  db.hydrated.add(key);
  return fresh;
}

const tpl = (s: ServerSession): Template => templateOf(s.id)!;
export const getProblem = (s: ServerSession): Problem => tpl(s).problem;
export const getPolicy = (s: ServerSession): ServerPolicy => tpl(s).policy;
/** Server-only. Never put this in a response, except through the gated reveal route. */
export const getSolution = (s: ServerSession): Solution => tpl(s).solution;
export const getMisconceptions = (s: ServerSession): ServerMisconception[] => tpl(s).misconceptions;
export const getOpening = (s: ServerSession): string => tpl(s).opening;
export const getHints = (s: ServerSession): string[] => tpl(s).hints;
export const getSteps = (s: ServerSession): string[] => tpl(s).steps;
export const getNextSessionId = (s: ServerSession): string | null => tpl(s).next ?? null;

export function getRecentTurns(s: ServerSession, n = 6): StoredTurn[] {
  return (db.turns.get(keyOf(s)) ?? []).slice(-n);
}

/**
 * After a cold start the in-memory turns are empty even though the student's chat was
 * saved (lib/chatHistory.ts). Reload it once so the tutor keeps the conversation's context.
 */
export async function loadSavedTurns(s: ServerSession, fromClient: Omit<StoredTurn, "at">[] = []): Promise<void> {
  const key = keyOf(s);
  if (db.hydrated.has(key)) return;
  db.hydrated.add(key);
  if (db.turns.get(key)?.length) return;
  // Until the chat_histories table exists the chat lives only in the browser, so fall back to the page's copy.
  const seedFromClient = () => {
    if (!db.turns.get(key)?.length && fromClient.length) db.turns.set(key, fromClient.map((t) => ({ ...t, at: Date.now() })));
  };
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("chat_histories")
      .select("messages, updated_at")
      .eq("user_id", s.userId)
      .eq("session_id", s.id)
      .maybeSingle();
    const saved = Array.isArray(data?.messages) ? (data.messages as { role?: string; text?: unknown; via?: unknown }[]) : [];
    const at = data?.updated_at ? Date.parse(data.updated_at) : Date.now();
    const turns: StoredTurn[] = saved.flatMap((m) =>
      (m.role === "student" || m.role === "tutor") && typeof m.text === "string"
        ? [{ role: m.role, text: m.text, via: m.via === "voice" || m.via === "text" ? m.via : undefined, at }]
        : [],
    );
    if (turns.length) db.turns.set(key, [...turns, ...(db.turns.get(key) ?? [])]);
  } catch (e) {
    console.error("[loadSavedTurns]", e); // no saved context; the session still works
  }
  seedFromClient();
}

export function saveTurn(s: ServerSession, turn: Omit<StoredTurn, "at">): void {
  const key = keyOf(s);
  const list = db.turns.get(key) ?? [];
  list.push({ ...turn, at: Date.now() });
  db.turns.set(key, list);
}

/** Counts a hint. When the last one is used, remembers which step the student was stuck on. */
export function incrementHints(s: ServerSession): number {
  s.hintsUsed += 1;
  if (s.hintsUsed >= getPolicy(s).hintLimit && s.stepWhenHintsRanOut === null) {
    s.stepWhenHintsRanOut = s.currentStep;
  }
  return s.hintsUsed;
}

export function setCurrentStep(s: ServerSession, step: number): void {
  const last = getSteps(s).length - 1;
  s.currentStep = Math.min(last, Math.max(0, Math.round(step)));
}

/** Marks steps done and moves the current step off any completed one, to the first step still open. */
export function completeSteps(s: ServerSession, steps: number[]): number[] {
  const count = getSteps(s).length;
  const done = new Set(s.completedSteps);
  const added = steps.filter((i) => Number.isInteger(i) && i >= 0 && i < count && !done.has(i));
  for (const i of added) done.add(i);
  s.completedSteps = [...done].sort((a, b) => a - b);
  if (done.has(s.currentStep)) {
    const open = Array.from({ length: count }, (_, i) => i).find((i) => !done.has(i));
    s.currentStep = open ?? count - 1;
  }
  return added;
}

export function canReveal(s: ServerSession): boolean {
  return s.hintsUsed >= getPolicy(s).hintLimit && getPolicy(s).revealAfterHints && !s.revealed && !s.completed;
}

export function markRevealed(s: ServerSession): void {
  s.revealed = true;
  s.creditEligible = false;
}

export function saveMisconceptionEvent(s: ServerSession, misconception: string): ServerMisconceptionEvent {
  const e: ServerMisconceptionEvent = {
    id: crypto.randomUUID(),
    misconception,
    problem: s.problemIndex,
    student: s.student,
    at: Date.now(),
  };
  db.misconceptionEvents.push(e);
  return e;
}

export function saveGuardEvent(s: ServerSession, e: Omit<GuardEvent, "at">): void {
  db.guardEvents.push({ ...e, at: Date.now(), sessionKey: keyOf(s) });
}

export function saveRevealEvent(s: ServerSession, stepIndex: number): RevealEvent {
  const e: RevealEvent = {
    id: crypto.randomUUID(),
    student: s.student,
    problem: s.problemIndex,
    stepIndex,
    stepLabel: getSteps(s)[stepIndex] ?? "",
    at: Date.now(),
  };
  db.revealEvents.push(e);
  return e;
}

// ---- Human help: raise hand and peer match (HUM-1, HUM-2) ----

export function setPeerOptIn(s: ServerSession, on: boolean): void {
  if (on) db.peerOptIn.add(s.userId);
  else db.peerOptIn.delete(s.userId);
}
export const isPeerOptedIn = (userId: string): boolean => db.peerOptIn.has(userId);

export function saveResolvedEvent(s: ServerSession, misconception: string): void {
  if (db.resolvedEvents.some((e) => e.userId === s.userId && e.misconception === misconception)) return;
  db.resolvedEvents.push({ userId: s.userId, student: s.student, misconception, problem: s.problemIndex, at: Date.now() });
}

/** Misconceptions this student is stuck on right now: seen and not resolved since. */
export function openMisconceptionsOf(s: ServerSession): string[] {
  const seen = new Set(db.misconceptionEvents.filter((e) => e.student === s.student && e.problem === s.problemIndex).map((e) => e.misconception));
  for (const r of db.resolvedEvents) if (r.userId === s.userId) seen.delete(r.misconception);
  return [...seen];
}

export function raiseHand(s: ServerSession, note: string): Escalation {
  const existing = db.escalations.find((e) => e.status === "open" && e.userId === s.userId && e.sessionId === s.id);
  const steps = getSteps(s);
  const base = {
    sessionId: s.id,
    userId: s.userId,
    student: s.student,
    problem: s.problemIndex,
    problemText: getProblem(s).prompt,
    note: note.slice(0, 400),
    stepLabel: steps[s.currentStep] ?? "",
    completedSteps: s.completedSteps.length,
    totalSteps: steps.length,
    hintsUsed: s.hintsUsed,
    hintLimit: getPolicy(s).hintLimit,
    openMisconceptions: openMisconceptionsOf(s),
    lastTurns: getRecentTurns(s, 6).map((t) => ({ role: t.role, text: t.text.slice(0, 500) })),
  };
  if (existing) return Object.assign(existing, base, { at: Date.now() });
  const e: Escalation = { id: crypto.randomUUID(), ...base, at: Date.now(), status: "open" };
  db.escalations.push(e);
  return e;
}

export function resolveEscalation(id: string, teacherNote: string): boolean {
  const e = db.escalations.find((x) => x.id === id);
  if (!e) return false;
  e.status = "resolved";
  e.teacherNote = teacherNote.slice(0, 400);
  return true;
}

/** Opted-in students who worked through this misconception, newest first. First names only. */
export function peersFor(misconception: string, exceptUserId: string): { name: string; at: number }[] {
  return db.resolvedEvents
    .filter((r) => r.misconception === misconception && r.userId !== exceptUserId && db.peerOptIn.has(r.userId))
    .sort((a, b) => b.at - a.at)
    .map((r) => ({ name: r.student.split(" ")[0], at: r.at }));
}

export function listEscalations(): (Escalation & { peers: Record<string, { name: string; at: number }[]> })[] {
  return [...db.escalations]
    .sort((a, b) => (a.status === b.status ? b.at - a.at : a.status === "open" ? -1 : 1))
    .map((e) => ({ ...e, peers: Object.fromEntries(e.openMisconceptions.map((m) => [m, peersFor(m, e.userId)])) }));
}

export function listGuardEvents(): { student: string; problem: number; kind: GuardEvent["kind"]; excerpt: string; at: number }[] {
  return db.guardEvents
    .map((g) => {
      const [sid, uid] = g.sessionKey.split(":");
      const s = db.sessions.get(`${sid}:${uid}`);
      return { student: s?.student ?? "Student", problem: s?.problemIndex ?? 0, kind: g.kind, excerpt: g.excerpt, at: g.at };
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 100);
}
