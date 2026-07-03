import { useState } from "react";
import { useApp } from "@/context/AppContext";
import type { Habit } from "@/context/AppContext";

const EMOJIS = ["🚶","💧","📖","🧘","🏋️","🥗","😴","📵","✍️","🎯","🌿","💊","🧹","🎵","🏃"];

function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().split("T")[0];
  });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" });
}

const TRACKER_DAYS = 28;

function HabitHistoryEditor({ habit, onClose }: {
  habit: Habit;
  onClose: () => void;
}) {
  const { toggleHabitDate, setHabitNote, today } = useApp();
  const [noteDate, setNoteDate] = useState(today);
  const [noteDraft, setNoteDraft] = useState(habit.notes[today] ?? "");
  const months: Record<string, string[]> = {};
  const allDays = getLastNDays(90);

  allDays.forEach(d => {
    const month = d.slice(0, 7);
    if (!months[month]) months[month] = [];
    months[month].push(d);
  });

  const monthKeys = Object.keys(months).sort().reverse();
  const sortedNotes = Object.entries(habit.notes).sort((a, b) => b[0].localeCompare(a[0]));

  const selectNoteDate = (d: string) => {
    setNoteDate(d);
    setNoteDraft(habit.notes[d] ?? "");
  };

  return (
    <>
      <div className="lo-detail-backdrop" onClick={onClose} />
      <div className="lo-history-editor-panel">
        <div className="lo-detail-header">
          <span style={{ fontSize: 22 }}>{habit.emoji}</span>
          <span className="lo-detail-title-input" style={{ fontWeight: 600, fontSize: 16 }}>{habit.name}</span>
          <button className="lo-delete-btn" onClick={onClose} style={{ fontSize: 20 }}>×</button>
        </div>

        <div className="lo-history-editor-hint">
          Click any day to toggle completion. Editing the last 90 days.
        </div>

        <div className="lo-detail-section">
          <div className="lo-detail-section-header"><span>Log entry</span></div>
          <div className="lo-habit-log-form">
            <input type="date" value={noteDate} max={today} onChange={e => selectNoteDate(e.target.value)} />
            <textarea
              className="lo-detail-notes"
              placeholder="How did it go? Any details worth remembering..."
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              rows={2}
            />
            <button className="lo-btn lo-btn-primary lo-btn-sm" onClick={() => setHabitNote(habit.id, noteDate, noteDraft)}>
              Save entry
            </button>
          </div>

          {sortedNotes.length > 0 && (
            <div className="lo-habit-log-list">
              {sortedNotes.map(([date, note]) => (
                <div key={date} className="lo-habit-log-entry">
                  <div className="lo-habit-log-entry-header">
                    <span className="lo-habit-log-date">{formatDateLabel(date)}</span>
                    <button
                      className="lo-delete-btn lo-delete-btn-sm"
                      onClick={() => setHabitNote(habit.id, date, "")}
                      title="Delete entry"
                    >×</button>
                  </div>
                  <textarea
                    className="lo-detail-notes"
                    value={note}
                    onChange={e => setHabitNote(habit.id, date, e.target.value)}
                    rows={2}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lo-history-editor-scroll">
          {monthKeys.map(monthKey => {
            const days = months[monthKey];
            const monthLabel = new Date(monthKey + "-01T00:00:00").toLocaleDateString("en", { month: "long", year: "numeric" });
            const firstDayOfWeek = new Date(days[0] + "T00:00:00").getDay();

            return (
              <div key={monthKey} className="lo-history-month">
                <div className="lo-history-month-label">{monthLabel}</div>
                <div className="lo-history-week-header">
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                    <div key={d} className="lo-history-weekday">{d}</div>
                  ))}
                </div>
                <div className="lo-history-cal-grid">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="lo-history-cal-empty" />
                  ))}
                  {days.map(d => {
                    const done = habit.completedDates.includes(d);
                    const isToday = d === today;
                    const isFuture = d > today;
                    const hasNote = Boolean(habit.notes[d]);
                    return (
                      <button
                        key={d}
                        className={`lo-history-cal-day ${done ? "done" : ""} ${isToday ? "today" : ""} ${isFuture ? "future" : ""}`}
                        onClick={() => { if (!isFuture) { toggleHabitDate(habit.id, d); selectNoteDate(d); } }}
                        disabled={isFuture}
                        title={formatDateLabel(d) + (done ? " ✓" : "") + (hasNote ? " — has log entry" : "")}
                      >
                        {new Date(d + "T00:00:00").getDate()}
                        {hasNote && <span className="lo-history-cal-note-dot" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="lo-detail-footer">
          <div className="lo-history-editor-legend">
            <span className="lo-legend-dot done" /> Completed
            <span className="lo-legend-dot" style={{ marginLeft: 12 }} /> Not done
          </div>
          <button className="lo-btn lo-btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  );
}

export default function Habits() {
  const { habits, addHabit, toggleHabitDate, deleteHabit, today } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", emoji: "🚶", frequency: "daily" });
  const last28 = getLastNDays(TRACKER_DAYS);
  const last7 = getLastNDays(7);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    addHabit(form);
    setForm({ name: "", emoji: "🚶", frequency: "daily" });
    setShowForm(false);
  };

  const streak = (habit: Habit) => {
    let s = 0;
    const d = new Date();
    while (true) {
      const dateStr = d.toISOString().split("T")[0];
      if (habit.completedDates.includes(dateStr)) {
        s++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return s;
  };

  const completedToday = habits.filter(h => h.completedDates.includes(today)).length;
  const editingHabit = habits.find(h => h.id === editingHabitId) ?? null;

  return (
    <div className="lo-habits-page">
      {editingHabit && (
        <HabitHistoryEditor
          habit={editingHabit}
          onClose={() => setEditingHabitId(null)}
        />
      )}

      <div className="lo-page-header">
        <h1>Habits</h1>
        <p>{completedToday} of {habits.length} done today</p>
      </div>

      <div className="lo-habits-toolbar">
        <div className="lo-habit-progress-bar">
          <div className="lo-habit-progress-fill" style={{ width: habits.length ? `${(completedToday / habits.length) * 100}%` : "0%" }} />
        </div>
        <button className="lo-btn lo-btn-primary" onClick={() => setShowForm(true)}>+ Add habit</button>
      </div>

      {showForm && (
        <div className="lo-card lo-add-form">
          <input type="text" placeholder="Habit name..." value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
          <div className="lo-emoji-picker">
            {EMOJIS.map(e => (
              <button key={e} className={`lo-emoji-btn ${form.emoji === e ? "active" : ""}`} onClick={() => setForm(p => ({ ...p, emoji: e }))}>{e}</button>
            ))}
          </div>
          <div className="lo-form-actions">
            <button className="lo-btn lo-btn-primary" onClick={handleAdd}>Add habit</button>
            <button className="lo-btn lo-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="lo-habits-grid-header">
        <div className="lo-habit-col-label">Habit</div>
        <div className="lo-days-header">
          {last7.map(d => (
            <div key={d} className={`lo-day-label ${d === today ? "today" : ""}`}>
              {new Date(d + "T00:00:00").toLocaleDateString("en", { weekday: "narrow" })}
            </div>
          ))}
        </div>
        <div className="lo-streak-label">streak</div>
      </div>

      {habits.length === 0 && <div className="lo-empty-state"><div className="lo-icon">◎</div>No habits yet — add one above</div>}

      {habits.map(habit => (
        <div key={habit.id} className="lo-habit-row lo-card">
          <div className="lo-habit-info">
            <button
              className={`lo-habit-today-btn ${habit.completedDates.includes(today) ? "done" : ""}`}
              onClick={() => toggleHabitDate(habit.id, today)}
            >
              {habit.completedDates.includes(today) ? "✓" : habit.emoji}
            </button>
            <span className="lo-habit-name">{habit.name}</span>
          </div>

          <div className="lo-habit-history">
            {last7.map(d => {
              const done = habit.completedDates.includes(d);
              const isToday = d === today;
              return (
                <button
                  key={d}
                  className={`lo-history-dot lo-history-dot-btn ${done ? "done" : ""} ${isToday ? "today" : ""}`}
                  onClick={() => toggleHabitDate(habit.id, d)}
                  title={formatDateLabel(d) + (done ? " — completed" : " — not done")}
                />
              );
            })}
          </div>

          <div className="lo-habit-streak">
            <span className={`lo-streak-val ${streak(habit) >= 3 ? "hot" : ""}`}>{streak(habit)}</span>
            <button
              className="lo-history-edit-btn"
              onClick={() => setEditingHabitId(habit.id)}
              title="Edit history"
            >
              ✎
            </button>
            <button className="lo-delete-btn" onClick={() => deleteHabit(habit.id)}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}
