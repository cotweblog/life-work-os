import { Router } from "express";
import type { Task, TaskStep, Event, Habit, JournalEntry, Matter, MatterAction } from "./storage.js";
import { db, persist, allocId } from "./storage.js";
import { chat } from "./ai.js";

export const router = Router();

const notFound = (res: import("express").Response) => res.status(404).json({ error: "not found" });

// ── Tasks ──────────────────────────────────────────────
router.get("/tasks", (_req, res) => res.json(db.tasks));

router.post("/tasks", (req, res) => {
  const body = req.body as Pick<Task, "text" | "priority" | "due" | "category" | "matterId">;
  const task: Task = {
    id: allocId(),
    text: body.text,
    priority: body.priority,
    due: body.due ?? "",
    category: body.category,
    matterId: body.matterId ?? null,
    done: false,
    completedAt: "",
    notes: "",
    steps: [],
  };
  db.tasks.push(task);
  persist();
  res.json(task);
});

router.patch("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const task = db.tasks.find(t => t.id === id);
  if (!task) return notFound(res);
  Object.assign(task, req.body);
  persist();
  res.json(task);
});

router.delete("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  db.tasks = db.tasks.filter(t => t.id !== id);
  persist();
  res.json({ ok: true });
});

router.post("/tasks/:id/steps", (req, res) => {
  const id = Number(req.params.id);
  const task = db.tasks.find(t => t.id === id);
  if (!task) return notFound(res);
  const step: TaskStep = { id: allocId(), text: req.body.text, done: false, completedAt: "" };
  task.steps.push(step);
  persist();
  res.json(step);
});

router.patch("/tasks/:id/steps/:stepId", (req, res) => {
  const id = Number(req.params.id);
  const stepId = Number(req.params.stepId);
  const task = db.tasks.find(t => t.id === id);
  const step = task?.steps.find(s => s.id === stepId);
  if (!task || !step) return notFound(res);
  Object.assign(step, req.body);
  persist();
  res.json(step);
});

router.delete("/tasks/:id/steps/:stepId", (req, res) => {
  const id = Number(req.params.id);
  const stepId = Number(req.params.stepId);
  const task = db.tasks.find(t => t.id === id);
  if (!task) return notFound(res);
  task.steps = task.steps.filter(s => s.id !== stepId);
  persist();
  res.json({ ok: true });
});

// ── Events ─────────────────────────────────────────────
router.get("/events", (_req, res) => res.json(db.events));

router.post("/events", (req, res) => {
  const body = req.body as Omit<Event, "id">;
  const event: Event = { id: allocId(), ...body };
  db.events.push(event);
  persist();
  res.json(event);
});

router.patch("/events/:id", (req, res) => {
  const id = Number(req.params.id);
  const event = db.events.find(e => e.id === id);
  if (!event) return notFound(res);
  Object.assign(event, req.body);
  persist();
  res.json(event);
});

router.delete("/events/:id", (req, res) => {
  const id = Number(req.params.id);
  db.events = db.events.filter(e => e.id !== id);
  persist();
  res.json({ ok: true });
});

// ── Habits ─────────────────────────────────────────────
router.get("/habits", (_req, res) => res.json(db.habits));

router.post("/habits", (req, res) => {
  const body = req.body as Pick<Habit, "name" | "emoji" | "frequency">;
  const habit: Habit = { id: allocId(), ...body, completedDates: [], notes: {} };
  db.habits.push(habit);
  persist();
  res.json(habit);
});

router.post("/habits/:id/toggle", (req, res) => {
  const id = Number(req.params.id);
  const habit = db.habits.find(h => h.id === id);
  if (!habit) return notFound(res);
  const { date } = req.body as { date: string };
  habit.completedDates = habit.completedDates.includes(date)
    ? habit.completedDates.filter(d => d !== date)
    : [...habit.completedDates, date];
  persist();
  res.json({ completedDates: habit.completedDates });
});

router.post("/habits/:id/note", (req, res) => {
  const id = Number(req.params.id);
  const habit = db.habits.find(h => h.id === id);
  if (!habit) return notFound(res);
  const { date, note } = req.body as { date: string; note: string };
  if (note.trim()) {
    habit.notes[date] = note;
  } else {
    delete habit.notes[date];
  }
  persist();
  res.json({ notes: habit.notes });
});

router.delete("/habits/:id", (req, res) => {
  const id = Number(req.params.id);
  db.habits = db.habits.filter(h => h.id !== id);
  persist();
  res.json({ ok: true });
});

// ── Journal ────────────────────────────────────────────
router.get("/journal", (_req, res) => res.json(db.journal));

router.post("/journal", (req, res) => {
  const body = req.body as Omit<JournalEntry, "id">;
  const entry: JournalEntry = { id: allocId(), ...body };
  db.journal.unshift(entry);
  persist();
  res.json(entry);
});

router.patch("/journal/:id", (req, res) => {
  const id = Number(req.params.id);
  const entry = db.journal.find(e => e.id === id);
  if (!entry) return notFound(res);
  Object.assign(entry, req.body);
  persist();
  res.json(entry);
});

router.delete("/journal/:id", (req, res) => {
  const id = Number(req.params.id);
  db.journal = db.journal.filter(e => e.id !== id);
  persist();
  res.json({ ok: true });
});

// ── Matters ────────────────────────────────────────────
router.get("/matters", (_req, res) => res.json(db.matters));

router.post("/matters", (req, res) => {
  const body = req.body as Omit<Matter, "id" | "actions">;
  const matter: Matter = { id: allocId(), ...body, actions: [] };
  db.matters.unshift(matter);
  persist();
  res.json(matter);
});

router.patch("/matters/:id", (req, res) => {
  const id = Number(req.params.id);
  const matter = db.matters.find(m => m.id === id);
  if (!matter) return notFound(res);
  Object.assign(matter, req.body);
  persist();
  res.json(matter);
});

router.delete("/matters/:id", (req, res) => {
  const id = Number(req.params.id);
  db.matters = db.matters.filter(m => m.id !== id);
  persist();
  res.json({ ok: true });
});

router.post("/matters/:matterId/actions", (req, res) => {
  const matterId = Number(req.params.matterId);
  const matter = db.matters.find(m => m.id === matterId);
  if (!matter) return notFound(res);
  const body = req.body as Omit<MatterAction, "id" | "matterId">;
  const action: MatterAction = { id: allocId(), matterId, ...body };
  matter.actions.push(action);
  persist();
  res.json(action);
});

router.patch("/matters/:matterId/actions/:actionId", (req, res) => {
  const matterId = Number(req.params.matterId);
  const actionId = Number(req.params.actionId);
  const matter = db.matters.find(m => m.id === matterId);
  const action = matter?.actions.find(a => a.id === actionId);
  if (!matter || !action) return notFound(res);
  Object.assign(action, req.body);
  persist();
  res.json(action);
});

router.delete("/matters/:matterId/actions/:actionId", (req, res) => {
  const matterId = Number(req.params.matterId);
  const actionId = Number(req.params.actionId);
  const matter = db.matters.find(m => m.id === matterId);
  if (!matter) return notFound(res);
  matter.actions = matter.actions.filter(a => a.id !== actionId);
  persist();
  res.json({ ok: true });
});

// ── AI Assistant ───────────────────────────────────────
router.post("/ai/chat", async (req, res) => {
  const { system, messages } = req.body as {
    system: string;
    messages: { role: "user" | "assistant"; content: string }[];
  };
  try {
    const content = await chat(system, messages);
    res.json({ content });
  } catch (err) {
    console.error("AI chat error:", err);
    res.status(500).json({
      content:
        err instanceof Error && err.message === "missing_api_key"
          ? "The AI assistant isn't configured yet — add ANTHROPIC_API_KEY to your .env file and restart the server."
          : "Something went wrong talking to the AI assistant. Please try again.",
    });
  }
});
