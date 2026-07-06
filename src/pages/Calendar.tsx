import { useState, useRef, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import type { Event } from "@/context/AppContext";
import { toLocalDateStr } from "@/lib/utils";

const CATEGORIES = ["work", "personal", "health", "social", "other"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDay(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/* ─── Week view helpers ─────────────────────────────────────── */
const HOUR_HEIGHT = 48;
const SNAP_MINUTES = 15;
const VIEW_START_HOUR = 8;
const VIEW_END_HOUR = 22;
const VIEW_MINUTES = (VIEW_END_HOUR - VIEW_START_HOUR) * 60;

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return toLocalDateStr(d);
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toLocalDateStr(d);
}
function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function snapMinutes(mins: number): number {
  return Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES;
}
function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

interface DragPayload {
  kind: "task" | "existingEvent";
  id: number;
  title?: string;
  matterId?: number | null;
}

function WeekView({ weekStart, setWeekStart, today }: {
  weekStart: string;
  setWeekStart: (d: string) => void;
  today: string;
}) {
  const { events, tasks, matters, addEvent, updateEvent, deleteEvent } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [resizeState, setResizeState] = useState<{ id: number; startY: number; startDuration: number; liveDuration: number } | null>(null);
  const resizeStateRef = useRef(resizeState);
  resizeStateRef.current = resizeState;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = `${new Date(weekDays[0] + "T00:00:00").toLocaleDateString("en-AU", { month: "short", day: "numeric" })} – ${new Date(weekDays[6] + "T00:00:00").toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })}`;

  useEffect(() => {
    if (!resizeState) return;
    const { startY, startDuration } = resizeState;
    const onMove = (e: MouseEvent) => {
      const deltaMinutes = ((e.clientY - startY) / HOUR_HEIGHT) * 60;
      const liveDuration = Math.max(15, snapMinutes(startDuration + deltaMinutes));
      setResizeState(s => s ? { ...s, liveDuration } : s);
    };
    const onUp = () => {
      // Read via ref rather than the setResizeState updater — calling another
      // component's setter (updateEvent -> AppProvider's setEvents) from
      // inside this component's state updater triggers React's "Cannot
      // update a component while rendering a different component" warning.
      const current = resizeStateRef.current;
      if (current) updateEvent(current.id, { durationMinutes: current.liveDuration });
      setResizeState(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizeState?.id, resizeState?.startY, resizeState?.startDuration]);

  const startResize = (e: React.MouseEvent, event: Event) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeState({ id: event.id, startY: e.clientY, startDuration: event.durationMinutes, liveDuration: event.durationMinutes });
  };

  const computeDropMinutes = (e: React.DragEvent<HTMLDivElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetMinutes = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
    const clamped = Math.max(0, Math.min(VIEW_MINUTES - SNAP_MINUTES, offsetMinutes));
    return VIEW_START_HOUR * 60 + snapMinutes(clamped);
  };

  const handleDrop = (day: string, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const data: DragPayload = JSON.parse(raw);
    const time = minutesToTime(computeDropMinutes(e));

    if (data.kind === "existingEvent") {
      updateEvent(data.id, { date: day, time });
    } else if (data.kind === "task") {
      addEvent({
        title: data.title ?? "", date: day, time, allDay: false, category: "work",
        durationMinutes: 60, taskId: data.id, matterId: data.matterId ?? null,
      });
    }
  };

  const openTasks = tasks.filter(t => !t.done);
  const matterById = (id: number | null) => id == null ? null : matters.find(m => m.id === id) ?? null;
  const hours = Array.from({ length: VIEW_END_HOUR - VIEW_START_HOUR }, (_, i) => i + VIEW_START_HOUR);

  return (
    <div className="lo-week-layout">
      <div className="lo-card lo-week-card">
        <div className="lo-cal-header">
          <button className="lo-icon-btn" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
          <span className="lo-month-label">{weekLabel}</span>
          <button className="lo-icon-btn" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
          <button className="lo-btn lo-btn-ghost lo-btn-sm" style={{ marginLeft: 8 }} onClick={() => setWeekStart(getWeekStart(today))}>This week</button>
        </div>

        <div className="lo-week-header-row">
          <div className="lo-week-hours-col-spacer" />
          {weekDays.map(day => (
            <div key={day} className={`lo-week-day-header ${day === today ? "today" : ""}`}>
              <div className="lo-week-day-name">{new Date(day + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short" })}</div>
              <div className="lo-week-day-num">{new Date(day + "T00:00:00").getDate()}</div>
              {events.filter(e => e.date === day && e.allDay).map(e => (
                <div key={e.id} className="lo-tag lo-tag-gray lo-week-allday-tag">{e.title}</div>
              ))}
            </div>
          ))}
        </div>

        <div className="lo-week-grid-scroll" ref={scrollRef}>
          <div className="lo-week-grid" style={{ height: (VIEW_END_HOUR - VIEW_START_HOUR) * HOUR_HEIGHT }}>
            <div className="lo-week-hours-col">
              {hours.map(h => (
                <div key={h} className="lo-week-hour-label" style={{ height: HOUR_HEIGHT }}>{formatHour(h)}</div>
              ))}
            </div>
            {weekDays.map(day => (
              <div
                key={day}
                className={`lo-week-day-col ${day === today ? "today" : ""}`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(day, e)}
              >
                {hours.map(h => <div key={h} className="lo-week-hour-cell" style={{ height: HOUR_HEIGHT }} />)}
                {events.filter(e => e.date === day && !e.allDay).map(event => {
                  const liveDuration = resizeState?.id === event.id ? resizeState.liveDuration : event.durationMinutes;
                  const matter = matterById(event.matterId);
                  const colorClass = event.matterId != null ? `lo-matter-c${event.matterId % 8}` : event.taskId ? "task" : "";
                  const tooltip = [
                    event.title,
                    matter ? `Matter: ${matter.name}` : null,
                    `${event.time} · ${liveDuration} min`,
                  ].filter(Boolean).join("\n");
                  return (
                    <div
                      key={event.id}
                      className={`lo-week-event-block ${colorClass}`}
                      draggable
                      onDragStart={e => e.dataTransfer.setData("application/json", JSON.stringify({ kind: "existingEvent", id: event.id } satisfies DragPayload))}
                      style={{
                        top: ((timeToMinutes(event.time) / 60) - VIEW_START_HOUR) * HOUR_HEIGHT,
                        height: Math.max(18, (liveDuration / 60) * HOUR_HEIGHT),
                      }}
                      title={tooltip}
                    >
                      <span className="lo-week-event-title">
                        {event.matterId ? "◇ " : event.taskId ? "✓ " : ""}{event.title}
                      </span>
                      <button className="lo-week-event-delete" onClick={() => deleteEvent(event.id)}>×</button>
                      <div className="lo-week-event-resize-handle" draggable={false} onMouseDown={e => startResize(e, event)} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lo-card lo-timeblock-sidebar">
        <h3>Drag to schedule</h3>
        <div className="lo-timeblock-source-label">Tasks</div>
        <div className="lo-timeblock-source-list">
          {openTasks.length === 0 && <p className="lo-matter-empty-actions">No open tasks</p>}
          {openTasks.map(t => {
            const matter = matterById(t.matterId);
            return (
              <div
                key={t.id}
                className="lo-timeblock-source-item"
                draggable
                onDragStart={e => e.dataTransfer.setData("application/json", JSON.stringify({ kind: "task", id: t.id, title: t.text, matterId: t.matterId } satisfies DragPayload))}
              >
                <span>{t.text}</span>
                {matter && (
                  <span className={`lo-tag lo-matter-c${matter.id % 8}`}>◇ {matter.name}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Calendar page ─────────────────────────────────────────── */
export default function Calendar() {
  const { events, addEvent, deleteEvent, today } = useApp();
  const now = new Date();
  const [view, setView] = useState<"month" | "week">("month");
  const [curYear, setCurYear] = useState(now.getFullYear());
  const [curMonth, setCurMonth] = useState(now.getMonth());
  const [weekStart, setWeekStart] = useState(getWeekStart(today));
  const [selected, setSelected] = useState(today);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", date: today, time: "09:00", allDay: false, category: "work" });

  const days = getDaysInMonth(curYear, curMonth);
  const firstDay = getFirstDay(curYear, curMonth);
  const monthName = new Date(curYear, curMonth).toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  const selectedEvents = events
    .filter(e => e.date === selected)
    .sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.time.localeCompare(b.time);
    });

  const handleAdd = () => {
    if (!form.title.trim()) return;
    addEvent({ ...form, time: form.allDay ? "" : form.time, durationMinutes: 60, taskId: null, matterId: null });
    setForm({ title: "", date: selected, time: "09:00", allDay: false, category: "work" });
    setShowForm(false);
  };

  const prevMonth = () => {
    if (curMonth === 0) { setCurMonth(11); setCurYear(y => y - 1); } else setCurMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (curMonth === 11) { setCurMonth(0); setCurYear(y => y + 1); } else setCurMonth(m => m + 1);
  };

  return (
    <div className="lo-calendar-page">
      <div className="lo-page-header">
        <h1>Calendar</h1>
        <p>{events.length} events total</p>
      </div>

      <div className="lo-filter-tabs" style={{ marginBottom: 16, width: "fit-content" }}>
        <button className={`lo-filter-tab ${view === "month" ? "active" : ""}`} onClick={() => setView("month")}>Month</button>
        <button className={`lo-filter-tab ${view === "week" ? "active" : ""}`} onClick={() => setView("week")}>Week</button>
      </div>

      {view === "week" ? (
        <WeekView weekStart={weekStart} setWeekStart={setWeekStart} today={today} />
      ) : (
        <div className="lo-calendar-layout">
          <div className="lo-card lo-cal-card">
            <div className="lo-cal-header">
              <button className="lo-icon-btn" onClick={prevMonth}>‹</button>
              <span className="lo-month-label">{monthName}</span>
              <button className="lo-icon-btn" onClick={nextMonth}>›</button>
            </div>

            <div className="lo-cal-grid">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                <div key={d} className="lo-cal-dow">{d}</div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: days }).map((_, i) => {
                const d = i + 1;
                const dateStr = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const hasEvents = events.some(e => e.date === dateStr);
                const isToday = dateStr === today;
                const isSelected = dateStr === selected;
                return (
                  <button
                    key={d}
                    className={`lo-cal-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelected(dateStr)}
                  >
                    {d}
                    {hasEvents && <span className="lo-event-dot" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lo-day-panel">
            <div className="lo-day-panel-header">
              <h2>{new Date(selected + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", month: "long", day: "numeric" })}</h2>
              <button className="lo-btn lo-btn-primary" onClick={() => { setForm(p => ({ ...p, date: selected })); setShowForm(true); }}>+ Event</button>
            </div>

            {showForm && (
              <div className="lo-card lo-add-form" style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Event title..."
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleAdd()}
                  autoFocus
                />
                <div className="lo-form-row">
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                  <label className="lo-allday-label">
                    <input
                      type="checkbox"
                      checked={form.allDay}
                      onChange={e => setForm(p => ({ ...p, allDay: e.target.checked }))}
                    />
                    All day
                  </label>
                  {!form.allDay && (
                    <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
                  )}
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="lo-form-actions">
                  <button className="lo-btn lo-btn-primary" onClick={handleAdd}>Add</button>
                  <button className="lo-btn lo-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </div>
            )}

            {selectedEvents.length === 0 ? (
              <div className="lo-empty-state"><div className="lo-icon">⊡</div>No events — click + to add one</div>
            ) : (
              <div className="lo-event-list">
                {selectedEvents.map(e => (
                  <div key={e.id} className="lo-event-item lo-card">
                    <div className={`lo-event-time-badge ${e.allDay ? "lo-allday-badge" : ""}`}>
                      {e.allDay ? "All day" : e.time}
                    </div>
                    <div className="lo-event-info">
                      <span className="lo-event-name">{e.title}</span>
                      <span className={`lo-tag lo-tag-${e.category === "work" ? "yellow" : e.category === "health" ? "green" : "gray"}`}>{e.category}</span>
                    </div>
                    <button className="lo-delete-btn" onClick={() => deleteEvent(e.id)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
