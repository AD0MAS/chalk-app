// Reusable class strings for DESIGN.md §2, §7 (buttons, inputs, cards). Use with cn().

const focus = "outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40";

export const btn = {
  primary: `inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-pill bg-primary px-[18px] text-[15px] font-medium text-primary-foreground shadow-button transition-all duration-200 hover:opacity-90 disabled:opacity-50 ${focus}`,
  secondary: `inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-pill bg-card px-[18px] text-[15px] font-medium text-foreground shadow-[inset_0_0_0_1px_var(--input)] transition-all duration-200 hover:bg-background disabled:opacity-50 ${focus}`,
  ghost: `inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-pill px-3.5 text-[15px] font-medium text-foreground transition-colors duration-200 hover:bg-muted disabled:opacity-50 ${focus}`,
  danger: `inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-pill px-3.5 text-[15px] font-medium text-coral-ink transition-colors duration-200 hover:bg-coral-tint disabled:opacity-50 ${focus}`,
  dangerSolid: `inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-pill bg-coral-ink px-[18px] text-[15px] font-medium text-white transition-all duration-200 hover:opacity-90 disabled:opacity-40 ${focus}`,
  icon: `inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-card text-foreground shadow-[inset_0_0_0_1px_var(--input)] transition-colors duration-200 hover:bg-background ${focus}`,
  small: `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-pill bg-card px-3.5 text-sm font-medium text-foreground shadow-[inset_0_0_0_1px_var(--input)] transition-colors duration-200 hover:bg-background disabled:opacity-50 ${focus}`,
};

export const field =
  "h-12 w-full min-w-0 rounded-input border-0 bg-background px-3.5 text-base text-foreground shadow-[inset_0_0_0_1px_var(--input)] outline-none transition-shadow duration-150 placeholder:text-muted-foreground/70 focus:shadow-[inset_0_0_0_1px_rgba(3,3,2,.3),0_0_0_3px_rgba(3,3,2,.08)] aria-invalid:shadow-[inset_0_0_0_2px_var(--coral)]";

export const textarea = `${field} h-auto min-h-24 resize-y py-3 leading-[22.4px]`;

export const label = "text-sm font-medium";

export const card = "rounded-card border bg-card shadow-card";

export const segment = "flex rounded-pill bg-muted p-1";
export const segmentItem =
  "flex h-10 flex-1 items-center justify-center rounded-pill px-4 text-[15px] font-medium text-muted-foreground transition-all duration-200 has-[:checked]:bg-card has-[:checked]:text-foreground has-[:checked]:shadow-button has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-foreground/40";
