import { cn } from "@/lib/utils";
import { STATUS_PILL, statusLabel, toneDot, type StudentStatus, type StudentTone } from "@/lib/students/constants";

export function StatusPill({ status, className }: { status: StudentStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-pill px-2.5 text-[13px] font-medium whitespace-nowrap",
        STATUS_PILL[status],
        className
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

/** The student's tone – only ever a small dot (DESIGN.md §5). */
export function StudentDot({ tone, className }: { tone: StudentTone; className?: string }) {
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", toneDot(tone), className)} />;
}
