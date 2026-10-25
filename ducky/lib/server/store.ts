import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_POLICY, HINTS, INITIAL_STEPS, MISCONCEPTIONS, PROBLEM } from "@/lib/mock";
import type { Policy, Problem } from "@/lib/types";

/**
 * Temporary in-memory data store for the tutoring loop. Every route goes through
 * these functions, so swapping in Supabase later only changes this file.
 *
 * Each signed-in user gets their own copy of a session template ("demo",
 * "demo-cs"), keyed by (sessionId, userId), so nobody can read or advance
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

/** Teacher policy plus server-only settings that aren't in the shared UI type yet. */
export type ServerPolicy = Policy & {
  /** Once every hint is used, the student may view the answer for no credit. */
  revealAfterHints: boolean;
};

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
  kind: "answer_leak" | "hint_limit" | "visual_declined" | "visual_failed";
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

interface Template {
  problem: Problem;
  policy: ServerPolicy;
  solution: Solution;
  misconceptions: ServerMisconception[];
  hints: string[];
  steps: string[];
  startStep: number;
  /** Ducky's first line, shown before the student says anything. */
  opening: string;
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
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
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
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
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
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
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
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
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
  "demo-cs": {
    problem: {
      index: 1,
      total: 3,
      course: "CS 314",
      set: "Problem Set 1 · Insertion sort",
      prompt:
        "Trace insertion sort on the array [5, 2, 4, 6, 1, 3], showing the array after each pass of the outer loop. Then explain why insertion sort takes O(n²) comparisons in the worst case, and what input causes that worst case.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Passes: [2,5,4,6,1,3] → [2,4,5,6,1,3] → [2,4,5,6,1,3] → [1,2,4,5,6,3] → [1,2,3,4,5,6]. " +
        "Each new element is compared with every element in the sorted prefix in the worst case, so the total is 1 + 2 + … + (n−1) = n(n−1)/2 = O(n²). " +
        "The worst case is a reverse-sorted array.",
      finalAnswerPatterns: [
        /\[\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*,\s*6\s*\]/,
        /\[\s*1\s*,\s*2\s*,\s*4\s*,\s*5\s*,\s*6\s*,\s*3\s*\]/,
        /n\s*\(\s*n\s*[-−]\s*1\s*\)\s*\/\s*2/i,
      ],
    },
    misconceptions: [
      { id: "cs-swap-vs-shift", label: "Thinks insertion sort swaps distant elements instead of shifting the prefix" },
      { id: "cs-prefix-unsorted", label: "Doesn't see that the left part is always sorted" },
      { id: "cs-best-case-n2", label: "Thinks it's O(n²) even on already-sorted input" },
      { id: "cs-worst-case-input", label: "Wrong worst-case input (e.g. random instead of reverse-sorted)" },
      { id: "cs-counts-passes-not-comparisons", label: "Counts outer passes (n) instead of total comparisons" },
    ],
    hints: [
      "Look only at the first two elements. After the first pass, what must be true about the part of the array to the left of the element you're inserting?",
      "For the element at index i, how many elements might it have to move past in the worst case? Now add that up for every i.",
    ],
    steps: [
      "Understand the invariant: the left part is sorted",
      "Trace each pass on [5, 2, 4, 6, 1, 3]",
      "Count comparisons in the worst case",
      "Name the worst-case input and the Big-O",
    ],
    startStep: 0,
    opening: "Before we trace anything: when insertion sort looks at a new element, what's true about everything to its left?",
  },
  "demo-cs-p2": {
    problem: {
      index: 2,
      total: 3,
      course: "CS 314",
      set: "Problem Set 1 · Insertion sort",
      prompt:
        "Trace insertion sort on [3, 1, 4, 2]. Show the array after each pass of the outer loop, and count the comparisons.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Pass 1 inserts 1: [1, 3, 4, 2], 1 comparison. " +
        "Pass 2 inserts 4: [1, 3, 4, 2], 1 comparison. " +
        "Pass 3 inserts 2: [1, 2, 3, 4], 3 comparisons (2 vs 4, 2 vs 3, 2 vs 1). " +
        "Total: 5 comparisons.",
      finalAnswerPatterns: [/\[\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*\]/i, /5\s*comparisons?/i],
    },
    misconceptions: [
      { id: "is2-counts-swaps", label: "Counts swaps instead of comparisons" },
      { id: "is2-misses-last-compare", label: "Stops the count before the failed comparison" },
      { id: "is2-wrong-prefix", label: "Shows an unsorted prefix after a pass" },
      { id: "is2-extra-pass", label: "Runs a fourth pass after the array is sorted" },
    ],
    hints: [
      "After each pass, everything to the left of the current element is sorted. What is the sorted prefix on pass 2?",
      "For 2, how many elements does it compare against before it stops?",
    ],
    steps: [
      "Start with [3] as the sorted prefix",
      "Insert 1 and show the array",
      "Insert 4 and show the array",
      "Insert 2 and count every comparison",
    ],
    startStep: 0,
    opening: "On the first pass, what exactly happens to the second element?",
  },
  "demo-cs-p3": {
    problem: {
      index: 3,
      total: 3,
      course: "CS 314",
      set: "Problem Set 1 · Insertion sort",
      prompt:
        "Explain why insertion sort runs in O(n) time on an already-sorted array but O(n²) on a reverse-sorted array. Include the comparison counts for an array of length n.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Sorted: each new element compares once with its left neighbor and moves nowhere, so there are n−1 comparisons = O(n). " +
        "Reverse-sorted: the element at position i moves past all i elements before it, so the total is 1 + 2 + … + (n−1) = n(n−1)/2 = O(n²).",
      finalAnswerPatterns: [
        /n\s*(?:-|−)\s*1\s*comparisons?/i,
        /n\s*\(\s*n\s*(?:-|−)\s*1\s*\)\s*\/\s*2/i,
        /O\s*\(\s*n\s*(?:\^?2|²)\s*\)/i,
      ],
    },
    misconceptions: [
      { id: "is3-confuses-best-worst", label: "Swaps the best and worst cases" },
      { id: "is3-forgets-shifts", label: "Counts comparisons but not shifts in the reverse case" },
      { id: "is3-series-error", label: "Sums 1 + 2 + … + n incorrectly" },
      { id: "is3-bigo-from-n", label: "Says both cases are O(n) because there are n elements" },
    ],
    hints: [
      "In the sorted case, how many comparisons does the inner loop make before it stops?",
      "In the reverse case, how far does the element at index i have to move?",
    ],
    steps: [
      "Count comparisons for one element in the sorted case",
      "Sum them for n elements",
      "Count comparisons for one element in the reverse case",
      "Sum the series and state the Big-O",
    ],
    startStep: 0,
    opening: "Start with the best case: what does the inner loop do when the array is already sorted?",
  },
  "demo-cs-2": {
    problem: {
      index: 1,
      total: 4,
      course: "CS 314",
      set: "Problem Set 2 · Hash maps",
      prompt:
        "A hash table has 8 buckets and uses h(k) = k mod 8 with separate chaining. Insert 12, 20, 5, 29, and 17 in that order, and show the table. Then explain why a lookup is O(1) on average but O(n) in the worst case.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Buckets: 1 → [17]; 4 → [12, 20]; 5 → [5, 29]; every other bucket is empty. " +
        "12 mod 8 = 4 and 20 mod 8 = 4 collide, and so do 5 and 29 (both 5). " +
        "With a good hash and a bounded load factor each chain stays short, so a lookup is O(1) on average. " +
        "In the worst case every key hashes to one bucket, so the chain holds all n keys and a lookup walks O(n) nodes.",
      finalAnswerPatterns: [
        /bucket\s*4[^.]*12[^.]*20/i,
        /12[^.]*20[^.]*bucket\s*4/i,
        /worst[^.]*O\s*\(\s*n\s*\)/i,
      ],
    },
    misconceptions: [
      { id: "hm-drops-collision", label: "Drops one of the keys that collide in a bucket" },
      { id: "hm-mod-error", label: "Computes a bucket with the wrong modulus" },
      { id: "hm-worst-case-constant", label: "Says the worst case is also O(1) because the hash is O(1)" },
      { id: "hm-no-collisions", label: "Claims there are no collisions" },
      { id: "hm-load-factor-bigo", label: "Thinks the load factor changes the big-O of a single lookup" },
    ],
    hints: [
      "Take each key mod 8. Which two keys land in the same bucket?",
      "If every key landed in one bucket, how many nodes would you walk to find the last one?",
    ],
    steps: [
      "Compute h(k) = k mod 8 for each key",
      "Place each key in its bucket with separate chaining",
      "Explain why the average lookup is O(1)",
      "Describe the worst case and its complexity",
    ],
    startStep: 0,
    opening: "Start with the hash function: which bucket does 12 land in, and why?",
  },
  "demo-cs-2-p2": {
    problem: {
      index: 2,
      total: 4,
      course: "CS 314",
      set: "Problem Set 2 · Hash maps",
      prompt:
        "An 8-bucket table uses h(k) = k mod 8 with separate chaining. Insert 9, 17, 25, 33, and 1 in that order, show the table, and say how many comparisons it takes to find 33.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "All five keys have remainder 1 when divided by 8, so they all land in bucket 1. " +
        "The chain in insertion order is [9, 17, 25, 33, 1]. " +
        "Finding 33 compares 9, 17, 25, then 33: 4 comparisons.",
      finalAnswerPatterns: [
        /bucket\s*1/i,
        /\[\s*9\s*,\s*17\s*,\s*25\s*,\s*33\s*,\s*1\s*\]/i,
        /4\s*comparisons?/i,
      ],
    },
    misconceptions: [
      { id: "hm2-splits-buckets", label: "Spreads the keys across different buckets" },
      { id: "hm2-counts-one", label: "Counts 1 comparison because it looks up the bucket directly" },
      { id: "hm2-drops-key", label: "Drops a key from the chain" },
      { id: "hm2-wrong-order", label: "Sorts the chain instead of keeping insertion order" },
    ],
    hints: [
      "Compute each key mod 8. What do all five remainders have in common?",
      "The chain keeps insertion order. How many nodes come before 33?",
    ],
    steps: [
      "Hash each key mod 8",
      "Build the chain in insertion order",
      "Count comparisons up to 33",
      "Explain why this is the worst case",
    ],
    startStep: 0,
    opening: "Hash the first two keys. Where do they land?",
  },
  "demo-cs-2-p3": {
    problem: {
      index: 3,
      total: 4,
      course: "CS 314",
      set: "Problem Set 2 · Hash maps",
      prompt:
        "A table has 10 buckets and h(k) = k mod 10. Insert 15, 25, 35, and 5. Show the table, then compute the load factor and explain what it predicts about lookup cost.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Every key ends in 5, so all four hash to bucket 5: [15, 25, 35, 5]. " +
        "The load factor is α = n/m = 4/10 = 0.4. " +
        "With separate chaining the expected chain length is α, so lookups are O(1 + α), " +
        "but this particular hash clusters all four keys, so a lookup takes up to 4 comparisons.",
      finalAnswerPatterns: [/0\.4/i, /bucket\s*5/i, /\[\s*15\s*,\s*25\s*,\s*35\s*,\s*5\s*\]/i],
    },
    misconceptions: [
      { id: "hm3-load-factor-count", label: "Says the load factor is 4 instead of 4/10" },
      { id: "hm3-assumes-even", label: "Assumes the load factor guarantees an even spread" },
      { id: "hm3-wrong-bucket", label: "Uses a different bucket for the keys" },
      { id: "hm3-ignores-clustering", label: "Claims the lookup is 1 comparison because α < 1" },
    ],
    hints: [
      "All four keys end in 5. What does mod 10 do to them?",
      "Load factor is the number of keys divided by the number of buckets.",
    ],
    steps: [
      "Hash each key mod 10",
      "Show the chain in bucket 5",
      "Compute the load factor n/m",
      "Compare the expected chain length with this actual chain",
    ],
    startStep: 0,
    opening: "Hash 15 and 25 mod 10. What do they have in common?",
  },
  "demo-cs-2-p4": {
    problem: {
      index: 4,
      total: 4,
      course: "CS 314",
      set: "Problem Set 2 · Hash maps",
      prompt:
        "Explain why separate chaining gives O(1) average lookup but O(n) worst-case lookup. Describe a set of keys and a hash function that produces the worst case.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "The average case assumes uniform hashing and a bounded load factor α = n/m, so the expected chain length is α and a lookup is O(1 + α) = O(1). " +
        "In the worst case all n keys collide in one bucket. For example, h(k) = 0 for every key, or keys that all share the same remainder mod m. " +
        "The chain then holds n nodes and a lookup is O(n).",
      finalAnswerPatterns: [/h\s*\(\s*k\s*\)\s*=\s*0/i, /O\s*\(\s*n\s*\)/i, /all\s+n\s+keys/i],
    },
    misconceptions: [
      { id: "hm4-worst-constant", label: "Says the worst case is also O(1)" },
      { id: "hm4-average-always", label: "Thinks uniform hashing is guaranteed rather than assumed" },
      { id: "hm4-resizing-fixes-adversary", label: "Believes resizing alone prevents adversarial collisions" },
      { id: "hm4-low-load-fixes-worst", label: "Says a low load factor makes the worst case O(1)" },
    ],
    hints: [
      "What assumption about the hash function keeps chains short?",
      "Can you choose a hash function where every key gets the same bucket?",
    ],
    steps: [
      "State the assumption behind the average case",
      "Relate expected chain length to the load factor",
      "Construct an all-collide example",
      "State the worst-case complexity",
    ],
    startStep: 0,
    opening: "What has to be true about the hash function for the average case to hold?",
  },
};

interface Db {
  sessions: Map<string, ServerSession>;
  turns: Map<string, StoredTurn[]>;
  misconceptionEvents: ServerMisconceptionEvent[];
  guardEvents: (GuardEvent & { sessionKey: string })[];
  revealEvents: RevealEvent[];
  /** Session keys whose saved chat has already been read from Supabase this process. */
  hydrated: Set<string>;
}

// Kept on globalThis so `next dev` hot reloads don't wipe the demo state.
const g = globalThis as typeof globalThis & { __duckyDb?: Db };
const db: Db = (g.__duckyDb ??= {
  sessions: new Map(),
  turns: new Map(),
  misconceptionEvents: [],
  guardEvents: [],
  revealEvents: [],
  hydrated: new Set(),
});
db.hydrated ??= new Set();

const keyOf = (s: Pick<ServerSession, "id" | "userId">) => `${s.id}:${s.userId}`;

/** Returns the caller's own copy of the session, creating it on first use. Null if no such session. */
export function getSession(sessionId: string, user: { userId: string; name: string }): ServerSession | null {
  const t = TEMPLATES[sessionId];
  if (!t) return null;
  const key = `${sessionId}:${user.userId}`;
  let s = db.sessions.get(key);
  if (!s) {
    s = {
      id: sessionId,
      userId: user.userId,
      student: user.name,
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
    db.sessions.set(key, s);
  }
  return s;
}

export const getProblem = (s: ServerSession): Problem => TEMPLATES[s.id].problem;
export const getPolicy = (s: ServerSession): ServerPolicy => TEMPLATES[s.id].policy;
/** Server-only. Never put this in a response, except through the gated reveal route. */
export const getSolution = (s: ServerSession): Solution => TEMPLATES[s.id].solution;
export const getMisconceptions = (s: ServerSession): ServerMisconception[] => TEMPLATES[s.id].misconceptions;
export const getOpening = (s: ServerSession): string => TEMPLATES[s.id].opening;
export const getHints = (s: ServerSession): string[] => TEMPLATES[s.id].hints;
export const getSteps = (s: ServerSession): string[] => TEMPLATES[s.id].steps;

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
