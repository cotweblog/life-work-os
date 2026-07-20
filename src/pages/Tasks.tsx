import { useState, useMemo } from "react";
import { useApp, ALL_TASK_CATEGORIES } from "@/context/AppContext";
import type { Task, WaitEntry } from "@/context/AppContext";
import CompleteToast from "@/components/CompleteToast";
import TaskDetail from "@/components/TaskDetail";

const CATEGORIES = [...ALL_TASK_CATEGORIES];
const PRIORITIES = ["high", "medium", "low"] as const;

function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// The wait with the earliest sentDate among still-open ones — i.e. the one
// that's been outstanding the longest, which is what's most worth surfacing.
function oldestOpenWait(waits: WaitEntry[]): WaitEntry | null {
  const open = waits.filter(w => w.status === "waiting");
  if (open.length === 0) return null;
  return open.reduce((a, b) => (a.sentDate < b.sentDate ? a : b));
}

/* ─── Import panel ─────────────────────────────────────────── */
function parsePastedTasks(raw: string): string[] {
  return raw
    .split("\n")
    .map(line =>
      line.trim()
        .replace(/^[\u2610\u2611\u2612\u2713\u2714\u2715\u00d7\u25a1\u25cb\u25cf\u2022\-\*]\s*/, "")
        .replace(/^\d+[\.\)]\s*/, "")
        .trim()
    )
    .filter(Boolean);
}

function ImportPanel({ onClose, onImport }: {
  onClose: () => void;
  onImport: (tasks: string[], priority: string, category: string) => void;
}) {
  const [raw, setRaw] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [category, setCategory] = useState("personal");
  const [imported, setImported] = useState(false);
  const parsed = useMemo(() => parsePastedTasks(raw), [raw]);

  const handleImport = () => {
    if (!parsed.length) return;
    onImport(parsed, priority, category);
    setImported(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div className="lo-import-overlay">
      <div className="lo-import-modal lo-card">
        <div className="lo-import-header">
          <div>
            <h2>Import tasks</h2>
            <p className="lo-import-subtitle">Paste from Microsoft To Do or any list</p>
          </div>
          <button className="lo-delete-btn" onClick={onClose} style={{ fontSize: 22 }}>×</button>
        </div>
        <div className="lo-import-steps">
          <div className="lo-import-step"><span className="lo-step-num">1</span><span>In Microsoft To Do, select tasks (Ctrl+A), copy (Ctrl+C)</span></div>
          <div className="lo-import-step"><span className="lo-step-num">2</span><span>Paste below — one task per line works too</span></div>
          <div className="lo-import-step"><span className="lo-step-num">3</span><span>Set defaults and click Import</span></div>
        </div>
        <textarea
          className="lo-import-textarea"
          placeholder={"Paste your tasks here — one per line.\n\nExample:\nReview quarterly goals\nCall mum this weekend\nBook dentist appointment"}
          value={raw}
          onChange={e => { setRaw(e.target.value); setImported(false); }}
          rows={8}
          autoFocus
        />
        {parsed.length > 0 && (
          <div className="lo-import-preview">
            <div className="lo-import-preview-label">{parsed.length} task{parsed.length !== 1 ? "s" : ""} detected</div>
            <div className="lo-import-preview-list">
              {parsed.slice(0, 6).map((t, i) => (
                <div key={i} className="lo-import-preview-item"><span className="lo-import-check">○</span><span>{t}</span></div>
              ))}
              {parsed.length > 6 && <div className="lo-import-preview-more">+{parsed.length - 6} more</div>}
            </div>
          </div>
        )}
        <div className="lo-import-defaults">
          <span className="lo-import-defaults-label">Import all as:</span>
          <select value={priority} onChange={e => setPriority(e.target.value as "high" | "medium" | "low")}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p} priority</option>)}
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="lo-import-footer">
          {imported ? (
            <div className="lo-import-success">✓ {parsed.length} task{parsed.length !== 1 ? "s" : ""} imported!</div>
          ) : (
            <>
              <button className="lo-btn lo-btn-accent" onClick={handleImport} disabled={parsed.length === 0}>
                Import {parsed.length > 0 ? `${parsed.length} task${parsed.length !== 1 ? "s" : ""}` : "tasks"}
              </button>
              <button className="lo-btn lo-btn-ghost" onClick={onClose}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Tasks page ──────────────────────────────────────── */
export default function Tasks({ categoryFilter }: { categoryFilter?: string } = {}) {
  const { tasks, matters, addTask, updateTask, toggleTask, deleteTask, today } = useApp();
  const formCategories = categoryFilter ? [categoryFilter] : CATEGORIES;
  const defaultCategory = categoryFilter ?? "inbox";

  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<{ text: string; priority: Task["priority"]; due: string; category: string; matterId: number | null }>({ text: "", priority: "medium", due: "", category: defaultCategory, matterId: null });
  const [completeToast, setCompleteToast] = useState<{ id: number; text: string } | null>(null);

  const base = categoryFilter
    ? tasks.filter(t => t.category === categoryFilter)
    : tasks;

  // "Do First" (urgent + important) tasks jump to the top of the list,
  // ahead of due-date ordering — that's the whole point of the quadrant.
  const isUrgent = (t: Task) => t.urgent || (!t.done && !!t.due && t.due <= today);
  const isImportant = (t: Task) => t.priority === "high";
  const isDoFirst = (t: Task) => isUrgent(t) && isImportant(t);

  const filtered = base
    .filter(t => {
      if (filter === "today") return t.due === today && !t.done;
      if (filter === "done") return t.done;
      if (filter === "open") return !t.done;
      return true;
    })
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (isDoFirst(a) !== isDoFirst(b)) return isDoFirst(a) ? -1 : 1;
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    });

  const selectedTask = tasks.find(t => t.id === selectedId) ?? null;
  const matterName = (matterId: number | null) => matterId == null ? null : matters.find(m => m.id === matterId)?.name ?? null;
  const matterColorClass = (matterId: number | null) => matterId == null ? "" : `lo-matter-c${matterId % 8}`;

  const handleAdd = () => {
    if (!form.text.trim()) return;
    addTask(form);
    setForm({ text: "", priority: "medium", due: "", category: defaultCategory, matterId: null });
    setShowForm(false);
  };

  const handleImport = (taskNames: string[], priority: string, category: string) => {
    taskNames.forEach(text => addTask({ text, priority: priority as "high" | "medium" | "low", due: "", category, matterId: null }));
  };

  const handleToggle = async (id: number) => {
    const task = tasks.find(t => t.id === id);
    const wasDone = task?.done;
    await toggleTask(id);
    if (task && !wasDone) setCompleteToast({ id: task.id, text: task.text });
  };

  const openBase = base.filter(t => !t.done);
  const quadrants = [
    { label: "Do First",      sub: "Urgent · Important",         tasks: openBase.filter(t => isUrgent(t) && isImportant(t)),   cls: "lo-mq-q1" },
    { label: "Schedule",      sub: "Not Urgent · Important",     tasks: openBase.filter(t => !isUrgent(t) && isImportant(t)),  cls: "lo-mq-q2" },
    { label: "Delegate",      sub: "Urgent · Not Important",     tasks: openBase.filter(t => isUrgent(t) && !isImportant(t)),  cls: "lo-mq-q3" },
    { label: "Deprioritise",  sub: "Not Urgent · Not Important", tasks: openBase.filter(t => !isUrgent(t) && !isImportant(t)), cls: "lo-mq-q4" },
  ];

  const renderTaskRow = (task: Task) => {
    const isOverdue = task.due && task.due < today && !task.done;
    const completedSteps = task.steps.filter(s => s.done).length;
    const wait = oldestOpenWait(task.waits);
    return (
      <div
        key={task.id}
        className={`lo-task-item lo-card ${task.done ? "done" : ""} ${isOverdue ? "overdue" : ""} ${selectedId === task.id ? "selected" : ""}`}
        onClick={() => setSelectedId(task.id)}
      >
        <button
          className={`lo-check-btn ${task.done ? "checked" : ""}`}
          onClick={e => { e.stopPropagation(); handleToggle(task.id); }}
        >
          {task.done ? "✓" : ""}
        </button>
        <div className="lo-task-body">
          <span className="lo-task-text">{task.text}</span>
          <div className="lo-task-meta">
            <span className={`lo-tag lo-tag-${task.priority === "high" ? "red" : task.priority === "medium" ? "yellow" : "gray"}`}>{task.priority}</span>
            <span className="lo-tag lo-tag-gray">{task.category}</span>
            {matterName(task.matterId) && (
              <span className={`lo-tag ${matterColorClass(task.matterId)}`}>◇ {matterName(task.matterId)}</span>
            )}
            {task.done && task.completedAt
              ? <span className="lo-tag lo-tag-green">✓ {task.completedAt}</span>
              : task.due && <span className={`lo-tag ${isOverdue ? "lo-tag-red" : "lo-tag-gray"}`}>{isOverdue ? "overdue · " : ""}{task.due}</span>
            }
            {task.steps.length > 0 && (
              <span className="lo-tag lo-tag-gray">{completedSteps}/{task.steps.length} steps</span>
            )}
            {wait && (
              <span className="lo-tag lo-tag-wait">
                ⏳ {daysSince(wait.sentDate)}d{wait.waitingOn ? ` · ${wait.waitingOn}` : ""}{task.waits.filter(x => x.status === "waiting").length > 1 ? ` (+${task.waits.filter(x => x.status === "waiting").length - 1})` : ""}
              </span>
            )}
            {task.notes && <span className="lo-task-notes-dot" title="Has notes">✦</span>}
          </div>
        </div>
        <button
          className={`lo-urgent-btn${task.urgent ? " on" : ""}`}
          title={task.urgent ? "Unmark urgent" : "Mark urgent"}
          onClick={e => { e.stopPropagation(); updateTask(task.id, { urgent: !task.urgent }); }}
        >⚡</button>
        <span className="lo-task-chevron">›</span>
      </div>
    );
  };

  return (
    <div className="lo-tasks-page">
      {showImport && (
        <ImportPanel onClose={() => setShowImport(false)} onImport={handleImport} />
      )}

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedId(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onToggle={handleToggle}
          today={today}
          matterName={matterName(selectedTask.matterId)}
        />
      )}
      {completeToast && (
        <CompleteToast
          taskId={completeToast.id}
          taskText={completeToast.text}
          onDismiss={() => setCompleteToast(null)}
        />
      )}

      <div className="lo-page-header">
        <h1>Tasks</h1>
        <p>{base.filter(t => !t.done).length} open · {base.filter(t => t.done).length} done</p>
      </div>

      <div className="lo-tasks-toolbar">
        <div className="lo-filter-tabs">
          {(["all", "today", "open", "matrix", "done"]).map(f => (
            <button key={f} className={`lo-filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="lo-btn lo-btn-ghost" onClick={() => setShowImport(true)}>⇩ Import</button>
          <button className="lo-btn lo-btn-primary" onClick={() => setShowForm(true)}>+ Add task</button>
        </div>
      </div>

      {showForm && (
        <div className="lo-card lo-add-form">
          <input
            type="text"
            placeholder="Task name..."
            value={form.text}
            onChange={e => setForm(p => ({ ...p, text: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            autoFocus
          />
          <div className="lo-form-row">
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as "high" | "medium" | "low" }))}>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              {(categoryFilter ? [categoryFilter] : [...formCategories]).map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="date" value={form.due} onChange={e => setForm(p => ({ ...p, due: e.target.value }))} />
          </div>
          {matters.length > 0 && (
            <div className="lo-form-row">
              <select
                value={form.matterId ?? ""}
                onChange={e => setForm(p => ({ ...p, matterId: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">No matter</option>
                {matters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <div className="lo-form-actions">
            <button className="lo-btn lo-btn-primary" onClick={handleAdd}>Add</button>
            <button className="lo-btn lo-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {filter === "matrix" ? (
        <div className="lo-tasks-matrix">
          {quadrants.map(q => (
            <div key={q.label} className={`lo-matrix-quadrant ${q.cls}`}>
              <div className="lo-matrix-qhd">
                <span className="lo-matrix-qlabel">{q.label}</span>
                <span className="lo-matrix-qsub">{q.sub}</span>
              </div>
              <div className="lo-matrix-qbody">
                {q.tasks.length === 0 && <span className="lo-matrix-empty">None</span>}
                {q.tasks.map(renderTaskRow)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="lo-task-list">
          {filtered.length === 0 && <div className="lo-empty-state"><div className="lo-icon">✓</div>No tasks here</div>}
          {filtered.map(renderTaskRow)}
        </div>
      )}
    </div>
  );
}
