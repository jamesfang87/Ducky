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
        bob: { "0%,100%": { transform: "translateY(0) rotate(-3deg)" }, "50%": { transform: "translateY(-6px) rotate(3deg)" } },
      },
      animation: { bar: "bar 0.9s ease-in-out infinite", fadein: "fadein 0.25s ease-out", bob: "bob 1.6s ease-in-out infinite" },
    },
  },
  plugins: [],
} satisfies Config;
