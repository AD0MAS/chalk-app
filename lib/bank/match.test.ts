// npm test – payer matching (lib/bank/import.ts): auto-assignment only by IBAN or a full name, never by initials.
// Made-up names only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fullNameKey } from "./constants.ts";
import { aliasToRemember, matchStudent, type Alias } from "./import.ts";

const ONA = "student-ona";
const PETRAS = "student-petras";
const alias = (a: Partial<Alias>): Alias => ({ id: "a1", student_id: ONA, payer_name: null, payer_iban: null, ...a });
const payer = (payer_name: string | null, payer_iban: string | null = null) => ({ payer_name, payer_iban });

test("same full name – case, diacritics and word order don't matter", () => {
  const aliases = [alias({ payer_name: "Vardenė Pavardenienė" })];
  assert.equal(matchStudent(aliases, payer("VARDENE PAVARDENIENE"))?.studentId, ONA);
  assert.equal(matchStudent(aliases, payer("Pavardenienė Vardenė"))?.studentId, ONA); // reversed word order MUST match
  assert.equal(matchStudent(aliases, payer("PAVARDENIENĖ,  VARDENĖ"))?.by, "name");
});

test("same initials, different name – never matches", () => {
  const aliases = [alias({ payer_name: "Vardenė Pavardenienė" })];
  assert.equal(matchStudent(aliases, payer("Vida Petraitienė")), null);
  assert.equal(matchStudent(aliases, payer("Petras Vaitkus")), null); // same initials, other order
  assert.equal(matchStudent(aliases, payer("Vardenė Petraitienė")), null); // same first name, other surname
  assert.equal(matchStudent(aliases, payer("Vardenė")), null);
});

test("initials never match – not in the payment, not in the alias", () => {
  assert.equal(matchStudent([alias({ payer_name: "Vardenė Pavardenienė" })], payer("V. Pavardenienė")), null);
  assert.equal(matchStudent([alias({ payer_name: "Vardenė Pavardenienė" })], payer("V P")), null);
  assert.equal(matchStudent([alias({ payer_name: "Pavardenienė V." })], payer("Pavardenienė V.")), null);
  assert.equal(matchStudent([alias({ payer_name: "V. P." })], payer("V. P.")), null);
});

test("fullNameKey: two or more words, no initials", () => {
  assert.equal(fullNameKey("Pavardenienė Vardenė"), "pavardeniene vardene");
  assert.equal(fullNameKey("Vardenė Pavardenienė"), fullNameKey("PAVARDENIENĖ VARDENĖ"));
  assert.equal(fullNameKey("Vardenė"), null);
  assert.equal(fullNameKey("V. Pavardenienė"), null);
  assert.equal(fullNameKey(null), null);
});

test("IBAN matches whatever the name (spaces and case ignored)", () => {
  const aliases = [alias({ payer_iban: "LT121000011101001000", payer_name: "Vardenė Pavardenienė" })];
  assert.deepEqual(matchStudent(aliases, payer("V. P.", "lt12 1000 0111 0100 1000")), { studentId: ONA, by: "iban" });
  assert.equal(matchStudent(aliases, payer("Vardenė Pavardenienė", "LT999999999999999999"))?.by, "name");
});

test("a name that points to two students is not used", () => {
  const aliases = [alias({ payer_name: "Vardenė Pavardenienė" }), alias({ id: "a2", student_id: PETRAS, payer_name: "Pavardenienė Vardenė" })];
  assert.equal(matchStudent(aliases, payer("Vardenė Pavardenienė")), null);
});

test("Prisiminti: stores the IBAN together with the name", () => {
  assert.deepEqual(aliasToRemember([], payer("Vardenė Pavardenienė", "lt12 1000 0111 0100 1000"), ONA), {
    updateId: null,
    values: { student_id: ONA, payer_iban: "LT121000011101001000", payer_name: "Vardenė Pavardenienė" },
  });
});

test("Prisiminti: a name-only alias (from the statement) gets the IBAN added", () => {
  const aliases = [alias({ id: "old", payer_name: "PAVARDENIENĖ VARDENĖ" })];
  assert.deepEqual(aliasToRemember(aliases, payer("Vardenė Pavardenienė", "LT121000011101001000"), ONA), {
    updateId: "old",
    values: { student_id: ONA, payer_iban: "LT121000011101001000", payer_name: "Vardenė Pavardenienė" },
  });
});

test("Prisiminti: the same IBAN updates its alias (new student)", () => {
  const aliases = [alias({ id: "iban", payer_iban: "LT121000011101001000", payer_name: "Vardenė Pavardenienė" })];
  assert.equal(aliasToRemember(aliases, payer(null, "LT121000011101001000"), PETRAS)?.updateId, "iban");
  assert.equal(aliasToRemember(aliases, payer(null, "LT121000011101001000"), PETRAS)?.values.payer_name, "Vardenė Pavardenienė");
});

test("Prisiminti: nothing to remember by initials alone", () => {
  assert.equal(aliasToRemember([], payer("V. Pavardenienė"), ONA), null);
  assert.equal(aliasToRemember([], payer(null), ONA), null);
  // …but with an IBAN it is remembered (the IBAN does the matching)
  assert.equal(aliasToRemember([], payer("V. Pavardenienė", "LT121000011101001000"), ONA)?.values.payer_iban, "LT121000011101001000");
});
