import { cn } from "@/lib/utils";

/** Centred serif page title + optional muted subtitle (DESIGN.md §3–4). */
export function PageHeader({
  title,
  subtitle,
  className,
  clampTitle,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  /** Titles with a long name: max 2 lines, then "…" (line-height 1.2 so descenders and diacritics aren't clipped, DESIGN.md §9). */
  clampTitle?: boolean;
}) {
  return (
    <header className={cn("flex flex-col items-center gap-2.5 pt-6 pb-8 text-center", className)}>
      <h1 className={cn("font-serif text-[32px] leading-[1.05] font-normal tracking-[-0.03em] md:text-[44px]", clampTitle && "clamp-2 max-w-full leading-[1.2]")}>
        {title}
      </h1>
      {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
    </header>
  );
}
