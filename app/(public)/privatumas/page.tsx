import type { Metadata } from "next";

// Public privacy policy (no login – proxy.ts skips /privatumas). Google's OAuth consent screen and the
// Enable Banking application link here. In English for Google's and Enable Banking's reviewers;
// the Google Calendar part is the same text as the original GitHub gist.

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="flex min-h-dvh justify-center px-4 py-12">
      <article lang="en" className="glass-border w-full max-w-[720px] animate-enter self-start rounded-hero bg-card px-8 pt-8 pb-9 shadow-glass max-sm:px-5 max-sm:pt-6">
        <span className="flex items-center justify-center gap-[7px] pb-6" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M3.5 15.5c4.5-1.6 9.5-5.6 17-9" />
            <path d="M6 20c3.2-.9 6.4-2.6 9.5-4.6" opacity=".4" />
          </svg>
          <span className="font-serif text-[22px] leading-[1.2] font-medium tracking-[-0.02em]">Chalk</span>
        </span>
        <h1 className="pb-5 text-center font-serif text-[44px] leading-[1.1] font-normal tracking-[-0.03em] max-sm:text-[32px]">
          Privacy <em>Policy</em>
        </h1>
        <div className="flex flex-col gap-4">
          <p>Chalk is a private tool used only by its owner, Adomas Pakalniškis, to manage his own tutoring schedule and payments.</p>
          <h2 className="pt-2 font-medium">Google Calendar</h2>
          <ul className="flex list-disc flex-col gap-2.5 pl-5 marker:text-muted-foreground">
            <li>
              Chalk requests access only to Google Calendar calendars that Chalk itself creates (&ldquo;Pamokos&rdquo;). It cannot see or
              change any other calendar.
            </li>
            <li>Data is used only to create and update lesson events in that calendar. It is not shared with or sold to anyone.</li>
            <li>
              Access can be revoked at any time at{" "}
              <a href="https://myaccount.google.com/permissions" className="underline underline-offset-2 [overflow-wrap:anywhere]">
                https://myaccount.google.com/permissions
              </a>
              .
            </li>
          </ul>
          <h2 className="pt-2 font-medium">Bank account (via Enable Banking)</h2>
          <ul className="flex list-disc flex-col gap-2.5 pl-5 marker:text-muted-foreground">
            <li>
              Through Enable Banking, Chalk has read-only access to the owner&rsquo;s own bank account, granted by the owner himself.
              It cannot make payments or move money.
            </li>
            <li>
              Only incoming payments are stored: date, amount, payer name, payer IBAN, payment details and the bank&rsquo;s transaction id.
              They are used only to match payments to the students they are for. Outgoing transactions are not stored.
            </li>
            <li>The data is kept in Chalk&rsquo;s private database in the EU and is not shared with or sold to anyone.</li>
            <li>
              Access ends when the bank consent expires (at most 180 days) or when the owner disconnects the bank in Chalk, which also
              closes the consent at the bank.
            </li>
          </ul>
          <p className="border-t pt-4 text-muted-foreground">
            Contact:{" "}
            <a href="mailto:adomas.pakalniskis@gmail.com" className="text-foreground underline underline-offset-2">
              adomas.pakalniskis@gmail.com
            </a>
          </p>
        </div>
      </article>
    </main>
  );
}
