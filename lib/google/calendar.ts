import "server-only";

// Minimal Google Calendar API v3 client (plain fetch). Only calls that calendar.app.created allows:
// the calendar Chalk created and the events on it.

const API = "https://www.googleapis.com/calendar/v3";

export const CALENDAR_NAME = "Pamokos";

export class GoogleApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type EventBody = {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  status: "confirmed";
  colorId: string;
  reminders: { useDefault: false; overrides: { method: "popup" | "email"; minutes: number }[] };
  extendedProperties: { private: Record<string, string> };
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One API call. Retries rate limits (429 / 403 rateLimitExceeded) and 5xx a couple of times. */
async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;

    const text = await res.text();
    const rateLimited = res.status === 429 || (res.status === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(text));
    if ((rateLimited || res.status >= 500) && attempt < 3) {
      await wait(1000 * 2 ** attempt);
      continue;
    }
    let message = text;
    try {
      message = JSON.parse(text).error?.message ?? text;
    } catch {}
    throw new GoogleApiError(`Google ${res.status}: ${message}`.slice(0, 300), res.status);
  }
}

const isStatus = (e: unknown, ...codes: number[]) => e instanceof GoogleApiError && codes.includes(e.status);

/**
 * Returns the id of Chalk's "Pamokos" calendar: the stored one if it still exists,
 * otherwise a new one (Europe/Vilnius). `created` tells the caller to push all lessons again.
 */
export async function ensureCalendar(token: string, storedId: string | null) {
  if (storedId) {
    try {
      await call(token, "GET", `/calendars/${encodeURIComponent(storedId)}`);
      return { id: storedId, created: false };
    } catch (e) {
      // 404 = deleted by hand; 403 = a different Google account (not created by this app there)
      if (!isStatus(e, 403, 404, 410)) throw e;
    }
  }
  const calendar = await call<{ id: string }>(token, "POST", "/calendars", {
    summary: CALENDAR_NAME,
    description: "Pamokos iš Chalk. Jas kuria ir keičia Chalk – perkelk ar atšauk pamoką Chalk'e.",
    timeZone: "Europe/Vilnius",
  });
  return { id: calendar.id, created: true };
}

const eventsPath = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}/events`;

/**
 * Creates or updates an event with our own id. `exists` = we think Google has it already.
 * A deleted (cancelled) event with the same id is brought back by the update (status "confirmed").
 */
export async function upsertEvent(token: string, calendarId: string, eventId: string, body: EventBody, exists: boolean) {
  const update = () => call(token, "PUT", `${eventsPath(calendarId)}/${eventId}`, body);
  const insert = () => call(token, "POST", eventsPath(calendarId), { ...body, id: eventId });
  try {
    await (exists ? update() : insert());
  } catch (e) {
    if (exists ? isStatus(e, 404, 410) : isStatus(e, 409)) await (exists ? insert() : update());
    else throw e;
  }
}

/** Deletes an event; one that is already gone counts as done. */
export async function deleteEvent(token: string, calendarId: string, eventId: string) {
  try {
    await call(token, "DELETE", `${eventsPath(calendarId)}/${eventId}`);
  } catch (e) {
    if (!isStatus(e, 404, 410)) throw e;
  }
}

/** Ids of all (not deleted) events on the calendar – for "Sinchronizuoti iš naujo". */
export async function listEventIds(token: string, calendarId: string) {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ maxResults: "2500", fields: "items(id),nextPageToken" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await call<{ items?: { id: string }[]; nextPageToken?: string }>(
      token,
      "GET",
      `${eventsPath(calendarId)}?${params}`
    );
    ids.push(...(page.items ?? []).map((item) => item.id));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids;
}
