"use client";

import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { signIn, type LoginState } from "@/lib/auth-actions";
import { btn, field, label } from "@/lib/ui";
import { cn } from "@/lib/utils";

const errorMessages: Record<string, string> = {
  neleidziama: "Šiuo el. pašto adresu prisijungti negalima.",
};

export function LoginFormWithParams() {
  const params = useSearchParams();
  const error = params.get("klaida");
  return <LoginForm next={params.get("next") ?? "/"} error={error ? (errorMessages[error] ?? null) : null} />;
}

export function LoginForm({ next, error }: { next: string; error: string | null }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(signIn, { status: "idle" });
  const message = state.status === "error" ? state.message : error;
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  function togglePassword() {
    const input = passwordRef.current;
    // changing the type resets the cursor in some browsers – put it back where it was
    const start = input?.selectionStart ?? null;
    const end = input?.selectionEnd ?? null;
    setShowPassword((v) => !v);
    if (input && document.activeElement === input && start !== null) {
      requestAnimationFrame(() => input.setSelectionRange(start, end));
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={label}>
          El. paštas
        </label>
        <input id="email" name="email" type="email" required autoComplete="username" autoFocus className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={label}>
          Slaptažodis
        </label>
        <div className="relative">
          <input
            ref={passwordRef}
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? "login-error" : undefined}
            className={cn(field, "pr-14")}
          />
          <button
            type="button"
            aria-label={showPassword ? "Slėpti slaptažodį" : "Rodyti slaptažodį"}
            aria-pressed={showPassword}
            aria-controls="password"
            // keep focus (and the cursor) in the field
            onMouseDown={(e) => e.preventDefault()}
            onClick={togglePassword}
            className="absolute inset-y-0 right-0.5 my-auto flex size-11 items-center justify-center rounded-pill text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground/40"
          >
            {showPassword ? <EyeOff aria-hidden="true" className="size-5" strokeWidth={1.75} /> : <Eye aria-hidden="true" className="size-5" strokeWidth={1.75} />}
          </button>
        </div>
      </div>
      {message ? (
        <p id="login-error" role="alert" className="text-sm leading-5 text-coral-ink">
          {message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={cn(btn.primary, "h-12")}>
        {pending ? "Jungiamasi…" : "Prisijungti"}
      </button>
    </form>
  );
}
