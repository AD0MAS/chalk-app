import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

/** Empty placeholder for screens that are not built yet (Phase 1, step 1). */
export function PlaceholderPage({
  title,
  subtitle,
  description,
  phase = "1 fazėje",
  narrow = false,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description: string;
  phase?: string;
  narrow?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full animate-enter", narrow ? "max-w-[720px]" : "max-w-[1040px]")}>
      <PageHeader title={title} subtitle={subtitle} />
      <section className="flex flex-col items-center gap-3 rounded-card border bg-card px-6 py-12 text-center shadow-card">
        <span className="flex size-14 items-center justify-center rounded-pill border bg-background text-foreground/80">
          <Hammer aria-hidden="true" className="size-6" strokeWidth={1.75} />
        </span>
        <h2 className="font-serif text-[22px] leading-[1.15]">
          Šis ekranas dar <em>kuriamas</em>
        </h2>
        <p className="max-w-[420px] text-sm leading-5 text-muted-foreground">{description}</p>
        <span className="inline-flex h-6 items-center rounded-pill bg-muted px-2.5 text-[13px] font-medium text-muted-foreground">
          Bus {phase}
        </span>
      </section>
      {children}
    </div>
  );
}
