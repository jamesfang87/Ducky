import Link from "next/link";

type P = { className?: string; size?: number };

export function Logo({ badge }: { badge?: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink no-underline">
      <DuckMark />
      <span className="font-display text-[22px] font-bold tracking-tight">ducky</span>
      {badge && <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold text-white">{badge}</span>}
    </Link>
  );
}

export const Check = ({ className, size = 12 }: P) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className}>
    <path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Warn = ({ className, size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className}>
    <path d="M7 1.5l6 10.5H1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M7 5.5v3M7 10.2v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const Shield = ({ className, size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className}>
    <path d="M7 1.5l5 2v3.5c0 3-2.2 5-5 5.5-2.8-.5-5-2.5-5-5.5V3.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export const Mic = ({ className, size = 26 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
    <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
    <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Stop = ({ className, size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </svg>
);

export const Pencil = ({ className, size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
    <path d="M2 14l1-4 8-8 3 3-8 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const Send = ({ className, size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
    <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Search = ({ className, size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" className={className}>
    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const User = ({ className, size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" className={className}>
    <circle cx="9" cy="6" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 16c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const Student = ({ className, size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" className={className}>
    <path d="M9 3.2L1.8 6.6 9 10l7.2-3.4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M4.6 8.5v3c0 1.4 2 2.5 4.4 2.5s4.4-1.1 4.4-2.5v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16.2 6.6v3.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const Teacher = ({ className, size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" className={className}>
    <rect x="2.5" y="2.5" width="13" height="8.6" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 11.1v3.6M6.6 15.9h4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5.6 8.7l2.4-2.4 1.7 1.7 2.7-2.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.9 5.3h1.5v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Spinner = ({ className, size = 12 }: P) => (
  <svg width={size} height={size} viewBox="0 0 12 12" className={`animate-spin ${className ?? ""}`} aria-hidden="true">
    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeDasharray="18 10" />
  </svg>
);

export function SrOnly({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/** Original rubber-duck mark (rubber-duck debugging: explain it out loud and find your own bug). */
export function DuckMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 18c0 6 5 10 12 10s12-3 12-8c0-3-2-4-4-4h-3c1-1 1.5-2.5 1.5-4A6.5 6.5 0 0010 12c0 1.6.6 3 1.5 4H8c-2 0-4 0-4 2z" fill="#F2B705" />
      <path d="M20.5 10.5l5-1.2c.9-.2 1.4.9.7 1.5l-3.2 2.6z" fill="#E07A1F" />
      <circle cx="17.5" cy="10" r="1.4" fill="#14171C" />
      <path d="M9 21c2.5 2 6 2.6 9.5 1.6" stroke="#C99100" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
