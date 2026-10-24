/**
 * Mock tutor + pipeline. These are the integration seams for the backend:
 *  - getTutorReply()  → POST /api/turn  (Muse Spark / Claude with the policy as system prompt)
 *  - runVizPipeline() → POST /api/viz   (generate → render → checks → vision review loop)
 * The scripted logic below is deterministic so the demo never goes off the rails.
 */
import type { MisconceptionId, PipelineEvent, Policy } from "./types";

export interface TutorReply {
  text: string;
  flag?: { kind: "misconception" | "guardrail" | "correct"; label: string };
  misconception?: MisconceptionId;
  triggerViz?: boolean;
  advanceStep?: "broke" | "corrected" | "solved";
}

const JAILBREAK = [
  /ignore (all|your|previous|the) (instructions|rules)/i,
  /pretend (you are|to be)/i,
  /developer mode|jailbreak|system prompt/i,
  /(just|please)?\s*(give|tell) me the (final )?answer/i,
  /what('?s| is) the answer/i,
];

const OFF_TOPIC = /\b(essay|homework for|write my|poem|minecraft|fortnite)\b/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getTutorReply(input: string, policy: Policy, turn: number): Promise<TutorReply> {
  await sleep(700 + Math.random() * 400);
  const t = input.trim();

  if (policy.guardrails.jailbreakShield && JAILBREAK.some((r) => r.test(t))) {
    if (policy.revealAnswers && /answer/i.test(t)) {
      return { text: "Your teacher allows answers on this one: both balls land at t = √(2h/g) ≈ 2.02 s. Before we move on, can you tell me why mass dropped out?" };
    }
    return {
      text: "I can’t give the answer on this assignment; your teacher set it up so you work it out. But you’re close. What does Newton’s second law say about the 10 kg ball?",
      flag: { kind: "guardrail", label: "Answer request declined (teacher policy)" },
    };
  }

  if (policy.guardrails.stayOnAssignment && OFF_TOPIC.test(t)) {
    return {
      text: "Let’s stay on Problem 2 for now. What do you expect to happen when both balls are dropped together?",
      flag: { kind: "guardrail", label: "Off-topic request redirected" },
    };
  }

  if (/heav(y|ier).*(fast|first|quick|sooner)|(fast|first).*heav/i.test(t) || /more mass.*(fast|first)/i.test(t)) {
    return {
      text: "You’re right that gravity pulls 10× harder on the heavy ball. What else is 10× bigger for that ball, and how might that affect how quickly it speeds up? I’ve put both balls side by side →",
      flag: { kind: "misconception", label: "Misconception flagged: mass → fall speed" },
      misconception: "mass-fall-speed",
      triggerViz: policy.tools.visualizations,
      advanceStep: "broke",
    };
  }

  if (/velocity.*(constant|9\.8)|speed is 9\.8/i.test(t)) {
    return {
      text: "Careful: 9.8 is in m/s², not m/s. Is that telling you how fast the ball is going, or how fast its speed is changing?",
      flag: { kind: "misconception", label: "Misconception flagged: velocity vs. acceleration" },
      misconception: "velocity-vs-acceleration",
    };
  }

  if (/sqrt|√|2\.0\d?\s*s|2 seconds|t\s*=\s*\(?2h/i.test(t)) {
    return {
      text: "Exactly: t = √(2h/g) ≈ 2.02 s for both. You worked it from a prediction, to F = ma, to the cancellation. That’s mastery. Ready for Problem 3?",
      flag: { kind: "correct", label: "Problem solved" },
      advanceStep: "solved",
    };
  }

  if (/cancel|same (acceleration|time|rate)|a\s*=\s*g|mg\s*\/\s*m|inertia|mass.*(both|cancel)/i.test(t)) {
    return {
      text: "That’s the key idea. Can you say it as an equation? What is a for each ball, and then how long does each take to fall 20 m?",
      flag: { kind: "correct", label: "Self-corrected" },
      advanceStep: "corrected",
    };
  }

  const prompts = [
    "Before we calculate anything: if you drop both balls at the same moment, what do you expect to happen?",
    "Say a bit more. Which forces act on each ball while it falls?",
    "What does F = ma tell you if you write it for each ball separately?",
  ];
  return { text: prompts[Math.min(turn, prompts.length - 1)] };
}

/** Streams the visualization review loop. Pass 1 deliberately fails so the fix is visible in the demo. */
export async function runVizPipeline(
  onEvent: (e: PipelineEvent) => void,
  onBuggyChange: (buggy: boolean) => void,
): Promise<void> {
  const step = async (e: PipelineEvent, ms: number) => {
    onEvent({ ...e, status: "running" });
    await sleep(ms);
    onEvent(e);
  };
  await step({ stage: "generate", status: "pass", text: "generate · primitive free_fall_compare(m₁=1, m₂=10, h=20)" }, 700);
  onBuggyChange(true);
  await step({ stage: "render", status: "pass", text: "render · SVG in sandbox · 41 ms" }, 450);
  await step({ stage: "checks", status: "pass", text: "checks · no errors, text fits bounds" }, 400);
  await step({ stage: "vision", pass: 1, status: "fail", text: "vision pass 1 · labels “m = 10 kg” and “t = 1.5 s” overlap; fixing…" }, 1300);
  await step({ stage: "regenerate", status: "pass", text: "regenerate · moved mass labels below trajectories" }, 800);
  onBuggyChange(false);
  await step({ stage: "vision", pass: 2, status: "pass", text: "vision pass 2 · labels clear, heights match y = ½gt²" }, 1100);
}
