import { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import type { Event, Task, Matter } from "@/context/AppContext";
import { toLocalDateStr, toLocalTimeStr } from "@/lib/utils";

const EVENT_CATEGORIES = ["work", "personal", "health", "social", "other"];
const KNOWN_EV_COLORS = new Set(["work", "personal", "health", "social"]);

const HOUR_H = 56;
const START_H = 8;
const END_H = 22;
const HOURS = Array.from({ length: END_H - START_H }, (_, i) => i + START_H);
const SNAP_MINS = 15;

type CalView = "day" | "week" | "month";

interface DragPayload {
  kind: "task" | "existingEvent";
  id: number;
  title?: string;
  matterId?: number | null;
}

function fmtHour(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function getWeekDates(anchor: string): string[] {
  const d = new Date(anchor + "T00:00:00");
  const dow = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    return toLocalDateStr(dd);
  });
}

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) {
  const d = new Date(y, m, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function getEndTime(ev: Event): string {
  if (ev.endTime) return ev.endTime;
  const [h, m] = ev.time.split(":").map(Number);
  const end = h * 60 + m + 60;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

function getEventHeight(ev: Event): number {
  const [sh, sm] = ev.time.split(":").map(Number);
  const endT = getEndTime(ev);
  const [eh, em] = endT.split(":").map(Number);
  const dur = Math.max(SNAP_MINS, (eh * 60 + em) - (sh * 60 + sm));
  return (dur / 60) * HOUR_H;
}

function timeToMins(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Planned vs. actual variance, e.g. "+30m over" / "20m under" / "On schedule".
function getVarianceLabel(ev: Event): string | null {
  if (!ev.actualTime || !ev.actualEndTime) return null;
  const plannedMins = timeToMins(getEndTime(ev)) - timeToMins(ev.time);
  const actualMins = timeToMins(ev.actualEndTime) - timeToMins(ev.actualTime);
  const diff = actualMins - plannedMins;
  if (diff === 0) return "On schedule";
  return diff > 0 ? `+${diff}m over` : `${Math.abs(diff)}m under`;
}

function tgevColor(ev: Event): string {
  if (ev.matterId != null) return `lo-tgev-c${ev.matterId % 8}`;
  return KNOWN_EV_COLORS.has(ev.category) ? `lo-tgev-${ev.category}` : "lo-tgev-other";
}
function mevColor(ev: Event): string {
  if (ev.allDay) return "lo-mev-allday";
  if (ev.matterId != null) return `lo-mev-c${ev.matterId % 8}`;
  return KNOWN_EV_COLORS.has(ev.category) ? `lo-mev-${ev.category}` : "lo-mev-other";
}

/* ─── Task side panel (drag source) ───────────────────────── */
function TaskPanel({ tasks, matters }: { tasks: Task[]; matters: Matter[] }) {
  const open = tasks.filter(t => !t.done);
  const matterById = (id: number | null) => id == null ? null : matters.find(m => m.id === id) ?? null;
  return (
    <div className="lo-cal-task-panel">
      <div className="lo-cal-task-panel-hd">Drag to schedule</div>
      {open.length === 0 && <p className="lo-cal-task-panel-empty">No open tasks</p>}
      {open.map(t => {
        const matter = matterById(t.matterId);
        return (
          <div
            key={t.id}
            draggable
            className="lo-cal-task-item"
            onDragStart={e => {
              e.dataTransfer.setData("application/json", JSON.stringify({ kind: "task", id: t.id, title: t.text, matterId: t.matterId } satisfies DragPayload));
              e.dataTransfer.effectAllowed = "copy";
            }}
          >
            <span className={`lo-cal-task-dot lo-cal-dot-${t.priority}`} />
            <div className="lo-cal-task-label">
              {t.text}
              {matter && <span className={`lo-tag lo-cal-task-matter lo-matter-c${matter.id % 8}`}>◇ {matter.name}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Event hover tooltip ──────────────────────────────────── */
function EvTooltip({ ev, matterName, rect }: { ev: Event; matterName: string | null; rect: DOMRect }) {
  const endT = getEndTime(ev);
  return (
    <div className="lo-ev-tooltip" style={{ position: "fixed", top: rect.top, left: rect.right + 8, zIndex: 200 }}>
      <div className="lo-ev-tt-title">{ev.title}</div>
      <div className="lo-ev-tt-row">
        📅 {new Date(ev.date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
      </div>
      {!ev.allDay && ev.time && <div className="lo-ev-tt-row">⏰ {ev.time} – {endT}</div>}
      {ev.allDay && <div className="lo-ev-tt-row">⏰ All day</div>}
      <div className="lo-ev-tt-row">🏷 {ev.category}</div>
      {matterName && <div className="lo-ev-tt-row">◇ {matterName}</div>}
      {ev.actualTime && (
        <div className="lo-ev-tt-row">⏱ Actual: {ev.actualTime}{ev.actualEndTime ? ` – ${ev.actualEndTime}` : " (in progress)"}</div>
      )}
      {getVarianceLabel(ev) && <div className="lo-ev-tt-row">{getVarianceLabel(ev)}</div>}
    </div>
  );
}

/* ─── Event edit modal ────────────────────────────────────── */
function EventEditModal({ ev, matterName, onSave, onDelete, onClose }: {
  ev: Event;
  matterName: string | null;
  onSave: (id: number, updates: Partial<Omit<Event, "id">>) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}) {
  const defaultEnd = getEndTime(ev);
  const [form, setForm] = useState({
    title: ev.title, date: ev.date, time: ev.time || "09:00", endTime: ev.endTime || defaultEnd,
    category: ev.category, allDay: ev.allDay,
    actualTime: ev.actualTime, actualEndTime: ev.actualEndTime,
  });

  const variance = getVarianceLabel({ ...ev, time: form.time, endTime: form.endTime, actualTime: form.actualTime, actualEndTime: form.actualEndTime });

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave(ev.id, {
      title: form.title.trim(), date: form.date,
      time: form.allDay ? "" : form.time, endTime: form.allDay ? "" : form.endTime,
      category: form.category, allDay: form.allDay,
      actualTime: form.actualTime, actualEndTime: form.actualEndTime,
    });
    onClose();
  };

  return (
    <div className="lo-qa-overlay" onClick={onClose}>
      <div className="lo-qa-modal lo-card" onClick={e => e.stopPropagation()}>
        <div className="lo-qa-time">Edit event</div>
        <input
          autoFocus className="lo-qa-input" value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          onKeyDown={e => e.key === "Enter" && handleSave()}
        />
        {(ev.matterId != null || ev.taskId != null) && (
          <div style={{ marginTop: 8 }}>
            {matterName
              ? <span className={`lo-tag lo-matter-c${ev.matterId! % 8}`}>◇ {matterName}</span>
              : ev.taskId != null && <span className="lo-tag lo-tag-gray">✓ linked task</span>}
          </div>
        )}
        <div className="lo-form-row" style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
          <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          {!form.allDay && <>
            <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
            <input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
          </>}
          <label className="lo-allday-label">
            <input type="checkbox" checked={form.allDay} onChange={e => setForm(p => ({ ...p, allDay: e.target.checked }))} /> All day
          </label>
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
            {EVENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {!form.allDay && (
          <div className="lo-actual-block">
            <label className="lo-actual-label">Actual</label>
            <div className="lo-form-row" style={{ flexWrap: "wrap", gap: 8 }}>
              <input type="time" value={form.actualTime} onChange={e => setForm(p => ({ ...p, actualTime: e.target.value }))} />
              <input type="time" value={form.actualEndTime} onChange={e => setForm(p => ({ ...p, actualEndTime: e.target.value }))} />
              {(form.actualTime || form.actualEndTime) && (
                <button className="lo-clear-btn" onClick={() => setForm(p => ({ ...p, actualTime: "", actualEndTime: "" }))}>clear</button>
              )}
              {variance && <span className="lo-tag lo-tag-gray">{variance}</span>}
            </div>
          </div>
        )}

        <div className="lo-form-actions" style={{ marginTop: 14 }}>
          <button className="lo-btn lo-btn-primary" onClick={handleSave} disabled={!form.title.trim()}>Update</button>
          <button className="lo-btn lo-btn-ghost lo-btn-danger" onClick={() => { onDelete(ev.id); onClose(); }}>Delete</button>
          <button className="lo-btn lo-btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Quick add modal (click empty slot) ──────────────────── */
function QuickAddModal({ slot, onAdd, onClose }: {
  slot: { date: string; hour: number };
  onAdd: (title: string, category: string, allDay: boolean) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("work");
  const [allDay, setAllDay] = useState(false);
  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), category, allDay);
    onClose();
  };
  return (
    <div className="lo-qa-overlay" onClick={onClose}>
      <div className="lo-qa-modal lo-card" onClick={e => e.stopPropagation()}>
        <div className="lo-qa-time">
          {new Date(slot.date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" })} · {fmtHour(slot.hour)}
        </div>
        <input autoFocus className="lo-qa-input" placeholder="Event title…" value={title}
          onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} />
        <div className="lo-form-row" style={{ marginTop: 8 }}>
          <label className="lo-allday-label">
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} /> All day
          </label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {EVENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="lo-form-actions" style={{ marginTop: 12 }}>
          <button className="lo-btn lo-btn-primary" onClick={handleAdd} disabled={!title.trim()}>Add</button>
          <button className="lo-btn lo-btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Time grid (day + week) ──────────────────────────────── */
function TimeGrid({ dates, events, matters, today, onTaskDrop, onEventMove, onEventResize, onSlotClick, onDelete, onEventEdit, onToggleTrack }: {
  dates: string[]; events: Event[]; matters: Matter[]; today: string;
  onTaskDrop: (date: string, hour: number, data: DragPayload) => void;
  onEventMove: (evId: number, date: string, hour: number) => void;
  onEventResize: (evId: number, newEndTime: string) => void;
  onSlotClick: (date: string, hour: number) => void;
  onDelete: (id: number) => void;
  onEventEdit: (ev: Event) => void;
  onToggleTrack: (ev: Event) => void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ ev: Event; rect: DOMRect } | null>(null);
  const [resizingId, setResizingId] = useState<number | null>(null);
  const [resizingHeight, setResizingHeight] = useState(0);

  const resizeRef = useRef<{ evId: number; startY: number; origHeight: number; startTime: string } | null>(null);
  const resizingHeightRef = useRef(0);
  const onEventResizeRef = useRef(onEventResize);
  useEffect(() => { onEventResizeRef.current = onEventResize; }, [onEventResize]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientY - resizeRef.current.startY;
      const raw = resizeRef.current.origHeight + delta;
      const minH = HOUR_H * SNAP_MINS / 60;
      const snap = HOUR_H * SNAP_MINS / 60;
      const snapped = Math.max(minH, Math.round(raw / snap) * snap);
      resizingHeightRef.current = snapped;
      setResizingHeight(snapped);
    };
    const onUp = () => {
      // Read via ref rather than the setResizingHeight updater — calling
      // updateEvent (AppProvider's setter) from inside this component's own
      // state updater triggers React's "Cannot update a component while
      // rendering a different component" warning.
      if (!resizeRef.current) return;
      const { evId, startTime } = resizeRef.current;
      const [sh, sm] = startTime.split(":").map(Number);
      const startMins = sh * 60 + sm;
      const durationMins = Math.max(SNAP_MINS, Math.round(resizingHeightRef.current / HOUR_H * 60 / SNAP_MINS) * SNAP_MINS);
      const endMins = startMins + durationMins;
      const newEnd = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
      onEventResizeRef.current(evId, newEnd);
      resizeRef.current = null;
      resizingHeightRef.current = 0;
      setResizingId(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startResize = (e: React.MouseEvent, ev: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const curH = getEventHeight(ev);
    resizeRef.current = { evId: ev.id, startY: e.clientY, origHeight: curH, startTime: ev.time };
    resizingHeightRef.current = curH;
    setResizingId(ev.id);
    setResizingHeight(curH);
    setTooltip(null);
  };

  const matterById = (id: number | null) => id == null ? null : matters.find(m => m.id === id) ?? null;
  const timedFor = (date: string) => events.filter(e => e.date === date && !e.allDay).sort((a, b) => a.time.localeCompare(b.time));
  const allDayFor = (date: string) => events.filter(e => e.date === date && e.allDay);

  return (
    <>
      <div className="lo-tgrid">
        <div className="lo-tgrid-head">
          <div className="lo-tgrid-corner" />
          {dates.map(d => (
            <div key={d} className={`lo-tgrid-col-hd ${d === today ? "today" : ""}`}>
              <span className="lo-tgrid-dow">{new Date(d + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short" })}</span>
              <span className="lo-tgrid-daynum">{new Date(d + "T00:00:00").getDate()}</span>
            </div>
          ))}
        </div>

        <div className="lo-tgrid-allday-row">
          <div className="lo-tgrid-corner lo-tgrid-corner-sm">all day</div>
          {dates.map(d => (
            <div key={d} className="lo-tgrid-allday-col">
              {allDayFor(d).map(ev => (
                <div key={ev.id} className="lo-tgrid-allday-chip" onClick={() => onEventEdit(ev)}>
                  <span>{ev.title}</span>
                  <button onClick={e => { e.stopPropagation(); onDelete(ev.id); }}>×</button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="lo-tgrid-scroll">
          <div className="lo-tgrid-inner" style={{ height: HOURS.length * HOUR_H }}>
            <div className="lo-tgrid-axis">
              {HOURS.map(h => (
                <div key={h} className="lo-tgrid-hlbl" style={{ top: (h - START_H) * HOUR_H }}>{fmtHour(h)}</div>
              ))}
            </div>

            <div className="lo-tgrid-cols" style={{ gridTemplateColumns: `repeat(${dates.length}, 1fr)` }}>
              {dates.map(date => (
                <div key={date} className={`lo-tgrid-daycol ${date === today ? "today" : ""}`}>
                  {HOURS.map(h => {
                    const key = `${date}-${h}`;
                    return (
                      <div
                        key={h}
                        className={`lo-tgrid-slot ${dragOver === key ? "over" : ""}`}
                        style={{ top: (h - START_H) * HOUR_H, height: HOUR_H }}
                        onDragOver={e => { e.preventDefault(); setDragOver(key); }}
                        onDragLeave={() => setDragOver(p => p === key ? null : p)}
                        onDrop={e => {
                          e.preventDefault();
                          setDragOver(null);
                          const raw = e.dataTransfer.getData("application/json");
                          if (!raw) return;
                          const data: DragPayload = JSON.parse(raw);
                          if (data.kind === "existingEvent") onEventMove(data.id, date, h);
                          else onTaskDrop(date, h, data);
                        }}
                        onClick={() => onSlotClick(date, h)}
                      />
                    );
                  })}

                  {HOURS.map(h => (
                    <div key={h} className="lo-tgrid-hline" style={{ top: (h - START_H) * HOUR_H }} />
                  ))}

                  {timedFor(date).map(ev => {
                    const [hh, mm] = ev.time.split(":").map(Number);
                    const top = ((hh - START_H) + (mm || 0) / 60) * HOUR_H;
                    const h = resizingId === ev.id ? resizingHeight : getEventHeight(ev);
                    const matter = matterById(ev.matterId);
                    return (
                      <div
                        key={ev.id}
                        draggable={resizingId !== ev.id}
                        className={`lo-tgev ${tgevColor(ev)} ${resizingId === ev.id ? "resizing" : ""}`}
                        style={{ top, height: h - 4 }}
                        onDragStart={e => {
                          if (resizeRef.current) { e.preventDefault(); return; }
                          e.stopPropagation();
                          e.dataTransfer.setData("application/json", JSON.stringify({ kind: "existingEvent", id: ev.id } satisfies DragPayload));
                          e.dataTransfer.effectAllowed = "move";
                          setTooltip(null);
                        }}
                        onMouseEnter={e => {
                          if (!resizeRef.current) setTooltip({ ev, rect: e.currentTarget.getBoundingClientRect() });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={e => { e.stopPropagation(); if (!resizeRef.current) { setTooltip(null); onEventEdit(ev); } }}
                      >
                        <span className="lo-tgev-time">{ev.time}{ev.endTime ? ` – ${ev.endTime}` : ""}</span>
                        <span className="lo-tgev-title">{matter ? "◇ " : ev.taskId != null ? "✓ " : ""}{ev.title}</span>
                        <button
                          className={`lo-tgev-track ${ev.actualTime && !ev.actualEndTime ? "on" : ""}`}
                          title={!ev.actualTime ? "Start tracking actual time" : !ev.actualEndTime ? "Stop tracking" : "Restart tracking"}
                          onClick={e2 => { e2.stopPropagation(); onToggleTrack(ev); }}
                        >
                          {!ev.actualTime ? "▶" : !ev.actualEndTime ? "⏹" : "↺"}
                        </button>
                        <button className="lo-tgev-del" onClick={e2 => { e2.stopPropagation(); onDelete(ev.id); }}>×</button>
                        <div className="lo-tgev-resize" onMouseDown={e => startResize(e, ev)} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {tooltip && <EvTooltip ev={tooltip.ev} matterName={matterById(tooltip.ev.matterId)?.name ?? null} rect={tooltip.rect} />}
    </>
  );
}

/* ─── Month view ──────────────────────────────────────────── */
function MonthView({ year, month, events, today, onDayClick, onTaskDrop, onEventEdit }: {
  year: number; month: number; events: Event[]; today: string;
  onDayClick: (date: string) => void;
  onTaskDrop: (date: string, data: DragPayload) => void;
  onEventEdit: (ev: Event) => void;
}) {
  const days = getDaysInMonth(year, month);
  const offset = getFirstDay(year, month);
  const [dragOver, setDragOver] = useState<string | null>(null);

  return (
    <div className="lo-month-grid-wrap">
      <div className="lo-month-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="lo-month-dow">{d}</div>
        ))}
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const d = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dayEvs = events.filter(e => e.date === dateStr).sort((a, b) => {
            if (a.allDay && !b.allDay) return -1;
            if (!a.allDay && b.allDay) return 1;
            return a.time.localeCompare(b.time);
          });
          return (
            <div
              key={d}
              className={`lo-month-day ${dateStr === today ? "today" : ""} ${dragOver === dateStr ? "dragover" : ""}`}
              onClick={() => onDayClick(dateStr)}
              onDragOver={e => { e.preventDefault(); setDragOver(dateStr); }}
              onDragLeave={() => setDragOver(p => p === dateStr ? null : p)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(null);
                const raw = e.dataTransfer.getData("application/json");
                if (!raw) return;
                const data: DragPayload = JSON.parse(raw);
                if (data.kind === "task") onTaskDrop(dateStr, data);
              }}
            >
              <span className="lo-month-daynum">{d}</span>
              <div className="lo-month-evs">
                {dayEvs.slice(0, 3).map(ev => (
                  <div key={ev.id} className={`lo-month-ev ${mevColor(ev)}`} onClick={e2 => { e2.stopPropagation(); onEventEdit(ev); }}>
                    {ev.allDay ? ev.title : `${ev.time.slice(0, 5)} ${ev.title}`}
                  </div>
                ))}
                {dayEvs.length > 3 && <div className="lo-month-ev-more">+{dayEvs.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Calendar ───────────────────────────────────────── */
export default function Calendar() {
  const { events, addEvent, updateEvent, deleteEvent, tasks, matters, today } = useApp();
  const [view, setView] = useState<CalView>("week");
  const [curDate, setCurDate] = useState(today);
  const [quickSlot, setQuickSlot] = useState<{ date: string; hour: number } | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const now = new Date(curDate + "T00:00:00");
  const weekDates = getWeekDates(curDate);

  const navigate = (dir: -1 | 1) => {
    const d = new Date(curDate + "T00:00:00");
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurDate(toLocalDateStr(d));
  };

  const periodLabel = () => {
    if (view === "day") return now.toLocaleDateString("en-AU", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (view === "week") {
      const a = new Date(weekDates[0] + "T00:00:00").toLocaleDateString("en-AU", { month: "short", day: "numeric" });
      const b = new Date(weekDates[6] + "T00:00:00").toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" });
      return `${a} – ${b}`;
    }
    return now.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  };

  const handleTaskDrop = (date: string, hour: number, data: DragPayload) => {
    const startTime = `${String(hour).padStart(2, "0")}:00`;
    const endTime = `${String(hour + 1).padStart(2, "0")}:00`;
    addEvent({ title: data.title ?? "", date, time: startTime, endTime, allDay: false, category: "work", taskId: data.id, matterId: data.matterId ?? null, actualTime: "", actualEndTime: "" });
  };

  const handleEventMove = (evId: number, date: string, hour: number) => {
    const ev = events.find(e => e.id === evId);
    if (!ev) return;
    const startTime = `${String(hour).padStart(2, "0")}:00`;
    // preserve duration
    const [sh, sm] = ev.time.split(":").map(Number);
    const oldEnd = getEndTime(ev);
    const [eh, em] = oldEnd.split(":").map(Number);
    const dur = (eh * 60 + em) - (sh * 60 + sm);
    const newEndMins = hour * 60 + dur;
    const newEnd = `${String(Math.floor(newEndMins / 60)).padStart(2, "0")}:${String(newEndMins % 60).padStart(2, "0")}`;
    updateEvent(evId, { date, time: startTime, endTime: newEnd, allDay: false });
  };

  const handleEventResize = useCallback((evId: number, newEndTime: string) => {
    updateEvent(evId, { endTime: newEndTime });
  }, [updateEvent]);

  const handleMonthTaskDrop = (date: string, data: DragPayload) => {
    addEvent({ title: data.title ?? "", date, time: "09:00", endTime: "10:00", allDay: false, category: "work", taskId: data.id, matterId: data.matterId ?? null, actualTime: "", actualEndTime: "" });
  };

  const handleQuickAdd = (title: string, category: string, allDay: boolean) => {
    if (!quickSlot) return;
    const startTime = `${String(quickSlot.hour).padStart(2, "0")}:00`;
    const endTime = `${String(quickSlot.hour + 1).padStart(2, "0")}:00`;
    addEvent({ title, date: quickSlot.date, time: allDay ? "" : startTime, endTime: allDay ? "" : endTime, allDay, category, taskId: null, matterId: null, actualTime: "", actualEndTime: "" });
  };

  const handleToggleTrack = (ev: Event) => {
    if (!ev.actualTime || ev.actualEndTime) {
      // Not started yet, or a previous tracking cycle finished — (re)start.
      updateEvent(ev.id, { actualTime: toLocalTimeStr(new Date()), actualEndTime: "" });
    } else {
      updateEvent(ev.id, { actualEndTime: toLocalTimeStr(new Date()) });
    }
  };

  return (
    <div className="lo-calendar-page lo-cal-fullpage">
      <div className="lo-cal-topbar">
        <div className="lo-cal-topbar-left">
          <h1 className="lo-cal-title">Calendar</h1>
          <span className="lo-period-label">{periodLabel()}</span>
        </div>
        <div className="lo-cal-topbar-right">
          <div className="lo-view-tabs">
            {(["day", "week", "month"] as CalView[]).map(v => (
              <button key={v} className={`lo-view-tab ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <div className="lo-cal-nav">
            <button className="lo-icon-btn" onClick={() => navigate(-1)}>‹</button>
            <button className="lo-btn lo-btn-ghost lo-btn-sm" onClick={() => setCurDate(today)}>Today</button>
            <button className="lo-icon-btn" onClick={() => navigate(1)}>›</button>
          </div>
        </div>
      </div>

      <div className="lo-cal-body">
        {view !== "month" && <TaskPanel tasks={tasks} matters={matters} />}
        <div className="lo-cal-content">
          {view === "month" && (
            <MonthView
              year={now.getFullYear()} month={now.getMonth()}
              events={events} today={today}
              onDayClick={date => { setCurDate(date); setView("day"); }}
              onTaskDrop={handleMonthTaskDrop}
              onEventEdit={setEditingEvent}
            />
          )}
          {view === "week" && (
            <TimeGrid
              dates={weekDates} events={events} matters={matters} today={today}
              onTaskDrop={handleTaskDrop} onEventMove={handleEventMove}
              onEventResize={handleEventResize}
              onSlotClick={(date, hour) => setQuickSlot({ date, hour })}
              onDelete={deleteEvent} onEventEdit={setEditingEvent}
              onToggleTrack={handleToggleTrack}
            />
          )}
          {view === "day" && (
            <TimeGrid
              dates={[curDate]} events={events} matters={matters} today={today}
              onTaskDrop={handleTaskDrop} onEventMove={handleEventMove}
              onEventResize={handleEventResize}
              onSlotClick={(date, hour) => setQuickSlot({ date, hour })}
              onDelete={deleteEvent} onEventEdit={setEditingEvent}
              onToggleTrack={handleToggleTrack}
            />
          )}
        </div>
      </div>

      {quickSlot && (
        <QuickAddModal slot={quickSlot} onAdd={handleQuickAdd} onClose={() => setQuickSlot(null)} />
      )}
      {editingEvent && (
        <EventEditModal
          ev={editingEvent}
          matterName={editingEvent.matterId != null ? matters.find(m => m.id === editingEvent.matterId)?.name ?? null : null}
          onSave={(id, updates) => updateEvent(id, updates)}
          onDelete={deleteEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}
