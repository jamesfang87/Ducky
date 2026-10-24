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
      <path d="M3.5 12.5C5.5 14.5 8 16.5 13.4 16.6A7 7 0 1125.3 15.8C27.8 16.9 29 19 28.6 21.6C28 26.5 22.5 29.2 16 29.2C9 29.2 4.2 26 3.4 20.5C3 17.8 2.8 15 3.5 12.5Z" fill="#F7C21B" />
      <path d="M9.8 19.6C11.4 23.6 16.4 25 20.4 22.6C18.9 19.4 15.1 18 11.9 18.6C11.1 18.8 10.4 19.1 9.8 19.6Z" fill="#E3A600" />
      <path d="M24.4 11.4C26.4 10.3 29 10.4 30.3 11.3C30.8 11.7 30.6 12.4 30 12.7C28.3 13.6 26 13.7 24.4 13.1Z" fill="#F08A24" />
      <circle cx="21.6" cy="9.5" r="1.45" fill="#14171C" />
      <circle cx="22.1" cy="9" r=".45" fill="#fff" />
    </svg>
  );
}
