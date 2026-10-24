import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";

export function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Įkeliama">
      {[220, 260, 200].map((h) => (
        <div key={h} className={cn(card, "flex flex-col gap-4 p-6")} style={{ height: h }}>
          <div className="h-6 w-48 animate-pulse rounded-pill bg-muted" />
          <div className="h-12 animate-pulse rounded-input bg-muted" />
          <div className="h-12 animate-pulse rounded-input bg-muted" />
        </div>
      ))}
    </div>
  );
}
