import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14171C",
        sub: "#3A414A",
        muted: "#5A626C",
        ground: "#F3F4F1",
        line: "#E2E4DF",
        edge: "#C9CCC6",
        accent: { DEFAULT: "#0B7A62", dark: "#075A48", tint: "#E6F3EF", glow: "#6FD3B6" },
        warn: { DEFAULT: "#A3530A", dark: "#6B3A08", tint: "#FBF1E6", soft: "#EDC08F" },
        heat: { 0: "#F7F6F2", 1: "#F6E4CF", 2: "#EDC08F", 3: "#D58A3E", 4: "#8F4F12" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        bar: { "0%,100%": { transform: "scaleY(0.3)" }, "50%": { transform: "scaleY(1)" } },
        fadein: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        aura: { "0%,100%": { transform: "scale(1)", opacity: "0.75" }, "50%": { transform: "scale(1.14)", opacity: "1" } },
        ring: { "0%": { transform: "scale(0.6)", opacity: "0.5" }, "100%": { transform: "scale(1.5)", opacity: "0" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-7px)" } },
        bloom: { "0%": { opacity: "0", transform: "translateY(-50%) scale(0.5)" }, "18%": { opacity: "0.9" }, "100%": { opacity: "0", transform: "translateY(-50%) scale(1.5)" } },
        sweep: { "0%": { transform: "translateX(-120%)" }, "100%": { transform: "translateX(420%)" } },
        "cloud-a": { "0%,100%": { transform: "translate(0,0) scale(1)" }, "25%": { transform: "translate(-18vw,14vh) scale(1.15)" }, "50%": { transform: "translate(-30vw,-4vh) scale(0.9)" }, "75%": { transform: "translate(-8vw,22vh) scale(1.1)" } },
        "cloud-b": { "0%,100%": { transform: "translate(0,0) scale(1)" }, "30%": { transform: "translate(22vw,-18vh) scale(1.2)" }, "60%": { transform: "translate(10vw,-30vh) scale(0.9)" } },
        "cloud-c": { "0%,100%": { transform: "translate(0,0)" }, "35%": { transform: "translate(-26vw,-16vh) scale(1.25)" }, "70%": { transform: "translate(-12vw,10vh) scale(0.85)" } },
        "cloud-d": { "0%,100%": { transform: "translate(0,0)" }, "40%": { transform: "translate(18vw,20vh) scale(1.2)" }, "80%": { transform: "translate(-14vw,8vh) scale(0.9)" } },
        bob: { "0%,100%": { transform: "translateY(0) rotate(-3deg)" }, "50%": { transform: "translateY(-6px) rotate(3deg)" } },
      },
      animation: { "spin-slow": "spin-slow 30s linear infinite", aura: "aura 7s ease-in-out infinite", ring: "ring 6.6s ease-out infinite", float: "float 6s ease-in-out infinite", bar: "bar 0.9s ease-in-out infinite", fadein: "fadein 0.25s ease-out", bob: "bob 1.6s ease-in-out infinite", bloom: "bloom 2.4s ease-out forwards", sweep: "sweep 1.8s cubic-bezier(0.22,1,0.36,1) 0.2s forwards", "cloud-a": "cloud-a 19s ease-in-out infinite", "cloud-b": "cloud-b 23s ease-in-out infinite", "cloud-c": "cloud-c 17s ease-in-out infinite", "cloud-d": "cloud-d 21s ease-in-out infinite" },
    },
  },
  plugins: [],
} satisfies Config;
