// Name helpers for DESIGN.md §9 (long names & text overflow).

type Person = { id: string; firstName: string; lastName?: string | null };

/**
 * Display name = first name. If two people in the list share a first name,
 * add the surname initial ("Ieva K.").
 */
export function displayNames<T extends Person>(people: T[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const p of people) {
    const key = p.firstName.trim().toLocaleLowerCase("lt");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const result = new Map<string, string>();
  for (const p of people) {
    const first = p.firstName.trim();
    const shared = (counts.get(first.toLocaleLowerCase("lt")) ?? 0) > 1;
    const initial = p.lastName?.trim()[0];
    result.set(p.id, shared && initial ? `${first} ${initial.toLocaleUpperCase("lt")}.` : first);
  }
  return result;
}

/** Initials for the narrowest blocks: "Aleksandra-Gabrielė" → "AG", "Konstantinas" → "K". */
export function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase("lt"))
    .join("");
}
