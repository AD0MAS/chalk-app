// Shown under the navbar while a page has nothing to show yet (first load, a navigation that wasn't prefetched).
// Same place and size as the iPhone launch screen (scripts/startup-images.mts), so launch → loading → page is calm.
// Fades in only after 150 ms (no flash on fast navigations); the chalk strokes draw themselves, still with reduced motion.
export default function Loading() {
  return (
    <div role="status" className="chalk-loading pointer-events-none fixed inset-0 flex items-center justify-center">
      <span className="flex items-center gap-[14px] text-foreground">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path className="chalk-stroke" pathLength={1} d="M3.5 15.5c4.5-1.6 9.5-5.6 17-9" />
          <path className="chalk-stroke chalk-stroke-2" pathLength={1} strokeOpacity={0.4} d="M6 20c3.2-.9 6.4-2.6 9.5-4.6" />
        </svg>
        <span aria-hidden="true" className="font-serif text-[44px] leading-none font-medium tracking-[-0.02em]">
          Chalk
        </span>
      </span>
      <span className="sr-only">Kraunama…</span>
    </div>
  );
}
