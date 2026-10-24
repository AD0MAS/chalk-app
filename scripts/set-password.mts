// npm run auth:set-password – sets the password of the ALLOWED_EMAIL user to DEV_LOGIN_PASSWORD.
// Uses the Supabase admin API with SUPABASE_SECRET_KEY. Never prints the password.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
const password = process.env.DEV_LOGIN_PASSWORD;

if (!url || !secret || !email || !password) {
  console.error("Trūksta .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, ALLOWED_EMAIL arba DEV_LOGIN_PASSWORD.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("DEV_LOGIN_PASSWORD per trumpas – naudok bent 12 simbolių.");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;

// Find the user (Chalk has one user, but page through just in case).
let userId: string | undefined;
for (let page = 1; !userId; page++) {
  const { data, error } = await admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error(`Nepavyko gauti vartotojų: ${error.message}`);
  userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (data.users.length < 100) break;
}
if (!userId) {
  console.error("Vartotojas su ALLOWED_EMAIL nerastas Supabase Auth'e.");
  process.exit(1);
}

const { error } = await admin.updateUserById(userId, { password });
if (error) {
  console.error(`Nepavyko nustatyti slaptažodžio: ${error.message}`);
  process.exit(1);
}
console.log("Slaptažodis nustatytas (reikšmė nerodoma).");
