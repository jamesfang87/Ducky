"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/icons";
import { ThemePicker } from "@/components/ui/ThemePicker";

/**
 * Shared top bar. On the landing page ("hero") it starts dark over the hero and turns light once
 * you scroll past it. Everywhere else ("plain") it stays light.
 */
export function SiteHeader({ tone = "plain" }: { tone?: "hero" | "plain" }) {
  const [dark, setDark] = useState(tone === "hero");
  useEffect(() => {
    if (tone !== "hero") return;
    const onScroll = () => setDark(window.scrollY < window.innerHeight * 0.75);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tone]);
  const link = dark ? "text-white/75 hover:text-white" : "text-sub hover:text-ink";
  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-500 ${
        dark ? "border-white/10 bg-gradient-to-r from-[#0d0a04] via-[#2b2108] to-[#0d0a04]" : "border-line bg-ground"
      }`}
    >
      <nav className="mx-auto flex h-12 max-w-[1080px] items-center gap-6 px-6 text-[14px]">
        <div className={`origin-left scale-[0.8] ${dark ? "[&_*]:!text-white" : ""}`}>
          <Logo />
        </div>
        <div className="flex-1" />
        <Link href="/#how" className={`hidden no-underline sm:inline ${link}`}>How it works</Link>
        <Link href="/#research" className={`hidden no-underline sm:inline ${link}`}>Research</Link>
        <Link href="/privacy" className={`no-underline ${link}`}>Privacy</Link>
        <ThemePicker />
        <Link
          href="/login"
          className={`rounded-full px-3.5 py-1 text-[13px] font-medium no-underline transition-colors ${dark ? "bg-white text-night hover:bg-white/85" : "bg-ink text-ground hover:bg-sub"}`}
        >
          Log in
        </Link>
      </nav>
    </header>
  );
}
