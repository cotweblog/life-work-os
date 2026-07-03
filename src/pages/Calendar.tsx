import { useState } from "react";
import { useApp } from "@/context/AppContext";

const CATEGORIES = ["work", "personal", "health", "social", "other"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDay(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function Calendar() {
  const { events, addEvent, deleteEvent, today } = useApp();
  const now = new Date();
  const [curYear, setCurYear] = useState(now.getFullYear());
  const [curMonth, setCurMonth] = useState(now.getMonth());
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
    addEvent({ ...form, time: form.allDay ? "" : form.time });
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
    </div>
  );
}
