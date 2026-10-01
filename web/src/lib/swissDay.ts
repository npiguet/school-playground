// The Swiss local day, shared by the app (a seal won today, lib/world/seals.ts) and the e2e (e2e/helpers.ts
// re-exports it). With no imports, so vitest tests it and the e2e helpers (plain node) can load it.

/** The Swiss local day (YYYY-MM-DD), `daysAgo` calendar days before `now` (negative: after). The
 *  server's days and weeks are Europe/Zurich ones (server/app/clock.py, plan Decision 4): a UTC date is
 *  the day before from local midnight to 01:00 or 02:00, and on a Monday that is last week. The days
 *  are counted on the calendar, from Zurich's own date, so a daylight-saving change in between never
 *  moves the answer (paces re-review: shifting the instant by 24 h a day did). */
export function swissDay(daysAgo = 0, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day') - daysAgo)).toISOString().slice(0, 10);
}
