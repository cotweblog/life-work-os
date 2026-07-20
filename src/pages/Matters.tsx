import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import type { Matter, MatterAction, Task } from "@/context/AppContext";
import TaskDetail from "@/components/TaskDetail";
import CompleteToast from "@/components/CompleteToast";

const STATUS_LABELS: Record<string, string> = { open: "Open", pending: "Pending", closed: "Closed" };
const STATUS_COLORS: Record<string, string> = { open: "lo-badge-open", pending: "lo-badge-pending", closed: "lo-badge-closed" };
const ACTION_STATUS: Record<string, string> = { waiting: "Waiting", received: "Received" };

function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

/* ─── Matter detail panel ──────────────────────────────────── */
function MatterDetail({ matter, onClose, today }: {
  matter: Matter;
  onClose: () => void;
  today: string;
}) {
  const { tasks, addTask, updateTask, toggleTask, deleteTask, linkTaskToMatter, updateMatter, deleteMatter, addMatterAction, updateMatterAction, deleteMatterAction } = useApp();
  const [newAction, setNewAction] = useState({ description: "", sentTo: "", sentDate: today, neededFrom: "" });
  const [showNewAction, setShowNewAction] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);
  const [linkingTaskId, setLinkingTaskId] = useState<string>("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [completeToast, setCompleteToast] = useState<{ id: number; text: string } | null>(null);

  const linkedTasks = tasks.filter(t => t.matterId === matter.id);
  const unlinkableTasks = tasks.filter(t => t.matterId == null && !t.done);

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    await addTask({ text: newTaskText.trim(), priority: "medium", due: "", category: "matters", matterId: matter.id });
    setNewTaskText("");
    setShowNewTask(false);
  };

  const handleToggleTask = async (id: number) => {
    const task = tasks.find(t => t.id === id);
    const wasDone = task?.done;
    await toggleTask(id);
    if (task && !wasDone) setCompleteToast({ id: task.id, text: task.text });
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null;

  const handleLinkTask = async () => {
    if (!linkingTaskId) return;
    await linkTaskToMatter(Number(linkingTaskId), matter.id);
    setLinkingTaskId("");
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleAddAction = async () => {
    if (!newAction.description.trim()) return;
    await addMatterAction(matter.id, { ...newAction, status: "waiting", receivedDate: "" });
    setNewAction({ description: "", sentTo: "", sentDate: today, neededFrom: "" });
    setShowNewAction(false);
  };

  const toggleActionStatus = (a: MatterAction) => {
    const nowReceived = a.status !== "received";
    updateMatterAction(matter.id, a.id, {
      status: nowReceived ? "received" : "waiting",
      receivedDate: nowReceived ? (a.receivedDate || today) : "",
    });
  };

  const waitingCount = matter.actions.filter(a => a.status === "waiting").length;
  const receivedCount = matter.actions.filter(a => a.status === "received").length;

  return (
    <>
      <div className="lo-detail-backdrop" onClick={onClose} />
      <div className="lo-detail-panel lo-matter-panel">
        {selectedTask && (
          <TaskDetail
            task={selectedTask}
            onClose={() => setSelectedTaskId(null)}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onToggle={handleToggleTask}
            today={today}
            matterName={matter.name}
          />
        )}
        {completeToast && (
          <CompleteToast
            taskId={completeToast.id}
            taskText={completeToast.text}
            onDismiss={() => setCompleteToast(null)}
          />
        )}
        <div className="lo-detail-header">
          <div className={`lo-badge ${STATUS_COLORS[matter.status]}`}>{STATUS_LABELS[matter.status]}</div>
          <input
            className="lo-detail-title-input"
            value={matter.name}
            onChange={e => updateMatter(matter.id, { name: e.target.value })}
            placeholder="Matter name"
          />
          <button className="lo-delete-btn" onClick={onClose} style={{ fontSize: 20, flexShrink: 0 }}>×</button>
        </div>

        <div className="lo-detail-fields">
          <div className="lo-detail-field">
            <label>Status</label>
            <div className="lo-detail-pills">
              {(["open", "pending", "closed"] as const).map(s => (
                <button
                  key={s}
                  className={`lo-pill ${matter.status === s ? "active" : ""}`}
                  onClick={() => updateMatter(matter.id, { status: s })}
                >{STATUS_LABELS[s]}</button>
              ))}
            </div>
          </div>
          <div className="lo-detail-field">
            <label>Date opened</label>
            <input
              type="date"
              value={matter.openedDate}
              onChange={e => updateMatter(matter.id, { openedDate: e.target.value })}
            />
            <span className="lo-matter-age">{daysSince(matter.openedDate)} days ago</span>
          </div>
        </div>

        <div className="lo-detail-section">
          <div className="lo-detail-section-header"><span>Description</span></div>
          <textarea
            className="lo-detail-notes"
            placeholder="Describe this matter…"
            value={matter.description}
            onChange={e => updateMatter(matter.id, { description: e.target.value })}
            rows={3}
          />
        </div>

        {/* Waiting for / actions */}
        <div className="lo-detail-section">
          <div className="lo-detail-section-header">
            <span>Waiting for</span>
            <span className="lo-steps-count">
              {waitingCount > 0 && `${waitingCount} waiting`}
              {waitingCount > 0 && receivedCount > 0 && " · "}
              {receivedCount > 0 && `${receivedCount} received`}
            </span>
          </div>

          <div className="lo-matter-actions-list">
            {matter.actions.length === 0 && (
              <p className="lo-matter-empty-actions">No delegated actions yet</p>
            )}
            {matter.actions.map(a => (
              <div key={a.id} className={`lo-matter-action-card ${a.status === "received" ? "received" : ""}`}>
                <div className="lo-matter-action-top">
                  <button
                    className={`lo-check-btn lo-check-btn-sm ${a.status === "received" ? "checked" : ""}`}
                    onClick={() => toggleActionStatus(a)}
                    title={a.status === "received" ? "Mark as waiting" : "Mark as received"}
                  >
                    {a.status === "received" ? "✓" : ""}
                  </button>
                  <div className="lo-matter-action-meta">
                    <input
                      className="lo-matter-action-desc"
                      value={a.description}
                      onChange={e => updateMatterAction(matter.id, a.id, { description: e.target.value })}
                      placeholder="What was sent / delegated…"
                    />
                    <input
                      className="lo-matter-action-who"
                      value={a.sentTo}
                      onChange={e => updateMatterAction(matter.id, a.id, { sentTo: e.target.value })}
                      placeholder="To whom (optional)"
                    />
                  </div>
                  <button className="lo-delete-btn lo-delete-btn-sm" onClick={() => deleteMatterAction(matter.id, a.id)}>×</button>
                </div>
                <div className="lo-matter-action-dates">
                  <div className="lo-matter-action-field">
                    <label>Sent</label>
                    <input type="date" value={a.sentDate} onChange={e => updateMatterAction(matter.id, a.id, { sentDate: e.target.value })} />
                  </div>
                  {a.status === "received" && (
                    <div className="lo-matter-action-field">
                      <label>Received</label>
                      <input type="date" value={a.receivedDate} onChange={e => updateMatterAction(matter.id, a.id, { receivedDate: e.target.value })} />
                    </div>
                  )}
                </div>
                {(a.neededFrom || a.status === "waiting") && (
                  <div className="lo-matter-action-needed">
                    <label>Need from them</label>
                    <textarea
                      value={a.neededFrom}
                      onChange={e => updateMatterAction(matter.id, a.id, { neededFrom: e.target.value })}
                      placeholder="What do you need back from them?"
                      rows={2}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {showNewAction ? (
            <div className="lo-matter-new-action">
              <input
                placeholder="What was sent / delegated…"
                value={newAction.description}
                onChange={e => setNewAction(p => ({ ...p, description: e.target.value }))}
                autoFocus
              />
              <div className="lo-matter-new-action-row">
                <input
                  placeholder="To whom"
                  value={newAction.sentTo}
                  onChange={e => setNewAction(p => ({ ...p, sentTo: e.target.value }))}
                />
                <input
                  type="date"
                  value={newAction.sentDate}
                  onChange={e => setNewAction(p => ({ ...p, sentDate: e.target.value }))}
                />
              </div>
              <textarea
                placeholder="What do you need back from them?"
                value={newAction.neededFrom}
                onChange={e => setNewAction(p => ({ ...p, neededFrom: e.target.value }))}
                rows={2}
              />
              <div className="lo-matter-new-action-btns">
                <button className="lo-btn lo-btn-primary lo-btn-sm" onClick={handleAddAction} disabled={!newAction.description.trim()}>Add</button>
                <button className="lo-btn lo-btn-ghost lo-btn-sm" onClick={() => setShowNewAction(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="lo-btn lo-btn-ghost lo-btn-sm lo-matter-add-action-btn" onClick={() => setShowNewAction(true)}>
              + Add waiting-for item
            </button>
          )}
        </div>

        {/* Tasks */}
        <div className="lo-detail-section">
          <div className="lo-detail-section-header">
            <span>Tasks</span>
            <span className="lo-steps-count">
              {linkedTasks.length > 0 && `${linkedTasks.filter(t => t.done).length}/${linkedTasks.length} done`}
            </span>
          </div>

          <div className="lo-matter-tasks-list">
            {linkedTasks.length === 0 && !showNewTask && (
              <p className="lo-matter-empty-actions">No tasks linked yet</p>
            )}
            {linkedTasks.map(t => {
              const isOverdue = t.due && t.due < today && !t.done;
              const openWait = t.waits.filter(w => w.status === "waiting").sort((a, b) => a.sentDate.localeCompare(b.sentDate))[0];
              return (
                <div
                  key={t.id}
                  className={`lo-matter-task-row lo-matter-task-row-clickable ${t.done ? "done" : ""}`}
                  onClick={() => setSelectedTaskId(t.id)}
                >
                  <button
                    className={`lo-check-btn lo-check-btn-sm ${t.done ? "checked" : ""}`}
                    onClick={e => { e.stopPropagation(); handleToggleTask(t.id); }}
                  >
                    {t.done ? "✓" : ""}
                  </button>
                  <div className="lo-matter-task-body">
                    <span className="lo-matter-task-text">{t.text}</span>
                    <div className="lo-task-meta">
                      <span className={`lo-tag lo-tag-${t.priority === "high" ? "red" : t.priority === "medium" ? "yellow" : "gray"}`}>{t.priority}</span>
                      {t.due && <span className={`lo-tag ${isOverdue ? "lo-tag-red" : "lo-tag-gray"}`}>{isOverdue ? "overdue · " : ""}{t.due}</span>}
                      {t.steps.length > 0 && (
                        <span className="lo-tag lo-tag-gray">{t.steps.filter(s => s.done).length}/{t.steps.length} steps</span>
                      )}
                      {openWait && (
                        <span className="lo-tag lo-tag-wait">⏳ {daysSince(openWait.sentDate)}d{openWait.waitingOn ? ` · ${openWait.waitingOn}` : ""}</span>
                      )}
                      {t.notes && <span className="lo-task-notes-dot" title="Has notes">✦</span>}
                    </div>
                  </div>
                  <button
                    className="lo-delete-btn lo-delete-btn-sm"
                    title="Unlink task"
                    onClick={e => { e.stopPropagation(); linkTaskToMatter(t.id, null); }}
                  >×</button>
                  <span className="lo-task-chevron">›</span>
                </div>
              );
            })}
          </div>

          {showNewTask ? (
            <div className="lo-matter-new-task">
              <input
                placeholder="Task description…"
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleAddTask()}
              />
              <div className="lo-matter-new-action-btns">
                <button className="lo-btn lo-btn-primary lo-btn-sm" onClick={handleAddTask} disabled={!newTaskText.trim()}>Add</button>
                <button className="lo-btn lo-btn-ghost lo-btn-sm" onClick={() => { setShowNewTask(false); setNewTaskText(""); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="lo-matter-task-btns">
              <button className="lo-btn lo-btn-ghost lo-btn-sm" onClick={() => setShowNewTask(true)}>+ New task</button>
              {unlinkableTasks.length > 0 && (
                <div className="lo-matter-link-row">
                  <select value={linkingTaskId} onChange={e => setLinkingTaskId(e.target.value)}>
                    <option value="">Link existing task…</option>
                    {unlinkableTasks.map(t => (
                      <option key={t.id} value={t.id}>{t.text}</option>
                    ))}
                  </select>
                  {linkingTaskId && (
                    <button className="lo-btn lo-btn-primary lo-btn-sm" onClick={handleLinkTask}>Link</button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lo-detail-section">
          <div className="lo-detail-section-header"><span>Notes</span></div>
          <textarea
            className="lo-detail-notes"
            placeholder="Add notes…"
            value={matter.notes}
            onChange={e => updateMatter(matter.id, { notes: e.target.value })}
            rows={4}
          />
        </div>

        <div className="lo-detail-footer">
          <button className="lo-btn lo-btn-danger" onClick={() => { deleteMatter(matter.id); onClose(); }}>
            Delete matter
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Matter card ──────────────────────────────────────────── */
function MatterCard({ matter, taskCount, onClick }: { matter: Matter; taskCount: number; onClick: () => void }) {
  const waiting = matter.actions.filter(a => a.status === "waiting").length;
  const received = matter.actions.filter(a => a.status === "received").length;
  const age = daysSince(matter.openedDate);

  return (
    <div className={`lo-matter-card lo-card ${matter.status === "closed" ? "lo-matter-closed" : ""}`} onClick={onClick}>
      <div className="lo-matter-card-header">
        <span className="lo-matter-card-name">{matter.name}</span>
        <span className={`lo-badge ${STATUS_COLORS[matter.status]}`}>{STATUS_LABELS[matter.status]}</span>
      </div>
      {matter.description && (
        <p className="lo-matter-card-desc">{matter.description}</p>
      )}
      <div className="lo-matter-card-footer">
        <span className="lo-matter-card-age">Opened {age === 0 ? "today" : `${age}d ago`} · {matter.openedDate}</span>
        <div className="lo-matter-card-actions">
          {taskCount > 0 && <span className="lo-matter-task-badge">{taskCount} task{taskCount !== 1 ? "s" : ""}</span>}
          {waiting > 0 && <span className="lo-matter-waiting-badge">{waiting} waiting</span>}
          {received > 0 && <span className="lo-matter-received-badge">{received} received</span>}
        </div>
      </div>
    </div>
  );
}

/* ─── Matters page ─────────────────────────────────────────── */
export default function Matters() {
  const { tasks, matters, addMatter, today } = useApp();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "pending" | "closed">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", status: "open" as Matter["status"], openedDate: today, notes: "" });

  const selectedMatter = matters.find(m => m.id === selectedId) ?? null;

  const filtered = matters.filter(m => filter === "all" || m.status === filter);

  const openCount = matters.filter(m => m.status === "open").length;
  const pendingCount = matters.filter(m => m.status === "pending").length;
  const closedCount = matters.filter(m => m.status === "closed").length;
  const waitingCount = matters.flatMap(m => m.actions).filter(a => a.status === "waiting").length;

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    await addMatter(form);
    setForm({ name: "", description: "", status: "open", openedDate: today, notes: "" });
    setShowForm(false);
  };

  return (
    <div className="lo-tasks-page">
      {selectedMatter && (
        <MatterDetail
          matter={selectedMatter}
          onClose={() => setSelectedId(null)}
          today={today}
        />
      )}

      <div className="lo-page-header">
        <h1>Matters</h1>
        <p>{openCount} open · {pendingCount} pending · {closedCount} closed</p>
      </div>

      {/* Stats dashboard */}
      <div className="lo-matters-stats">
        <div className="lo-matters-stat-card">
          <div className="lo-matters-stat-num">{openCount}</div>
          <div className="lo-matters-stat-label">Open matters</div>
        </div>
        <div className="lo-matters-stat-card lo-matters-stat-waiting">
          <div className="lo-matters-stat-num">{waitingCount}</div>
          <div className="lo-matters-stat-label">Items waiting</div>
        </div>
        <div className="lo-matters-stat-card">
          <div className="lo-matters-stat-num">{pendingCount}</div>
          <div className="lo-matters-stat-label">Pending</div>
        </div>
        <div className="lo-matters-stat-card lo-matters-stat-closed">
          <div className="lo-matters-stat-num">{closedCount}</div>
          <div className="lo-matters-stat-label">Closed</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="lo-tasks-toolbar">
        <div className="lo-filter-tabs">
          {(["all", "open", "pending", "closed"] as const).map(f => (
            <button key={f} className={`lo-filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <button className="lo-btn lo-btn-primary" onClick={() => setShowForm(true)}>+ New matter</button>
      </div>

      {/* Add matter form */}
      {showForm && (
        <div className="lo-matter-form lo-card">
          <input
            placeholder="Matter name…"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            autoFocus
            className="lo-matter-form-title"
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />
          <textarea
            placeholder="Description (optional)…"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={2}
          />
          <div className="lo-matter-form-row">
            <label>Date opened</label>
            <input type="date" value={form.openedDate} onChange={e => setForm(p => ({ ...p, openedDate: e.target.value }))} />
            <label>Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as "open" | "pending" | "closed" }))}>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="lo-matter-form-btns">
            <button className="lo-btn lo-btn-primary" onClick={handleAdd} disabled={!form.name.trim()}>Create matter</button>
            <button className="lo-btn lo-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Matter list */}
      {filtered.length === 0 ? (
        <div className="lo-empty-state">
          <div className="lo-icon">◇</div>
          {filter === "all" ? "No matters yet — create one above" : `No ${filter} matters`}
        </div>
      ) : (
        <div className="lo-matters-list">
          {filtered.map(m => (
            <MatterCard key={m.id} matter={m} taskCount={tasks.filter(t => t.matterId === m.id).length} onClick={() => setSelectedId(m.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
