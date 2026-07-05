import { useState, useMemo, useRef, useEffect } from "react";
import { useApp, WORK_CATEGORIES, PERSONAL_CATEGORIES } from "@/context/AppContext";
import type { Task } from "@/context/AppContext";

const CATEGORIES = ["work", "personal", "health", "finance", "projects", "matters", "other"];
const PRIORITIES = ["high", "medium", "low"] as const;

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

/* ─── Task detail panel ────────────────────────────────────── */
function TaskDetail({ task, onClose, onUpdate, onDelete, onToggle, today, matterName }: {
  task: Task;
  onClose: () => void;
  onUpdate: (id: number, updates: Partial<Omit<Task, "id" | "steps">>) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number) => void;
  today: string;
  matterName: string | null;
}) {
  const { addStep: ctxAddStep, updateStep: ctxUpdateStep, deleteStep: ctxDeleteStep } = useApp();
  const [newStep, setNewStep] = useState("");
  const stepInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const addStep = async () => {
    const text = newStep.trim();
    if (!text) return;
    setNewStep("");
    await ctxAddStep(task.id, text);
    stepInputRef.current?.focus();
  };

  const toggleStep = (stepId: number) => {
    const step = task.steps.find(s => s.id === stepId);
    if (!step) return;
    const nowDone = !step.done;
    ctxUpdateStep(task.id, stepId, { done: nowDone, completedAt: nowDone ? (step.completedAt || today) : "" });
  };

  const updateStepDate = (stepId: number, date: string) => {
    ctxUpdateStep(task.id, stepId, { completedAt: date });
  };

  const deleteStep = (stepId: number) => {
    ctxDeleteStep(task.id, stepId);
  };

  const completedSteps = task.steps.filter(s => s.done).length;
  const progress = task.steps.length > 0 ? (completedSteps / task.steps.length) * 100 : 0;
  const isOverdue = task.due && task.due < today && !task.done;

  return (
    <>
      <div className="lo-detail-backdrop" onClick={onClose} />
      <div className="lo-detail-panel">
        <div className="lo-detail-header">
          <button
            className={`lo-check-btn lo-check-btn-lg ${task.done ? "checked" : ""}`}
            onClick={() => onToggle(task.id)}
            title={task.done ? "Mark incomplete" : "Mark complete"}
          >
            {task.done ? "✓" : ""}
          </button>
          <input
            className={`lo-detail-title-input ${task.done ? "done" : ""}`}
            value={task.text}
            onChange={e => onUpdate(task.id, { text: e.target.value })}
            placeholder="Task name"
          />
          <button className="lo-delete-btn" onClick={onClose} style={{ fontSize: 20, flexShrink: 0 }}>×</button>
        </div>

        <div className="lo-detail-fields">
          <div className="lo-detail-field">
            <label>Priority</label>
            <div className="lo-detail-pills">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  className={`lo-pill lo-pill-priority lo-pill-${p} ${task.priority === p ? "active" : ""}`}
                  onClick={() => onUpdate(task.id, { priority: p })}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="lo-detail-field">
            <label>Category</label>
            <div className="lo-detail-pills">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  className={`lo-pill ${task.category === c ? "active" : ""}`}
                  onClick={() => onUpdate(task.id, { category: c })}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="lo-detail-field">
            <label>Due date</label>
            <input
              type="date"
              value={task.due}
              onChange={e => onUpdate(task.id, { due: e.target.value })}
              className={isOverdue ? "lo-input-overdue" : ""}
            />
            {task.due && (
              <button className="lo-clear-btn" onClick={() => onUpdate(task.id, { due: "" })}>clear</button>
            )}
          </div>

          {matterName && (
            <div className="lo-detail-field">
              <label>Matter</label>
              <span className={`lo-tag ${task.matterId != null ? `lo-matter-c${task.matterId % 8}` : ""}`}>◇ {matterName}</span>
            </div>
          )}

          {task.done && (
            <div className="lo-detail-field">
              <label>Completed</label>
              <input
                type="date"
                value={task.completedAt}
                onChange={e => onUpdate(task.id, { completedAt: e.target.value })}
                style={{ accentColor: "var(--lo-accent)" }}
              />
              {task.completedAt && (
                <button className="lo-clear-btn" onClick={() => onUpdate(task.id, { completedAt: "" })}>clear</button>
              )}
            </div>
          )}
        </div>

        <div className="lo-detail-section">
          <div className="lo-detail-section-header">
            <span>Steps</span>
            {task.steps.length > 0 && (
              <span className="lo-steps-count">{completedSteps}/{task.steps.length}</span>
            )}
          </div>

          {task.steps.length > 0 && (
            <div className="lo-steps-progress">
              <div className="lo-steps-progress-bar" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="lo-steps-list">
            {task.steps.map(step => (
              <div key={step.id} className={`lo-step-item ${step.done ? "done" : ""}`}>
                <button
                  className={`lo-check-btn lo-check-btn-sm ${step.done ? "checked" : ""}`}
                  onClick={() => toggleStep(step.id)}
                >
                  {step.done ? "✓" : ""}
                </button>
                <span className="lo-step-text">{step.text}</span>
                {step.done && (
                  <input
                    type="date"
                    className="lo-step-date-input"
                    value={step.completedAt}
                    onChange={e => updateStepDate(step.id, e.target.value)}
                    title="Completion date"
                    onClick={e => e.stopPropagation()}
                  />
                )}
                <button className="lo-delete-btn lo-delete-btn-sm" onClick={() => deleteStep(step.id)}>×</button>
              </div>
            ))}
          </div>

          <div className="lo-step-add-row">
            <input
              ref={stepInputRef}
              placeholder="Add a step..."
              value={newStep}
              onChange={e => setNewStep(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addStep()}
            />
            <button className="lo-btn lo-btn-ghost lo-btn-sm" onClick={addStep} disabled={!newStep.trim()}>Add</button>
          </div>
        </div>

        <div className="lo-detail-section">
          <div className="lo-detail-section-header"><span>Notes</span></div>
          <textarea
            className="lo-detail-notes"
            placeholder="Add notes..."
            value={task.notes}
            onChange={e => onUpdate(task.id, { notes: e.target.value })}
            rows={4}
          />
        </div>

        <div className="lo-detail-footer">
          <button className="lo-btn lo-btn-danger" onClick={() => { onDelete(task.id); onClose(); }}>
            Delete task
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Main Tasks page ──────────────────────────────────────── */
export default function Tasks({ categoryFilter }: { categoryFilter?: string } = {}) {
  const { viewMode, tasks, matters, addTask, updateTask, toggleTask, deleteTask, today } = useApp();
  const isWork = viewMode === "work";
  const modeCategories: readonly string[] = isWork ? WORK_CATEGORIES : PERSONAL_CATEGORIES;
  const formCategories = categoryFilter ? [categoryFilter] : modeCategories;
  const defaultCategory = categoryFilter ?? (isWork ? "work" : "personal");

  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<{ text: string; priority: Task["priority"]; due: string; category: string; matterId: number | null }>({ text: "", priority: "medium", due: "", category: defaultCategory, matterId: null });

  const base = categoryFilter
    ? tasks.filter(t => t.category === categoryFilter)
    : tasks.filter(t => modeCategories.includes(t.category));

  const filtered = base
    .filter(t => {
      if (filter === "today") return t.due === today;
      if (filter === "done") return t.done;
      if (filter === "open") return !t.done;
      if (filter === "projects") return t.category === "projects";
      return true;
    })
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
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
          onToggle={toggleTask}
          today={today}
          matterName={matterName(selectedTask.matterId)}
        />
      )}

      <div className="lo-page-header">
        <h1>{categoryFilter === "projects" ? "Projects" : "Tasks"}</h1>
        <p>{base.filter(t => !t.done).length} open · {base.filter(t => t.done).length} done</p>
      </div>

      <div className="lo-tasks-toolbar">
        <div className="lo-filter-tabs">
          {(categoryFilter
            ? ["all", "today", "open", "done"]
            : isWork
              ? ["all", "today", "open", "projects", "done"]
              : ["all", "today", "open", "done"]
          ).map(f => (
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
          {isWork && matters.length > 0 && (
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

      <div className="lo-task-list">
        {filtered.length === 0 && <div className="lo-empty-state"><div className="lo-icon">✓</div>No tasks here</div>}
        {filtered.map(task => {
          const isOverdue = task.due && task.due < today && !task.done;
          const completedSteps = task.steps.filter(s => s.done).length;
          return (
            <div
              key={task.id}
              className={`lo-task-item lo-card ${task.done ? "done" : ""} ${isOverdue ? "overdue" : ""} ${selectedId === task.id ? "selected" : ""}`}
              onClick={() => setSelectedId(task.id)}
            >
              <button
                className={`lo-check-btn ${task.done ? "checked" : ""}`}
                onClick={e => { e.stopPropagation(); toggleTask(task.id); }}
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
                  {task.notes && <span className="lo-task-notes-dot" title="Has notes">✦</span>}
                </div>
              </div>
              <span className="lo-task-chevron">›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
