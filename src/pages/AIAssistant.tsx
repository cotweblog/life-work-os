import { useState, useRef, useEffect } from "react";
import { useApp } from "@/context/AppContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function buildContext({ tasks, events, habits, today }: ReturnType<typeof useApp>) {
  const open = tasks.filter(t => !t.done);
  const overdue = open.filter(t => t.due && t.due < today);
  const dueToday = open.filter(t => t.due === today);
  const todayEvents = events.filter(e => e.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const habitsToday = habits.map(h => ({ name: h.name, done: h.completedDates.includes(today) }));

  return `You are a helpful personal life assistant built into a life management app. The user's current data is below. Help them prioritize, plan, and decide what to do next. Be concise, warm, and practical. Use bullet points when listing things. Address the user directly.

TODAY: ${today} (${new Date().toLocaleDateString("en-AU", { weekday: "long" })})

OPEN TASKS (${open.length} total):
- Overdue (${overdue.length}): ${overdue.map(t => `"${t.text}" [${t.priority}]`).join(", ") || "none"}
- Due today (${dueToday.length}): ${dueToday.map(t => `"${t.text}" [${t.priority}]`).join(", ") || "none"}
- Other open: ${open.filter(t => !t.due || t.due > today).map(t => `"${t.text}" [${t.priority}, ${t.category}]`).join(", ") || "none"}

TODAY'S EVENTS: ${todayEvents.length ? todayEvents.map(e => `${e.time} - ${e.title}`).join(", ") : "none scheduled"}

HABITS TODAY: ${habitsToday.map(h => `${h.name} (${h.done ? "✓ done" : "not done"})`).join(", ") || "none"}`;
}

const STARTERS = [
  "What should I focus on right now?",
  "Help me plan my day",
  "I'm feeling overwhelmed — where do I start?",
  "What habits am I neglecting?",
  "Review my priorities and suggest what to drop",
];

function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="lo-msg-text">
      {lines.map((line, i) => {
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return <div key={i} className="lo-msg-bullet">· {line.slice(2)}</div>;
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <div key={i} className="lo-msg-bold">{line.slice(2, -2)}</div>;
        }
        if (line === "") return <div key={i} className="lo-msg-spacer" />;
        return <div key={i}>{line}</div>;
      })}
    </div>
  );
}

export default function AIAssistant() {
  const appData = useApp();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your AI assistant. I can see your tasks, calendar, and habits. Ask me anything — like what to focus on right now, how to plan your day, or how to handle overwhelm." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const systemPrompt = buildContext(appData);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.content || "Sorry, I couldn't get a response. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please check your connection and try again." }]);
    }
    setLoading(false);
  };

  return (
    <div className="lo-ai-page">
      <div className="lo-page-header">
        <h1>AI Assistant</h1>
        <p>Knows your tasks, calendar &amp; habits — ask anything</p>
      </div>

      <div className="lo-ai-layout">
        <div className="lo-chat-container lo-card">
          <div className="lo-messages">
            {messages.map((m, i) => (
              <div key={i} className={`lo-message ${m.role}`}>
                {m.role === "assistant" && <div className="lo-ai-avatar">◈</div>}
                <div className="lo-message-bubble">
                  <MessageContent content={m.content} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="lo-message assistant">
                <div className="lo-ai-avatar">◈</div>
                <div className="lo-message-bubble lo-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="lo-chat-input-area">
            <input
              type="text"
              placeholder="Ask me anything about your day..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              disabled={loading}
            />
            <button className="lo-btn lo-btn-accent lo-send-btn" onClick={() => send()} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </div>

        <div className="lo-starters-panel">
          <h3>Quick prompts</h3>
          <div className="lo-starters-list">
            {STARTERS.map(s => (
              <button key={s} className="lo-starter-btn" onClick={() => send(s)} disabled={loading}>
                {s}
              </button>
            ))}
          </div>

          <div className="lo-context-preview">
            <h3>What I can see</h3>
            <div className="lo-context-item">
              <span className="lo-ctx-icon">✓</span>
              <span>{appData.tasks.filter(t => !t.done).length} open tasks</span>
            </div>
            <div className="lo-context-item">
              <span className="lo-ctx-icon">⊡</span>
              <span>{appData.events.filter(e => e.date === appData.today).length} events today</span>
            </div>
            <div className="lo-context-item">
              <span className="lo-ctx-icon">◎</span>
              <span>{appData.habits.filter(h => h.completedDates.includes(appData.today)).length}/{appData.habits.length} habits done</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
