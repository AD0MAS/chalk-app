import Link from "next/link";

/** Our own "Chalk" wordmark (DESIGN.md §1.1) – Source Serif 4 with a tiny chalk-stroke mark. */
export function Wordmark({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label="Chalk – Šiandien"
      className="flex shrink-0 items-center gap-[7px] rounded-pill text-foreground outline-offset-4 focus-visible:outline-2 focus-visible:outline-foreground/40"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <path d="M3.5 15.5c4.5-1.6 9.5-5.6 17-9" />
        <path d="M6 20c3.2-.9 6.4-2.6 9.5-4.6" opacity=".4" />
      </svg>
      <span className="font-serif text-[22px] leading-none font-medium tracking-[-0.02em]">Chalk</span>
    </Link>
  );
}
