import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col items-center">
      <PageHeader title="Puslapis nerastas" subtitle="Tokio adreso Chalk'e nėra." />
      <Link
        href="/"
        className="inline-flex h-11 items-center rounded-pill bg-primary px-5 font-medium text-primary-foreground shadow-button"
      >
        Grįžti į Šiandien
      </Link>
    </div>
  );
}
