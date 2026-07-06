import { useState } from "react";
import { useApp, ALL_TASK_CATEGORIES } from "@/context/AppContext";
import type { Task } from "@/context/AppContext";

interface DashboardProps {
  setActiveView: (view: string) => void;
}

const PROCESS_CATS = ALL_TASK_CATEGORIES.filter(c => c !== "inbox");

/* ─── Tasks to be processed (Inbox) ──────────────────────── */
function InboxCard({ tasks, onProcess, onComplete, onDelete }: {
  tasks: Task[];
  onProcess: (id: number, category: string) => void;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="lo-card lo-inbox-card">
      <div className="lo-section-header">
        <h2>
          Tasks to be processed
          {tasks.length > 0 && <span className="lo-inbox-badge">{tasks.length}</span>}
        </h2>
        <span className="lo-inbox-hint">Assign a category to file away</span>
      </div>
      {tasks.length === 0 ? (
        <div className="lo-inbox-empty">
          <span className="lo-inbox-empty-icon">✓</span>
          <span>Inbox clear — capture tasks above</span>
        </div>
      ) : (
        <div className="lo-inbox-list">
          {tasks.map(t => (
            <div key={t.id} className="lo-inbox-row">
              <button className="lo-check-btn" onClick={() => onComplete(t.id)} title="Complete" />
              <span className="lo-inbox-text">{t.text}</span>
              {t.urgent && <span className="lo-urgent-badge" title="Urgent">⚡</span>}
              <select
                className="lo-inbox-cat-select"
                value=""
                onChange={e => { if (e.target.value) onProcess(t.id, e.target.value); }}
              >
                <option value="" disabled>Move to…</option>
                {PROCESS_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="lo-inbox-del" onClick={() => onDelete(t.id)} title="Delete">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Compact Eisenhower Matrix ───────────────────────────── */
function EisenhowerMatrix({ tasks, today, setActiveView }: {
  tasks: Task[];
  today: string;
  setActiveView: (v: string) => void;
}) {
  const open = tasks.filter(t => !t.done && t.category !== "inbox");
  const isUrgent = (t: Task) => t.urgent || (!t.done && !!t.due && t.due <= today);
  const isImportant = (t: Task) => t.priority === "high";

  const quadrants = [
    { label: "Do First",   sub: "Urgent · Important",         tasks: open.filter(t => isUrgent(t) && isImportant(t)),  cls: "lo-mq-q1" },
    { label: "Schedule",   sub: "Not Urgent · Important",     tasks: open.filter(t => !isUrgent(t) && isImportant(t)), cls: "lo-mq-q2" },
    { label: "Delegate",   sub: "Urgent · Not Important",     tasks: open.filter(t => isUrgent(t) && !isImportant(t)), cls: "lo-mq-q3" },
    { label: "Eliminate",  sub: "Not Urgent · Not Important", tasks: open.filter(t => !isUrgent(t) && !isImportant(t)), cls: "lo-mq-q4" },
  ];

  return (
    <div className="lo-card lo-dash-matrix">
      <div className="lo-section-header">
        <h2>Priority matrix</h2>
        <button className="lo-link-btn" onClick={() => setActiveView("tasks")}>All tasks →</button>
      </div>
      <div className="lo-dash-matrix-grid">
        {quadrants.map(q => (
          <div key={q.label} className={`lo-dash-mq ${q.cls}`}>
            <div className="lo-dash-mq-hd">
              <span className="lo-dash-mq-label">{q.label}</span>
              <span className="lo-dash-mq-sub">{q.sub}</span>
            </div>
            <div className="lo-dash-mq-body">
              {q.tasks.length === 0 && <span className="lo-dash-mq-empty">None</span>}
              {q.tasks.slice(0, 5).map(t => (
                <div key={t.id} className="lo-dash-mq-task" onClick={() => setActiveView("tasks")}>
                  <span className="lo-dash-mq-dot" />
                  <span className="lo-dash-mq-text">{t.text}</span>
                  {t.urgent && <span className="lo-dash-mq-urgent">⚡</span>}
                </div>
              ))}
              {q.tasks.length > 5 && <span className="lo-dash-mq-more">+{q.tasks.length - 5} more</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Dashboard ──────────────────────────────────────── */
export default function Dashboard({ setActiveView }: DashboardProps) {
  const { tasks, events, habits, matters, addTask, addMatter, updateTask, toggleTask, deleteTask, today } = useApp();

  const inboxTasks = tasks.filter(t => t.category === "inbox" && !t.done);
  const todayTasks = tasks.filter(t => t.due === today && !t.done && t.category !== "inbox");
  const overdue    = tasks.filter(t => t.due && t.due < today && !t.done && t.category !== "inbox");
  const todayEvents = events.filter(e => e.date === today).sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return a.time.localeCompare(b.time);
  });
  const habitsToday = habits.filter(h => h.completedDates.includes(today));
  const habitPct = habits.length ? Math.round((habitsToday.length / habits.length) * 100) : 0;
  const openMatters = matters.filter(m => m.status === "open");
  const waitingActions = matters.flatMap(m => m.actions).filter(a => a.status === "waiting");

  const [quickTask, setQuickTask] = useState("");
  const [quickMatter, setQuickMatter] = useState("");

  const handleQuickTask = async () => {
    if (!quickTask.trim()) return;
    await addTask({ text: quickTask.trim(), priority: "medium", due: "", category: "inbox", matterId: null, urgent: false });
    setQuickTask("");
  };
  const handleQuickMatter = async () => {
    if (!quickMatter.trim()) return;
    await addMatter({ name: quickMatter.trim(), description: "", status: "open", openedDate: today, notes: "" });
    setQuickMatter("");
  };

  return (
    <div className="lo-dashboard">
      <div className="lo-page-header">
        <h1>Overview</h1>
        <p>{new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* Stats */}
      <div className="lo-stats-row">
        <div className="lo-stat-card" onClick={() => setActiveView("tasks")}>
          <div className="lo-stat-value">{todayTasks.length}</div>
          <div className="lo-stat-label">Due today</div>
          {overdue.length > 0 && <div className="lo-stat-badge-danger">{overdue.length} overdue</div>}
        </div>
        <div className="lo-stat-card" onClick={() => setActiveView("calendar")}>
          <div className="lo-stat-value">{todayEvents.length}</div>
          <div className="lo-stat-label">Events today</div>
        </div>
        <div className="lo-stat-card" onClick={() => setActiveView("matters")}>
          <div className="lo-stat-value">{openMatters.length}</div>
          <div className="lo-stat-label">Open matters</div>
          {waitingActions.length > 0 && <div className="lo-stat-badge-warn">{waitingActions.length} waiting</div>}
        </div>
        <div className="lo-stat-card" onClick={() => setActiveView("habits")}>
          <div className="lo-stat-value">{habitPct}%</div>
          <div className="lo-stat-label">Habits done</div>
          <div className="lo-habit-bar"><div className="lo-habit-bar-fill" style={{ width: `${habitPct}%` }} /></div>
        </div>
        <div className="lo-stat-card lo-ai-card" onClick={() => setActiveView("ai")}>
          <div className="lo-stat-icon">◈</div>
          <div className="lo-stat-label">Ask AI what to do next</div>
        </div>
      </div>

      {/* Quick capture */}
      <div className="lo-quick-capture lo-card">
        <div className="lo-quick-capture-row">
          <span className="lo-quick-icon">✓</span>
          <input
            className="lo-quick-input"
            placeholder="Capture a task… (goes to inbox)"
            value={quickTask}
            onChange={e => setQuickTask(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleQuickTask()}
          />
          <button className="lo-btn lo-btn-primary lo-btn-sm" onClick={handleQuickTask} disabled={!quickTask.trim()}>Capture</button>
        </div>
        <div className="lo-quick-capture-row">
          <span className="lo-quick-icon">◇</span>
          <input
            className="lo-quick-input"
            placeholder="Open a new matter…"
            value={quickMatter}
            onChange={e => setQuickMatter(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleQuickMatter()}
          />
          <button className="lo-btn lo-btn-ghost lo-btn-sm" onClick={handleQuickMatter} disabled={!quickMatter.trim()}>Add matter</button>
        </div>
      </div>

      {/* Inbox */}
      <InboxCard
        tasks={inboxTasks}
        onProcess={(id, category) => updateTask(id, { category })}
        onComplete={id => toggleTask(id)}
        onDelete={id => deleteTask(id)}
      />

      {/* Priority matrix */}
      <EisenhowerMatrix tasks={tasks} today={today} setActiveView={setActiveView} />

      {/* Grid */}
      <div className="lo-dashboard-grid">
        <div className="lo-card">
          <div className="lo-section-header">
            <h2>Today's focus</h2>
            <button className="lo-link-btn" onClick={() => setActiveView("tasks")}>All tasks →</button>
          </div>
          {todayTasks.length === 0 && overdue.length === 0 ? (
            <div className="lo-empty-state"><div className="lo-icon">✓</div>Nothing due today</div>
          ) : (
            <ul className="lo-task-preview-list">
              {overdue.map(t => (
                <li key={t.id} className="lo-task-preview lo-overdue">
                  <span className="lo-task-dot" /><span>{t.text}</span>
                  <span className="lo-tag lo-tag-red">overdue</span>
                </li>
              ))}
              {todayTasks.slice(0, 5).map(t => (
                <li key={t.id} className="lo-task-preview">
                  <span className="lo-task-dot" /><span>{t.text}</span>
                  <span className={`lo-tag lo-tag-${t.priority === "high" ? "red" : t.priority === "medium" ? "yellow" : "gray"}`}>{t.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lo-card">
          <div className="lo-section-header">
            <h2>Today's schedule</h2>
            <button className="lo-link-btn" onClick={() => setActiveView("calendar")}>Full calendar →</button>
          </div>
          {todayEvents.length === 0 ? (
            <div className="lo-empty-state"><div className="lo-icon">⊡</div>No events today</div>
          ) : (
            <ul className="lo-event-preview-list">
              {todayEvents.map(e => (
                <li key={e.id} className="lo-event-preview">
                  <span className="lo-event-time">{e.allDay ? "All day" : e.time}</span>
                  <span className="lo-event-title">{e.title}</span>
                  <span className={`lo-tag lo-tag-${e.category === "work" ? "yellow" : e.category === "health" ? "green" : "gray"}`}>{e.category}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lo-card">
          <div className="lo-section-header">
            <h2>Open matters</h2>
            <button className="lo-link-btn" onClick={() => setActiveView("matters")}>All matters →</button>
          </div>
          {openMatters.length === 0 ? (
            <div className="lo-empty-state"><div className="lo-icon">◇</div>No open matters</div>
          ) : (
            <ul className="lo-task-preview-list">
              {openMatters.slice(0, 5).map(m => {
                const waiting = m.actions.filter(a => a.status === "waiting").length;
                return (
                  <li key={m.id} className="lo-task-preview">
                    <span className="lo-task-dot" /><span>{m.name}</span>
                    {waiting > 0 && <span className="lo-tag lo-tag-yellow">{waiting} waiting</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="lo-card">
          <div className="lo-section-header">
            <h2>Habits today</h2>
            <button className="lo-link-btn" onClick={() => setActiveView("habits")}>Manage →</button>
          </div>
          {habits.length === 0 ? (
            <div className="lo-empty-state"><div className="lo-icon">◎</div>No habits set up</div>
          ) : (
            <div className="lo-habits-preview">
              {habits.map(h => (
                <div key={h.id} className={`lo-habit-chip ${h.completedDates.includes(today) ? "done" : ""}`}>
                  <span>{h.emoji}</span><span>{h.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
