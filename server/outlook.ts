import ical from "node-ical";
import { db, persist, allocId } from "./storage.js";
import type { Event } from "./storage.js";

// Same pitfall as the frontend's toLocalDateStr: Date.toISOString() converts
// to UTC first, which silently shifts the calendar day backward for positive
// UTC-offset timezones. ICS all-day (VALUE=DATE) events are especially prone
// to this since node-ical represents them as local midnight.
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toLocalTimeStr(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function summaryText(summary: ical.VEvent["summary"]): string {
  if (!summary) return "Untitled event";
  return typeof summary === "string" ? summary : summary.val;
}

const SYNC_PAST_DAYS = 7;
const SYNC_FUTURE_DAYS = 60;

export async function syncOutlookCalendar(icsUrl: string): Promise<{ added: number; updated: number; total: number }> {
  const res = await fetch(icsUrl);
  if (!res.ok) throw new Error(`Failed to fetch calendar (HTTP ${res.status})`);
  const icsText = await res.text();
  const parsed = ical.parseICS(icsText);

  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - SYNC_PAST_DAYS);
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + SYNC_FUTURE_DAYS);

  let added = 0;
  let updated = 0;

  const upsert = (externalId: string, fields: Omit<Event, "id" | "externalId" | "taskId" | "matterId">) => {
    const existing = db.events.find(e => e.externalId === externalId);
    if (existing) {
      Object.assign(existing, fields);
      updated++;
    } else {
      db.events.push({ id: allocId(), externalId, taskId: null, matterId: null, ...fields });
      added++;
    }
  };

  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (!item || item.type !== "VEVENT") continue;

    const title = summaryText(item.summary);

    if (item.rrule) {
      const instances = ical.expandRecurringEvent(item, { from: rangeStart, to: rangeEnd });
      for (const instance of instances) {
        const durationMinutes = Math.max(15, Math.round((instance.end.getTime() - instance.start.getTime()) / 60000));
        upsert(`${item.uid}::${instance.start.toISOString()}`, {
          title,
          date: toLocalDateStr(instance.start),
          time: instance.isFullDay ? "" : toLocalTimeStr(instance.start),
          allDay: instance.isFullDay,
          category: "outlook",
          durationMinutes,
        });
      }
    } else if (item.start) {
      const start = item.start;
      if (start < rangeStart || start > rangeEnd) continue;
      const isAllDay = item.datetype === "date";
      const durationMinutes = item.end
        ? Math.max(15, Math.round((item.end.getTime() - start.getTime()) / 60000))
        : 60;
      upsert(item.uid, {
        title,
        date: toLocalDateStr(start),
        time: isAllDay ? "" : toLocalTimeStr(start),
        allDay: isAllDay,
        category: "outlook",
        durationMinutes,
      });
    }
  }

  db.settings.lastOutlookSync = new Date().toISOString();
  persist();
  return { added, updated, total: added + updated };
}
