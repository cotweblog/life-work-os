import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toLocalDateStr } from "@/lib/utils";

export interface MatterAction {
  id: number;
  matterId: number;
  description: string;
  sentTo: string;
  sentDate: string;
  neededFrom: string;
  status: "waiting" | "received";
  receivedDate: string;
}

export interface Matter {
  id: number;
  name: string;
  description: string;
  status: "open" | "closed" | "pending";
  openedDate: string;
  notes: string;
  actions: MatterAction[];
}

export interface TaskStep {
  id: number;
  text: string;
  done: boolean;
  completedAt: string;
}

export interface Task {
  id: number;
  text: string;
  priority: "high" | "medium" | "low";
  due: string;
  done: boolean;
  completedAt: string;
  category: string;
  notes: string;
  matterId: number | null;
  urgent: boolean;
  steps: TaskStep[];
}

export interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  endTime: string;
  allDay: boolean;
  category: string;
  taskId: number | null;
  matterId: number | null;
}

export interface Habit {
  id: number;
  name: string;
  emoji: string;
  frequency: string;
  completedDates: string[];
  notes: Record<string, string>;
}

export interface JournalEntry {
  id: number;
  date: string;
  title: string;
  content: string;
  mood: string;
}

export const ALL_TASK_CATEGORIES = ["inbox", "work", "personal", "health", "finance", "matters", "other"] as const;

interface AppContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, "id" | "done" | "notes" | "steps" | "completedAt" | "urgent"> & { urgent?: boolean }) => Promise<void>;
  updateTask: (id: number, updates: Partial<Omit<Task, "id" | "steps">>) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  addStep: (taskId: number, text: string) => Promise<void>;
  updateStep: (taskId: number, stepId: number, updates: Partial<TaskStep>) => Promise<void>;
  deleteStep: (taskId: number, stepId: number) => Promise<void>;
  events: Event[];
  addEvent: (event: Omit<Event, "id">) => Promise<void>;
  updateEvent: (id: number, updates: Partial<Omit<Event, "id">>) => Promise<void>;
  deleteEvent: (id: number) => Promise<void>;
  habits: Habit[];
  addHabit: (habit: Omit<Habit, "id" | "completedDates" | "notes">) => Promise<void>;
  toggleHabitDate: (id: number, date: string) => Promise<void>;
  setHabitNote: (id: number, date: string, note: string) => Promise<void>;
  deleteHabit: (id: number) => Promise<void>;
  journal: JournalEntry[];
  addJournalEntry: (entry: Omit<JournalEntry, "id">) => Promise<void>;
  updateJournalEntry: (id: number, updates: Partial<Omit<JournalEntry, "id">>) => Promise<void>;
  deleteJournalEntry: (id: number) => Promise<void>;
  linkTaskToMatter: (taskId: number, matterId: number | null) => Promise<void>;
  matters: Matter[];
  addMatter: (m: Omit<Matter, "id" | "actions">) => Promise<void>;
  updateMatter: (id: number, updates: Partial<Omit<Matter, "id" | "actions">>) => Promise<void>;
  deleteMatter: (id: number) => Promise<void>;
  addMatterAction: (matterId: number, a: Omit<MatterAction, "id" | "matterId">) => Promise<void>;
  updateMatterAction: (matterId: number, actionId: number, updates: Partial<Omit<MatterAction, "id" | "matterId">>) => Promise<void>;
  deleteMatterAction: (matterId: number, actionId: number) => Promise<void>;
  today: string;
  loading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

const todayStr = () => toLocalDateStr(new Date());

const api = (path: string) => `${import.meta.env.BASE_URL}api${path}`;

const get = (path: string) => fetch(api(path)).then(r => r.json());
const post = (path: string, body: unknown) =>
  fetch(api(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
const patch = (path: string, body: unknown) =>
  fetch(api(path), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
const del = (path: string) =>
  fetch(api(path), { method: "DELETE" }).then(r => r.json());

export function AppProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      get("/tasks"),
      get("/events"),
      get("/habits"),
      get("/journal"),
      get("/matters"),
    ]).then(([t, e, h, j, m]) => {
      setTasks(t);
      setEvents(e);
      setHabits(h);
      setJournal(j);
      setMatters(m);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const addTask = async (task: Omit<Task, "id" | "done" | "notes" | "steps" | "completedAt" | "urgent"> & { urgent?: boolean }) => {
    const created = await post("/tasks", { ...task, urgent: task.urgent ?? false });
    setTasks(prev => [...prev, created]);
  };

  const updateTask = async (id: number, updates: Partial<Omit<Task, "id" | "steps">>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    await patch(`/tasks/${id}`, updates);
  };

  const toggleTask = async (id: number) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const nowDone = !task.done;
    const completedAt = nowDone ? (task.completedAt || todayStr()) : "";
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: nowDone, completedAt } : t));
    await patch(`/tasks/${id}`, { done: nowDone, completedAt });
  };

  const deleteTask = async (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await del(`/tasks/${id}`);
  };

  const linkTaskToMatter = async (taskId: number, matterId: number | null) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, matterId } : t));
    await patch(`/tasks/${taskId}`, { matterId });
  };

  const addStep = async (taskId: number, text: string) => {
    const step = await post(`/tasks/${taskId}/steps`, { text });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, steps: [...t.steps, step] } : t));
  };

  const updateStep = async (taskId: number, stepId: number, updates: Partial<TaskStep>) => {
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, steps: t.steps.map(s => s.id === stepId ? { ...s, ...updates } : s) }
      : t));
    await patch(`/tasks/${taskId}/steps/${stepId}`, updates);
  };

  const deleteStep = async (taskId: number, stepId: number) => {
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, steps: t.steps.filter(s => s.id !== stepId) }
      : t));
    await del(`/tasks/${taskId}/steps/${stepId}`);
  };

  const addEvent = async (event: Omit<Event, "id">) => {
    const created = await post("/events", event);
    setEvents(prev => [...prev, created]);
  };

  const updateEvent = async (id: number, updates: Partial<Omit<Event, "id">>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    await patch(`/events/${id}`, updates);
  };

  const deleteEvent = async (id: number) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    await del(`/events/${id}`);
  };

  const addHabit = async (habit: Omit<Habit, "id" | "completedDates" | "notes">) => {
    const created = await post("/habits", habit);
    setHabits(prev => [...prev, created]);
  };

  const toggleHabitDate = async (id: number, date: string) => {
    const { completedDates } = await post(`/habits/${id}/toggle`, { date });
    setHabits(prev => prev.map(h => h.id === id ? { ...h, completedDates } : h));
  };

  const setHabitNote = async (id: number, date: string, note: string) => {
    const { notes } = await post(`/habits/${id}/note`, { date, note });
    setHabits(prev => prev.map(h => h.id === id ? { ...h, notes } : h));
  };

  const deleteHabit = async (id: number) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    await del(`/habits/${id}`);
  };

  const addJournalEntry = async (entry: Omit<JournalEntry, "id">) => {
    const created = await post("/journal", entry);
    setJournal(prev => [created, ...prev]);
  };

  const updateJournalEntry = async (id: number, updates: Partial<Omit<JournalEntry, "id">>) => {
    setJournal(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    await patch(`/journal/${id}`, updates);
  };

  const deleteJournalEntry = async (id: number) => {
    setJournal(prev => prev.filter(e => e.id !== id));
    await del(`/journal/${id}`);
  };

  const addMatter = async (m: Omit<Matter, "id" | "actions">) => {
    const created = await post("/matters", m);
    setMatters(prev => [created, ...prev]);
  };

  const updateMatter = async (id: number, updates: Partial<Omit<Matter, "id" | "actions">>) => {
    setMatters(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    await patch(`/matters/${id}`, updates);
  };

  const deleteMatter = async (id: number) => {
    setMatters(prev => prev.filter(m => m.id !== id));
    await del(`/matters/${id}`);
  };

  const addMatterAction = async (matterId: number, a: Omit<MatterAction, "id" | "matterId">) => {
    const created = await post(`/matters/${matterId}/actions`, a);
    setMatters(prev => prev.map(m => m.id === matterId ? { ...m, actions: [...m.actions, created] } : m));
  };

  const updateMatterAction = async (matterId: number, actionId: number, updates: Partial<Omit<MatterAction, "id" | "matterId">>) => {
    setMatters(prev => prev.map(m => m.id === matterId
      ? { ...m, actions: m.actions.map(a => a.id === actionId ? { ...a, ...updates } : a) }
      : m));
    await patch(`/matters/${matterId}/actions/${actionId}`, updates);
  };

  const deleteMatterAction = async (matterId: number, actionId: number) => {
    setMatters(prev => prev.map(m => m.id === matterId
      ? { ...m, actions: m.actions.filter(a => a.id !== actionId) }
      : m));
    await del(`/matters/${matterId}/actions/${actionId}`);
  };

  return (
    <AppContext.Provider value={{
      tasks, addTask, updateTask, toggleTask, deleteTask, linkTaskToMatter,
      addStep, updateStep, deleteStep,
      events, addEvent, updateEvent, deleteEvent,
      habits, addHabit, toggleHabitDate, setHabitNote, deleteHabit,
      journal, addJournalEntry, updateJournalEntry, deleteJournalEntry,
      matters, addMatter, updateMatter, deleteMatter,
      addMatterAction, updateMatterAction, deleteMatterAction,
      today: todayStr(),
      loading,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};
