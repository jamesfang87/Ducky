import { DuckMark } from "@/components/ui/icons";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-screen flex-col items-center justify-center gap-5 animate-fadein">
      <div className="motion-safe:animate-bob">
        <DuckMark size={72} />
      </div>
      <span className="font-display text-[28px] font-bold tracking-tight text-ink">ducky</span>
      <div className="flex h-5 items-center gap-1" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-full w-1 origin-center rounded-full bg-accent motion-safe:animate-bar"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
