import { Suspense } from "react";
import { HashScroll } from "@/components/hash-scroll";
import { Navbar } from "@/components/navbar/navbar";
import { getBankInfo } from "@/lib/bank/sync";
import { getSyncInfo } from "@/lib/google/sync";
import { countAwaitingNotes } from "@/lib/notes/queries";
import { countUnassigned, getDebts } from "@/lib/payments/queries";
import { countStudentsByStatus } from "@/lib/students/queries";

// Every logged-in screen: floating navbar + centred content (DESIGN.md §1, §3).
// Access is checked in proxy.ts before any of these pages render.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* The bar renders immediately; the Mokiniai counts (and Laukia užrašų) stream in at request time. */}
      <Suspense fallback={<Navbar />}>
        <NavbarWithCounts />
      </Suspense>
      <HashScroll />
      {/* Top padding clears the floating navbar */}
      <main className="px-6 pt-[116px] pb-24 max-md:px-4 max-md:pt-[84px] print:p-0">{children}</main>
    </>
  );
}

async function NavbarWithCounts() {
  // Counts and the sync status are a nice-to-have – never break the navigation if they fail to load.
  const [students, uzrasai, unassigned, debts, sync, bank] = await Promise.all([
    countStudentsByStatus().catch(() => undefined),
    countAwaitingNotes().catch(() => undefined),
    countUnassigned().catch(() => undefined),
    getDebts().catch(() => undefined),
    getSyncInfo().catch(() => undefined),
    getBankInfo().catch(() => undefined),
  ]);
  return <Navbar counts={{ ...students, uzrasai, nepriskirti: unassigned?.count, skolos: debts?.debtors.length }} sync={sync} bank={bank} />;
}
