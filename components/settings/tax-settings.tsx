"use client";

import { Percent } from "lucide-react";
import { useState, useTransition } from "react";
import { Notice } from "@/components/notice";
import { saveTaxSettings } from "@/lib/tax/actions";
import { TAX_DEFAULTS, type TaxSettings } from "@/lib/tax/constants";
import { btn, card, field, label, segment, segmentItem } from "@/lib/ui";
import { cn } from "@/lib/utils";

// Nustatymai → Mokesčiai (SPEC §1 Taxes): every rate and threshold of the IV estimate, prefilled with 2026 values.
// Rates are typed as percentages ("12,52"), stored as fractions (0.1252).

type Field = { key: keyof TaxSettings; label: string; unit: "%" | "€" | ""; hint?: string };

const FIELDS: Field[] = [
  { key: "gpm_rate", label: "GPM tarifas", unit: "%" },
  { key: "credit_rate", label: "GPM kreditas", unit: "%", hint: "efektyviai 20 − 15 = 5 %" },
  { key: "credit_full_until", label: "Pilnas kreditas iki", unit: "€", hint: "apmokestinamų pajamų" },
  { key: "credit_zero_at", label: "Kreditas baigiasi ties", unit: "€", hint: "virš – bendri tarifai" },
  { key: "vsd_rate", label: "VSD", unit: "%" },
  { key: "psd_rate", label: "PSD", unit: "%" },
  { key: "base_share", label: "VSD / PSD bazė", unit: "%", hint: "nuo apmokestinamų pajamų" },
  { key: "rates_year", label: "Tarifų metai", unit: "" },
];

const isRate = (unit: string) => unit === "%";
const show = (n: number, unit: string) => String(isRate(unit) ? Math.round(n * 10_000) / 100 : n).replace(".", ",");

function toText(s: TaxSettings) {
  const out: Record<string, string> = {};
  for (const f of FIELDS) out[f.key] = show(s[f.key] as number, f.unit);
  out.norm_rate = show(s.norm_rate, "%");
  out.actual_expenses = show(s.actual_expenses, "€");
  out.min_psd_monthly = show(s.min_psd_monthly, "€");
  return out;
}

export function TaxSettingsForm({ initial }: { initial: TaxSettings }) {
  const [text, setText] = useState(() => toText(initial));
  const [deduction, setDeduction] = useState(initial.deduction);
  const [minPsd, setMinPsd] = useState(initial.min_psd);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const num = (key: string, unit: string) => {
    const n = Number((text[key] ?? "").replace(/\s/g, "").replace(",", "."));
    return isRate(unit) ? n / 100 : n;
  };

  function save(defaults = false) {
    setError(null);
    const value: TaxSettings = {
      ...TAX_DEFAULTS,
      deduction,
      min_psd: minPsd,
      norm_rate: num("norm_rate", "%"),
      actual_expenses: num("actual_expenses", "€"),
      min_psd_monthly: num("min_psd_monthly", "€"),
    };
    for (const f of FIELDS) (value[f.key] as number) = num(f.key, f.unit);
    startTransition(async () => {
      const result = await saveTaxSettings(defaults ? "defaults" : value);
      if (!result.ok) return setError(result.message);
      if (defaults) {
        setText(toText(TAX_DEFAULTS));
        setDeduction(TAX_DEFAULTS.deduction);
        setMinPsd(TAX_DEFAULTS.min_psd);
      }
      setNotice(defaults ? "Atkurtos 2026 m. reikšmės" : "Tarifai išsaugoti");
    });
  }

  const input = (key: string, unit: string, labelText: string, hint?: string) => (
    <label key={key} className="flex min-w-0 flex-col gap-1.5">
      <span className={label}>{labelText}</span>
      <span className="relative flex">
        <input
          inputMode="decimal"
          value={text[key] ?? ""}
          onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))}
          className={cn(field, "h-11 tabular-nums", unit && "pr-9")}
        />
        {unit && <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );

  return (
    <section id="mokesciai" aria-labelledby="mokesciai-title" className={cn(card, "flex scroll-mt-nav flex-col gap-5 p-5")}>
      <div className="flex items-center gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-tile bg-muted">
          <Percent aria-hidden="true" className="size-[22px]" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 id="mokesciai-title" className="font-medium">
            Mokesčiai (IV)
          </h2>
          <p className="text-sm leading-5 text-muted-foreground">
            Tarifai Finansų įverčiui. Užpildyta 2026 m. reikšmėmis – <span className="font-medium text-sand-ink">pasitikrink VMI / Sodra</span>.
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset className="flex flex-col gap-2.5">
          <legend className={cn(label, "mb-2.5")}>Išlaidos</legend>
          <div className={cn(segment, "max-w-[420px]")}>
            <label className={segmentItem}>
              <input type="radio" name="deduction" className="sr-only" checked={deduction === "norm"} onChange={() => setDeduction("norm")} />
              {show(num("norm_rate", "%") || TAX_DEFAULTS.norm_rate, "%")} % norma
            </label>
            <label className={segmentItem}>
              <input type="radio" name="deduction" className="sr-only" checked={deduction === "actual"} onChange={() => setDeduction("actual")} />
              Faktinės išlaidos
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            {deduction === "norm"
              ? input("norm_rate", "%", "Išlaidų norma", "nuo gautų pajamų")
              : input("actual_expenses", "€", "Faktinės išlaidos per metus", "suma už tuos metus")}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">{FIELDS.map((f) => input(f.key, f.unit, f.label, f.hint))}</div>

        <div className="flex flex-col gap-3 rounded-tile border p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={minPsd} onChange={(e) => setMinPsd(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-foreground" />
            <span className="flex flex-col">
              <span className="font-medium">Minimalus PSD kas mėnesį</span>
              <span className="text-sm text-muted-foreground">Išjungta, kol studijuoji nuolatinėse studijose (PSD moka valstybė). Įjunk, kai studijos baigsis.</span>
            </span>
          </label>
          {minPsd && <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">{input("min_psd_monthly", "€", "Minimalus PSD per mėnesį")}</div>}
        </div>

        {error && (
          <p role="alert" className="text-sm text-coral-ink">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending} className={btn.primary}>
            {pending ? "Saugoma…" : "Išsaugoti"}
          </button>
          <button type="button" disabled={pending} onClick={() => save(true)} className={btn.ghost}>
            Atkurti 2026 m. reikšmes
          </button>
        </div>
        <p className="text-xs leading-4 text-muted-foreground">
          GPM = {show(TAX_DEFAULTS.gpm_rate, "%")} % apmokestinamų pajamų − kreditas; kreditas mažėja tolygiai nuo „pilnas iki“ iki „baigiasi ties“. Įvertis, ne mokesčių konsultacija.
        </p>
      </form>
      <Notice message={notice} onClear={() => setNotice(null)} />
    </section>
  );
}
