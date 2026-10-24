import { ChevronLeft, NotebookPen, Pencil, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BoardButton } from "@/components/lessons/board";
import { LessonTimeline } from "@/components/lessons/lesson-timeline";
import { Ledger } from "@/components/payments/ledger";
import { GapsPanel } from "@/components/students/gaps-panel";
import { StatusPill, StudentDot } from "@/components/students/status-pill";
import { TruncatedText } from "@/components/truncated-text";
import {
  formatEur,
  formatGrade,
  formatSchedule,
  formatTime,
  isSlotActive,
  statusLabel,
  todayInVilnius,
  weekdayLong,
  weekdayShort,
  type StudentStatus,
} from "@/lib/students/constants";
import { listStudentLessons } from "@/lib/lessons/queries";
import { notesForLessons } from "@/lib/notes/queries";
import { capitalize, formatDayMonth, monthAccusative } from "@/lib/lessons/time";
import { OPENING_BALANCE_DATE, balanceColor, balanceMeta, formatSignedEur } from "@/lib/payments/constants";
import { getLedger, getStudentBalance, listPaymentStudents } from "@/lib/payments/queries";
import { plural } from "@/lib/plural";
import { getStudent, type StudentDetail } from "@/lib/students/queries";
import { btn, card } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mokinio profilis" };

type Tab = "apzvalga" | "uzrasai" | "mokejimai";
const TABS: { value: Tab; label: string }[] = [
  { value: "apzvalga", label: "Apžvalga" },
  { value: "uzrasai", label: "Užrašai" },
  { value: "mokejimai", label: "Mokėjimai" },
];

const headerButton = "max-sm:min-w-0 max-sm:gap-1.5 max-sm:px-2";

export default function ProfilisPage({ params, searchParams }: PageProps<"/mokiniai/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[1040px] animate-enter">
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Profile({ params, searchParams }: Pick<PageProps<"/mokiniai/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab: Tab = TABS.some((t) => t.value === sp.skirtukas) ? (sp.skirtukas as Tab) : "apzvalga";
  const student = await getStudent(id);
  if (!student) notFound();
  const { balance } = await getStudentBalance(student.id);

  const today = todayInVilnius();
  const current = student.schedule_slots.filter((s) => isSlotActive(s, today));
  const fullName = [student.first_name, student.last_name].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-5">
      <Link href="/mokiniai" className="mt-4 inline-flex items-center gap-1 self-center rounded-pill text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft aria-hidden="true" className="size-3.5" strokeWidth={2} />
        Mokiniai
      </Link>

      {/* Header – white card, emphasis by elevation (DESIGN.md §0) */}
      <section className="glass-border flex flex-wrap items-center gap-6 rounded-hero bg-card p-8 shadow-glass max-sm:gap-4 max-sm:p-5">
        <span className="relative flex size-[72px] shrink-0 items-center justify-center rounded-pill border bg-background font-serif text-[32px] max-sm:size-14 max-sm:text-[26px]">
          {student.first_name.trim()[0]?.toLocaleUpperCase("lt")}
          <StudentDot tone={student.tone} className="absolute right-0.5 bottom-1 size-3.5 ring-[3px] ring-card" />
        </span>
        <div className="flex min-w-[220px] flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 title={fullName} className="clamp-2 min-w-0 font-serif text-[44px] leading-[1.2] font-normal tracking-[-0.03em] max-sm:text-[32px]">
              {student.first_name}
            </h1>
            <span className="shrink-0 text-lg whitespace-nowrap text-muted-foreground">{formatGrade(student.grade, student.math_level)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
            <StatusPill status={student.status} />
            <span className="tabular-nums">{current.length ? formatSchedule(current) : "Laikas nesutartas"}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap tabular-nums">{formatEur(Number(student.price))} / pamoka</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 pr-2 max-sm:items-start">
          <span className="text-[13px] text-muted-foreground">Balansas</span>
          <span className={cn("font-serif text-4xl leading-none tabular-nums", balanceColor(balance))}>{formatSignedEur(balance)}</span>
          <span className="text-[13px] whitespace-nowrap text-muted-foreground">{balanceMeta(balance, Number(student.price))}</span>
        </div>
        {/* Phone: Meet · Lenta · Redaguoti share one row in equal thirds */}
        <div className="flex basis-full flex-wrap gap-2 max-sm:grid max-sm:grid-cols-3">
          {student.meet_url ? (
            <a href={student.meet_url} target="_blank" rel="noopener noreferrer" className={cn(btn.primary, headerButton)}>
              <Video aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              Meet
            </a>
          ) : (
            <span className={cn(btn.primary, headerButton, "pointer-events-none opacity-40")} aria-disabled="true" title="Meet nuoroda nenurodyta">
              <Video aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              Meet
            </span>
          )}
          <BoardButton student={{ id: student.id, name: student.first_name }} url={student.board_url} className={cn(btn.secondary, headerButton)}>
            <Pencil aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            Lenta
          </BoardButton>
          <Link href={`/mokiniai/${student.id}/redaguoti`} className={cn(btn.secondary, headerButton)}>
            Redaguoti
          </Link>
        </div>
      </section>

      <nav aria-label="Profilio skiltys" className="flex gap-0.5 self-center rounded-pill bg-muted p-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "apzvalga" ? `/mokiniai/${student.id}` : `/mokiniai/${student.id}?skirtukas=${t.value}`}
            aria-current={tab === t.value ? "page" : undefined}
            scroll={false}
            className={cn(
              "inline-flex h-10 items-center rounded-pill px-[18px] text-[15px] font-medium transition-all duration-200 outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40",
              tab === t.value ? "bg-card text-foreground shadow-button" : "text-foreground/80 hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "apzvalga" && <Overview student={student} today={today} />}
      {tab === "uzrasai" && (
        <Suspense fallback={<LessonsSkeleton />}>
          <StudentLessons studentId={student.id} />
        </Suspense>
      )}
      {tab === "mokejimai" && (
        <Suspense fallback={<LessonsSkeleton />}>
          <StudentPayments student={{ id: student.id, name: student.first_name }} />
        </Suspense>
      )}
    </div>
  );
}

/* ---------------- Apžvalga ---------------- */

function Overview({ student, today }: { student: StudentDetail; today: string }) {
  const current = student.schedule_slots
    .filter((s) => isSlotActive(s, today) || (s.valid_from > today && s.valid_to === null))
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
  const history = buildHistory(student);

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-4">
        <section aria-labelledby="schedule" className={cn(card, "flex flex-col gap-4 p-6 max-sm:p-5")}>
          <div className="flex items-baseline justify-between">
            <h2 id="schedule" className="font-serif text-2xl leading-[1.1] tracking-[-0.02em]">
              Tvarkaraštis
            </h2>
            <Link href={`/mokiniai/${student.id}/redaguoti`} className="text-sm font-medium hover:underline">
              Keisti
            </Link>
          </div>
          {current.length === 0 ? (
            <p className="text-sm text-muted-foreground">Savaitiniai laikai dar nesutarti.</p>
          ) : (
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {current.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-tile border bg-background px-4 py-3.5">
                  <span className="font-serif text-[28px] leading-none tabular-nums">{formatTime(s.start_time)}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{weekdayLong(s.weekday)}</span>
                    <span className="text-[13px] text-muted-foreground tabular-nums">
                      {s.valid_from > today ? "prasidės " : "nuo "}
                      {s.valid_from}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {history.length > 0 && (
            <div className="flex flex-col">
              <span className="mb-2 text-[13px] font-medium text-muted-foreground">Pakeitimų istorija</span>
              <ol className="grid grid-cols-[92px_14px_minmax(0,1fr)] gap-x-2.5 gap-y-2.5 text-sm leading-[19px]">
                {history.map((h, i) => (
                  <li key={i} className="contents">
                    <span className="text-muted-foreground tabular-nums">{h.date}</span>
                    <span aria-hidden="true" className={cn("mt-[5px] size-2 rounded-pill", h.dot)} />
                    <span className="[overflow-wrap:anywhere]">{h.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section aria-labelledby="about" className={cn(card, "flex flex-col gap-3 p-6 max-sm:p-5")}>
          <h2 id="about" className="font-serif text-2xl leading-[1.1] tracking-[-0.02em]">
            Apie mokinį
          </h2>
          {student.notes ? (
            <p className="leading-6 whitespace-pre-line [overflow-wrap:anywhere]">{student.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Kol kas nieko neįrašyta.</p>
          )}
        </section>
      </div>

      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
        <GapsPanel studentId={student.id} gaps={student.gaps} />

        <section aria-labelledby="contacts" className={cn(card, "flex flex-col gap-3.5 p-6 max-sm:p-5")}>
          <h2 id="contacts" className="font-serif text-2xl leading-[1.1] tracking-[-0.02em]">
            Kontaktai
          </h2>
          <ContactBlock title="Mokinys" phone={student.student_phone} email={student.student_email} />
          <div className="h-px bg-border/70" />
          <ContactBlock title={student.parent_name ? `Tėvai · ${student.parent_name}` : "Tėvai"} phone={student.parent_phone} email={student.parent_email} />
          <div className="h-px bg-border/70" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] font-medium text-muted-foreground">Nuorodos</span>
            <LinkLine href={student.meet_url} icon={<Video aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />} empty="Meet nenurodytas" />
            <LinkLine href={student.board_url} icon={<Pencil aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />} empty="Lenta nenurodyta" />
          </div>
        </section>
      </div>
    </div>
  );
}

function ContactBlock({ title, phone, email }: { title: string; phone: string | null; email: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <TruncatedText className="text-[13px] font-medium text-muted-foreground">{title}</TruncatedText>
      {phone ? (
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="w-fit text-[15px] hover:underline">
          {phone}
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className="min-w-0 text-[15px] hover:underline">
          <TruncatedText>{email}</TruncatedText>
        </a>
      ) : null}
      {!phone && !email ? <span className="text-sm text-muted-foreground">Nenurodyta</span> : null}
    </div>
  );
}

function LinkLine({ href, icon, empty }: { href: string | null; icon: React.ReactNode; empty: string }) {
  if (!href) {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {empty}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 text-sm hover:underline">
      {icon}
      <TruncatedText>{href.replace(/^https?:\/\//, "")}</TruncatedText>
    </a>
  );
}

/** Status changes + slot starts/ends, newest first (same day: the one recorded later goes first). */
function buildHistory(student: StudentDetail) {
  const statusDot: Record<StudentStatus, string> = {
    derinama: "bg-sand",
    pastovus: "bg-sky",
    nepastovus: "bg-lavender",
    pauze: "bg-slate",
    archyvuotas: "bg-muted-foreground/40",
  };
  // `recorded` = when the row was written; it breaks ties between entries with the same date.
  const items: { date: string; recorded: string; order: number; text: string; dot: string }[] = [];

  for (const h of student.student_status_history) {
    items.push({ date: h.valid_from, recorded: h.created_at, order: 2, text: `Statusas: ${statusLabel(h.status)}${h.note ? ` · ${h.note}` : ""}`, dot: statusDot[h.status] });
  }
  for (const s of student.schedule_slots) {
    const slot = `${weekdayShort(s.weekday)} ${formatTime(s.start_time)}`;
    items.push({ date: s.valid_from, recorded: s.created_at, order: 1, text: `Pridėtas laikas ${slot}`, dot: "bg-foreground/70" });
    if (s.valid_to) {
      items.push({ date: s.valid_to, recorded: s.updated_at, order: 0, text: `Laikas ${slot} baigtas`, dot: "bg-muted-foreground/40" });
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.recorded.localeCompare(a.recorded) || b.order - a.order);
}

/* ---------------- Užrašai (lessons by date with their notes) ---------------- */

async function StudentLessons({ studentId }: { studentId: string }) {
  const lessons = await listStudentLessons(studentId);
  const notes = await notesForLessons(lessons.map((l) => l.id));
  if (lessons.length === 0) {
    return (
      <EmptyTab icon={<NotebookPen aria-hidden="true" className="size-6" strokeWidth={1.75} />} title="Pamokų dar nėra">
        Kai mokinys turės savaitinį laiką arba pridėsi vienkartinę pamoką, jos atsiras čia – su data ir būsena.
      </EmptyTab>
    );
  }
  return <LessonTimeline lessons={lessons} notes={notes} />;
}

/* ---------------- Mokėjimai (ledger with running balance) ---------------- */

async function StudentPayments({ student }: { student: { id: string; name: string } }) {
  const [ledger, students] = await Promise.all([getLedger(student.id), listPaymentStudents()]);
  const { month, balance } = ledger;
  const monthName = capitalize(monthAccusative(month.start)); // "Spalį"
  const box = cn(card, "flex min-w-0 flex-col gap-1.5 p-5 max-sm:p-4");
  const value = "font-serif text-4xl leading-none tabular-nums max-sm:text-[30px]";
  const meta = "truncate-name text-[13px] text-muted-foreground";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1 max-md:gap-2.5">
        <div className={box}>
          <span className="text-sm text-muted-foreground">{monthName} įvyko</span>
          <span className={value}>{formatEur(month.charged)}</span>
          <span className={meta}>
            {plural(month.held, ["pamoka", "pamokos", "pamokų"])}
            {month.cancelled > 0 && ` · ${month.cancelled} atšaukta`}
          </span>
        </div>
        <div className={box}>
          <span className="text-sm text-muted-foreground">{monthName} sumokėta</span>
          <span className={cn(value, month.paid > 0 && "text-sage-ink")}>{formatEur(month.paid)}</span>
          <span className={meta}>{plural(month.payments, ["mokėjimas", "mokėjimai", "mokėjimų"])}</span>
        </div>
        <div className={box}>
          <span className="text-sm text-muted-foreground">Nuo {formatDayMonth(OPENING_BALANCE_DATE)}</span>
          <span className={value}>{formatEur(balance.paid)}</span>
          <span className={meta}>
            sumokėta iš viso · {plural(balance.held, ["pamoka", "pamokos", "pamokų"])}
          </span>
        </div>
      </div>
      <Ledger rows={ledger.rows} student={student} opening={balance.opening} students={students} />
    </div>
  );
}

function LessonsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2.5" aria-busy="true" aria-label="Įkeliama">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-card bg-muted" />
      ))}
    </div>
  );
}

/* ---------------- states ---------------- */

function EmptyTab({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className={cn(card, "mx-auto flex w-full max-w-[720px] flex-col items-center gap-3 px-6 py-12 text-center")}>
      <span className="flex size-14 items-center justify-center rounded-pill border bg-background text-foreground/80">{icon}</span>
      <h2 className="font-serif text-[22px] leading-[1.15]">{title}</h2>
      <p className="max-w-[420px] text-sm leading-5 text-muted-foreground">{children}</p>
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-5 pt-12" aria-busy="true" aria-label="Įkeliama">
      <div className="h-[220px] animate-pulse rounded-hero bg-muted" />
      <div className="h-12 w-80 animate-pulse self-center rounded-pill bg-muted" />
      <div className="flex gap-4">
        <div className="h-72 flex-[2] animate-pulse rounded-card bg-muted" />
        <div className="h-72 flex-1 animate-pulse rounded-card bg-muted" />
      </div>
    </div>
  );
}
