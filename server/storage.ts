import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR lets a deploy target (e.g. a Railway volume) point this at a
// persistent mount instead of the container's ephemeral filesystem.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

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
  steps: TaskStep[];
}

export interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  allDay: boolean;
  category: string;
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

interface DB {
  tasks: Task[];
  events: Event[];
  habits: Habit[];
  journal: JournalEntry[];
  matters: Matter[];
  nextId: number;
}

function defaultDb(): DB {
  return { tasks: [], events: [], habits: [], journal: [], matters: [], nextId: 1 };
}

function load(): DB {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fresh = defaultDb();
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as DB;
  // Backfill fields added to the schema after some data was already persisted.
  for (const habit of parsed.habits) {
    if (!habit.notes) habit.notes = {};
  }
  return parsed;
}

export const db: DB = load();

export function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

export function allocId(): number {
  return db.nextId++;
}
