import { useState, useRef, useEffect } from "react";
import { useApp, ALL_TASK_CATEGORIES } from "@/context/AppContext";
import type { Task, WaitEntry } from "@/context/AppContext";

const CATEGORIES = [...ALL_TASK_CATEGORIES];
const PRIORITIES = ["high", "medium", "low"] as const;

function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function TaskDetail({ task, onClose, onUpdate, onDelete, onToggle, today, matterName }: {
  task: Task;
  onClose: () => void;
  onUpdate: (id: number, updates: Partial<Omit<Task, "id" | "steps">>) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number) => void;
  today: string;
  matterName: string | null;
}) {
  const {
    addStep: ctxAddStep, updateStep: ctxUpdateStep, deleteStep: ctxDeleteStep,
    addWait: ctxAddWait, updateWait: ctxUpdateWait, deleteWait: ctxDeleteWait,
  } = useApp();
  const [newStep, setNewStep] = useState("");
  const stepInputRef = useRef<HTMLInputElement>(null);
  const [showNewWait, setShowNewWait] = useState(false);
  const [newWait, setNewWait] = useState({ description: "", waitingOn: "", sentDate: today });

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

  const handleAddWait = async () => {
    if (!newWait.description.trim()) return;
    await ctxAddWait(task.id, newWait);
    setNewWait({ description: "", waitingOn: "", sentDate: today });
    setShowNewWait(false);
  };

  const toggleWaitStatus = (w: WaitEntry) => {
    const nowReceived = w.status !== "received";
    ctxUpdateWait(task.id, w.id, { status: nowReceived ? "received" : "waiting", receivedDate: nowReceived ? (w.receivedDate || today) : "" });
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
              <button
                className={`lo-urgent-btn${task.urgent ? " on" : ""}`}
                title={task.urgent ? "Unmark urgent" : "Mark urgent"}
                onClick={() => onUpdate(task.id, { urgent: !task.urgent })}
              >⚡</button>
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
          <div className="lo-detail-section-header">
            <span>Waiting on</span>
            <span className="lo-steps-count">
              {task.waits.filter(w => w.status === "waiting").length > 0 && `${task.waits.filter(w => w.status === "waiting").length} waiting`}
            </span>
          </div>

          <div className="lo-matter-actions-list">
            {task.waits.length === 0 && <p className="lo-matter-empty-actions">Nothing outstanding</p>}
            {task.waits.map(w => (
              <div key={w.id} className={`lo-matter-action-card ${w.status === "received" ? "received" : ""}`}>
                <div className="lo-matter-action-top">
                  <button
                    className={`lo-check-btn lo-check-btn-sm ${w.status === "received" ? "checked" : ""}`}
                    onClick={() => toggleWaitStatus(w)}
                    title={w.status === "received" ? "Mark as waiting" : "Mark as received"}
                  >
                    {w.status === "received" ? "✓" : ""}
                  </button>
                  <div className="lo-matter-action-meta">
                    <span className="lo-matter-action-desc">{w.description}</span>
                    {w.waitingOn && <span className="lo-matter-action-who">→ {w.waitingOn}</span>}
                  </div>
                  <button className="lo-delete-btn lo-delete-btn-sm" onClick={() => ctxDeleteWait(task.id, w.id)}>×</button>
                </div>
                <div className="lo-matter-action-dates">
                  <div className="lo-matter-action-field">
                    <label>Sent</label>
                    <input type="date" value={w.sentDate} onChange={e => ctxUpdateWait(task.id, w.id, { sentDate: e.target.value })} />
                  </div>
                  {w.status === "waiting" ? (
                    <span className="lo-tag lo-tag-wait" style={{ alignSelf: "center" }}>{daysSince(w.sentDate)}d waiting</span>
                  ) : (
                    <div className="lo-matter-action-field">
                      <label>Received</label>
                      <input type="date" value={w.receivedDate} onChange={e => ctxUpdateWait(task.id, w.id, { receivedDate: e.target.value })} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showNewWait ? (
            <div className="lo-matter-new-action">
              <input
                placeholder="What are you waiting on…"
                value={newWait.description}
                onChange={e => setNewWait(p => ({ ...p, description: e.target.value }))}
                autoFocus
              />
              <div className="lo-matter-new-action-row">
                <input
                  placeholder="Who / where"
                  value={newWait.waitingOn}
                  onChange={e => setNewWait(p => ({ ...p, waitingOn: e.target.value }))}
                />
                <input
                  type="date"
                  value={newWait.sentDate}
                  onChange={e => setNewWait(p => ({ ...p, sentDate: e.target.value }))}
                />
              </div>
              <div className="lo-matter-new-action-btns">
                <button className="lo-btn lo-btn-primary lo-btn-sm" onClick={handleAddWait} disabled={!newWait.description.trim()}>Add</button>
                <button className="lo-btn lo-btn-ghost lo-btn-sm" onClick={() => setShowNewWait(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="lo-btn lo-btn-ghost lo-btn-sm lo-matter-add-action-btn" onClick={() => setShowNewWait(true)}>
              + Add waiting-on item
            </button>
          )}
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
