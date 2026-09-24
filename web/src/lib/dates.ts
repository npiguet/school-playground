// Date helpers for the Oracle's prophecies (spec's "Decisions" #14): a text with
// due_date >= today is shown as a *dictée préparée* until the date passes. Dates
// are ISO (YYYY-MM-DD) on the wire and Swiss-style (dd.mm.yyyy) on screen.

/** Local YYYY-MM-DD for a Date, ignoring time-of-day and timezone offset tricks. */
export function todayIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** '2026-10-03' -> '03.10.2026'. */
export function formatSwissDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** A text is a prophecy while its due date has not yet passed (inclusive of today). */
export function isProphecy(dueDate: string | null, today: Date = new Date()): boolean {
  if (!dueDate) return false;
  return dueDate >= todayIso(today);
}
