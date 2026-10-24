import type { Metadata } from "next";
import { StoreProvider } from "@/lib/store";
// Self-hosted fonts: no network needed at build time (handy on hackathon wifi).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ducky: talk it through",
  description: "Turn problem sets into a conversation. Ducky asks why behind each step and finds where your reasoning broke.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-[15px] leading-normal">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
