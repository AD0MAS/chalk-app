import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PaymentsBrowser } from "@/components/payments/payments-browser";
import { getBankInfo } from "@/lib/bank/sync";
import { addDays, mondayOf, todayVilnius } from "@/lib/lessons/time";
import { PERIODS, type Period } from "@/lib/payments/constants";
import { listPayments, listPaymentStudents } from "@/lib/payments/queries";
import { plural } from "@/lib/plural";
import { formatEur } from "@/lib/students/constants";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mokėjimai" };

export default function MokejimaiPage({ searchParams }: PageProps<"/mokejimai">) {
  return (
    <div className="mx-auto w-full max-w-[1040px] animate-enter">
      <Suspense fallback={<PaymentsSkeleton />}>
        <Payments searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Period → inclusive date range in Vilnius. */
function range(period: Period, today: string): { from?: string; to?: string } {
  const month = today.slice(0, 7);
  const firstOfNext = (m: string) => `${addDays(`${m}-28`, 4).slice(0, 7)}-01`;
  switch (period) {
    case "savaite":
      return { from: mondayOf(today), to: addDays(mondayOf(today), 6) };
    case "menuo":
      return { from: `${month}-01`, to: addDays(firstOfNext(month), -1) };
    case "praeitas": {
      const prev = addDays(`${month}-01`, -1).slice(0, 7);
      return { from: `${prev}-01`, to: addDays(`${month}-01`, -1) };
    }
    case "metai":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    default:
      return {};
  }
}

async function Payments({ searchParams }: { searchParams: PageProps<"/mokejimai">["searchParams"] }) {
  const params = await searchParams;
  const period: Period = PERIODS.some((p) => p.value === params.laikotarpis) ? (params.laikotarpis as Period) : "visi";
  const students = await listPaymentStudents();
  const studentId = typeof params.mokinys === "string" && students.some((s) => s.id === params.mokinys) ? params.mokinys : "";

  const showHidden = params.rodyti === "paslepti";

  const [payments, unassigned, hidden, bank] = await Promise.all([
    listPayments({ ...range(period, todayVilnius()), studentId: studentId || undefined, kind: "assigned" }),
    listPayments({ kind: "unassigned" }),
    listPayments({ kind: "hidden" }),
    getBankInfo().catch(() => null),
  ]);
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <PageHeader
        title="Mokėjimai"
        subtitle={payments.length ? `${plural(payments.length, ["mokėjimas", "mokėjimai", "mokėjimų"])} · ${formatEur(total)}` : "Bankas, išrašai ir rankiniai mokėjimai"}
      />
      <PaymentsBrowser
        payments={payments}
        unassigned={unassigned}
        hidden={showHidden ? hidden : null}
        hiddenCount={hidden.length}
        bankConnected={!!bank && bank.state !== "off"}
        students={students}
        period={period}
        studentId={studentId}
      />
    </>
  );
}

function PaymentsSkeleton() {
  return (
    <>
      <PageHeader title="Mokėjimai" />
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Įkeliama">
        <div className="h-11 w-full animate-pulse rounded-pill bg-muted" />
        <div className="h-[76px] animate-pulse rounded-card bg-muted" />
        <div className={cn(card, "flex flex-col gap-3 p-4")}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-tile bg-muted" />
          ))}
        </div>
      </div>
    </>
  );
}
