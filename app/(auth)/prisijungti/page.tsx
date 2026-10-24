import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm, LoginFormWithParams } from "./login-form";

export const metadata: Metadata = { title: "Prisijungti" };

export default function LoginPage() {
  return (
    <section className="glass-border w-full max-w-[420px] animate-enter rounded-sheet bg-card px-7 pt-8 pb-7 shadow-modal">
      <div className="flex flex-col items-center gap-2 pb-6 text-center">
        <span className="flex items-center gap-[7px]" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M3.5 15.5c4.5-1.6 9.5-5.6 17-9" />
            <path d="M6 20c3.2-.9 6.4-2.6 9.5-4.6" opacity=".4" />
          </svg>
          <span className="font-serif text-[22px] leading-none font-medium tracking-[-0.02em]">Chalk</span>
        </span>
        <h1 className="pt-4 font-serif text-[32px] leading-[1.05] font-normal tracking-[-0.03em]">
          Labas, <em>Adomai</em>
        </h1>
        <p className="text-muted-foreground">Prisijunk prie savo darbo vietos.</p>
      </div>
      {/* Search params (?next, ?klaida) are only known at request time */}
      <Suspense fallback={<LoginForm next="/" error={null} />}>
        <LoginFormWithParams />
      </Suspense>
    </section>
  );
}
