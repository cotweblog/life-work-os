import { useApp, WORK_CATEGORIES, PERSONAL_CATEGORIES } from "@/context/AppContext";

interface DashboardProps {
  setActiveView: (view: string) => void;
}

export default function Dashboard({ setActiveView }: DashboardProps) {
  const { viewMode, tasks, events, habits, matters, today } = useApp();

  const isWork = viewMode === "work";
  const workCats = new Set<string>(WORK_CATEGORIES);
  const personalCats = new Set<string>(PERSONAL_CATEGORIES);

  const modeTasks = tasks.filter(t => isWork ? workCats.has(t.category) : personalCats.has(t.category));

  const todayTasks = modeTasks.filter(t => t.due === today && !t.done);
  const overdue = modeTasks.filter(t => t.due && t.due < today && !t.done);
  const todayEvents = events.filter(e => e.date === today).sort((a, b) => a.time.localeCompare(b.time));

  const habitsToday = habits.filter(h => h.completedDates.includes(today));
  const habitPct = habits.length ? Math.round((habitsToday.length / habits.length) * 100) : 0;

  const openMatters = matters.filter(m => m.status === "open");
  const waitingActions = matters.flatMap(m => m.actions).filter(a => a.status === "waiting");

  const priorityTask = modeTasks.filter(t => !t.done).sort((a, b) => {
    const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (p[a.priority] ?? 3) - (p[b.priority] ?? 3);
  })[0];

  return (
    <div className="lo-dashboard">
      <div className="lo-page-header">
        <h1>Overview</h1>
        <p>{new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

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

        {isWork ? (
          <div className="lo-stat-card" onClick={() => setActiveView("matters")}>
            <div className="lo-stat-value">{openMatters.length}</div>
            <div className="lo-stat-label">Open matters</div>
            {waitingActions.length > 0 && <div className="lo-stat-badge-warn">{waitingActions.length} waiting</div>}
          </div>
        ) : (
          <div className="lo-stat-card" onClick={() => setActiveView("habits")}>
            <div className="lo-stat-value">{habitPct}%</div>
            <div className="lo-stat-label">Habits done</div>
            <div className="lo-habit-bar"><div className="lo-habit-bar-fill" style={{ width: `${habitPct}%` }} /></div>
          </div>
        )}

        <div className="lo-stat-card lo-ai-card" onClick={() => setActiveView("ai")}>
          <div className="lo-stat-icon">◈</div>
          <div className="lo-stat-label">Ask AI what to do next</div>
        </div>
      </div>

      <div className="lo-dashboard-grid">
        {/* Today's focus */}
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
                  <span className="lo-task-dot" />
                  <span>{t.text}</span>
                  <span className="lo-tag lo-tag-red">overdue</span>
                </li>
              ))}
              {todayTasks.slice(0, 5).map(t => (
                <li key={t.id} className="lo-task-preview">
                  <span className="lo-task-dot" />
                  <span>{t.text}</span>
                  <span className={`lo-tag lo-tag-${t.priority === "high" ? "red" : t.priority === "medium" ? "yellow" : "gray"}`}>{t.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Today's schedule */}
        <div className="lo-card">
          <div className="lo-section-header">
            <h2>Today's schedule</h2>
            <button className="lo-link-btn" onClick={() => setActiveView("calendar")}>Full calendar →</button>
          </div>
          {todayEvents.length === 0 ? (
            <div className="lo-empty-state"><div className="lo-icon">⊡</div>No events today</div>
          ) : (
            <ul className="lo-event-preview-list">
              {[...todayEvents].sort((a, b) => {
                if (a.allDay && !b.allDay) return -1;
                if (!a.allDay && b.allDay) return 1;
                return a.time.localeCompare(b.time);
              }).map(e => (
                <li key={e.id} className="lo-event-preview">
                  <span className="lo-event-time">{e.allDay ? "All day" : e.time}</span>
                  <span className="lo-event-title">{e.title}</span>
                  <span className={`lo-tag lo-tag-${e.category === "work" ? "yellow" : e.category === "health" ? "green" : "gray"}`}>{e.category}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Work: open matters | Personal: habits */}
        {isWork ? (
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
                      <span className="lo-task-dot" />
                      <span>{m.name}</span>
                      {waiting > 0 && <span className="lo-tag lo-tag-yellow">{waiting} waiting</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <div className="lo-card">
            <div className="lo-section-header">
              <h2>Habits today</h2>
              <button className="lo-link-btn" onClick={() => setActiveView("habits")}>Manage →</button>
            </div>
            <div className="lo-habits-preview">
              {habits.map(h => (
                <div key={h.id} className={`lo-habit-chip ${h.completedDates.includes(today) ? "done" : ""}`}>
                  <span>{h.emoji}</span>
                  <span>{h.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top priority task */}
        {priorityTask && (
          <div className="lo-card lo-focus-card">
            <div className="lo-focus-label">Top priority right now</div>
            <div className="lo-focus-task">{priorityTask.text}</div>
            <div className="lo-focus-meta">
              <span className={`lo-tag lo-tag-${priorityTask.priority === "high" ? "red" : priorityTask.priority === "medium" ? "yellow" : "gray"}`}>{priorityTask.priority}</span>
              {priorityTask.due && <span className="lo-tag lo-tag-gray">{priorityTask.due}</span>}
              <span className="lo-tag lo-tag-gray">{priorityTask.category}</span>
            </div>
            <button className="lo-btn lo-btn-ghost" style={{ marginTop: 12 }} onClick={() => setActiveView("ai")}>
              ◈ Ask AI for help
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
