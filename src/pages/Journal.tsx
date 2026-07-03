import { useState } from "react";
import { useApp, JournalEntry } from "@/context/AppContext";

const MOODS = ["😊", "😌", "😐", "😔", "😤", "🤩", "😴", "🤔", "💪", "🙏"];

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: JournalEntry;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = entry.content.slice(0, 160);
  const isLong = entry.content.length > 160;

  return (
    <div className="lo-journal-entry lo-card">
      <div className="lo-journal-entry-header">
        <div className="lo-journal-meta">
          <span className="lo-journal-mood">{entry.mood}</span>
          <div>
            <div className="lo-journal-title">{entry.title}</div>
            <div className="lo-journal-date">{formatDate(entry.date)}</div>
          </div>
        </div>
        <div className="lo-journal-actions">
          <button className="lo-journal-action-btn" onClick={() => onEdit(entry)} title="Edit">✎</button>
          <button className="lo-journal-action-btn danger" onClick={() => onDelete(entry.id)} title="Delete">×</button>
        </div>
      </div>
      <div className="lo-journal-content">
        {expanded || !isLong ? entry.content : preview + "…"}
      </div>
      {isLong && (
        <button className="lo-journal-expand-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

interface EditorProps {
  initial?: JournalEntry;
  today: string;
  onSave: (data: { date: string; title: string; content: string; mood: string }) => void;
  onCancel: () => void;
}

function Editor({ initial, today, onSave, onCancel }: EditorProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [mood, setMood] = useState(initial?.mood ?? "😊");
  const [date, setDate] = useState(initial?.date ?? today);

  const handleSave = () => {
    if (!content.trim()) return;
    onSave({ date, title: title.trim() || formatDate(date), content, mood });
  };

  return (
    <div className="lo-journal-editor lo-card">
      <div className="lo-journal-editor-top">
        <div className="lo-journal-mood-picker">
          {MOODS.map(m => (
            <button
              key={m}
              className={`lo-mood-btn ${mood === m ? "active" : ""}`}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="lo-journal-date-input"
        />
      </div>

      <input
        type="text"
        placeholder="Entry title (optional)..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="lo-journal-title-input"
      />

      <textarea
        placeholder="What's on your mind today?..."
        value={content}
        onChange={e => setContent(e.target.value)}
        className="lo-journal-textarea"
        autoFocus
        rows={10}
      />

      <div className="lo-journal-editor-actions">
        <button className="lo-btn lo-btn-primary" onClick={handleSave} disabled={!content.trim()}>
          {initial ? "Save changes" : "Add entry"}
        </button>
        <button className="lo-btn lo-btn-ghost" onClick={onCancel}>Cancel</button>
        <span className="lo-journal-word-count">{content.trim() ? content.trim().split(/\s+/).length : 0} words</span>
      </div>
    </div>
  );
}

export default function Journal() {
  const { journal, addJournalEntry, updateJournalEntry, deleteJournalEntry, today } = useApp();
  const [mode, setMode] = useState<"list" | "new" | "edit">("list");
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [search, setSearch] = useState("");
  const [filterMood, setFilterMood] = useState("");

  const filtered = journal.filter(e => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase());
    const matchMood = !filterMood || e.mood === filterMood;
    return matchSearch && matchMood;
  });

  const handleNew = (data: { date: string; title: string; content: string; mood: string }) => {
    addJournalEntry(data);
    setMode("list");
  };

  const handleEdit = (data: { date: string; title: string; content: string; mood: string }) => {
    if (editing) updateJournalEntry(editing.id, data);
    setEditing(null);
    setMode("list");
  };

  const startEdit = (entry: JournalEntry) => {
    setEditing(entry);
    setMode("edit");
  };

  const uniqueMoods = [...new Set(journal.map(e => e.mood))];

  if (mode === "new") {
    return (
      <div className="lo-journal-page">
        <div className="lo-page-header">
          <h1>New Entry</h1>
          <p>{formatDate(today)}</p>
        </div>
        <Editor today={today} onSave={handleNew} onCancel={() => setMode("list")} />
      </div>
    );
  }

  if (mode === "edit" && editing) {
    return (
      <div className="lo-journal-page">
        <div className="lo-page-header">
          <h1>Edit Entry</h1>
          <p>{formatDate(editing.date)}</p>
        </div>
        <Editor initial={editing} today={today} onSave={handleEdit} onCancel={() => { setEditing(null); setMode("list"); }} />
      </div>
    );
  }

  return (
    <div className="lo-journal-page">
      <div className="lo-page-header">
        <h1>Journal</h1>
        <p>{journal.length} {journal.length === 1 ? "entry" : "entries"}</p>
      </div>

      <div className="lo-journal-toolbar">
        <div className="lo-journal-search-row">
          <input
            type="text"
            placeholder="Search entries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="lo-journal-search"
          />
          {uniqueMoods.length > 0 && (
            <div className="lo-journal-mood-filter">
              <button
                className={`lo-mood-filter-btn ${!filterMood ? "active" : ""}`}
                onClick={() => setFilterMood("")}
              >
                All
              </button>
              {uniqueMoods.map(m => (
                <button
                  key={m}
                  className={`lo-mood-filter-btn ${filterMood === m ? "active" : ""}`}
                  onClick={() => setFilterMood(f => f === m ? "" : m)}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="lo-btn lo-btn-primary" onClick={() => setMode("new")}>
          + New entry
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="lo-empty-state">
          <div className="lo-icon">📓</div>
          {journal.length === 0 ? "No entries yet — write your first one" : "No entries match your search"}
        </div>
      ) : (
        <div className="lo-journal-list">
          {filtered.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={startEdit}
              onDelete={deleteJournalEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
