/**
 * Lithuanian plural forms: 1 mokinys · 2 mokiniai · 10 mokinių · 21 mokinys · 22 mokiniai.
 * plural(n, ["mokinys", "mokiniai", "mokinių"])
 */
export function plural(n: number, [one, few, many]: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 9 && (mod100 < 11 || mod100 > 19)) return `${n} ${few}`;
  return `${n} ${many}`;
}
