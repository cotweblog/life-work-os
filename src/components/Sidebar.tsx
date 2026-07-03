import { useApp } from "@/context/AppContext";

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const ALL_NAV = [
  { id: "dashboard", icon: "⊞", label: "Overview", modes: ["work", "personal"] },
  { id: "ai",        icon: "◈", label: "AI Assistant", modes: ["work", "personal"] },
  { id: "tasks",     icon: "✓", label: "Tasks",       modes: ["work", "personal"] },
  { id: "projects",  icon: "⬡", label: "Projects",    modes: ["work"] },
  { id: "matters",   icon: "◇", label: "Matters",     modes: ["work"] },
  { id: "calendar",  icon: "⊡", label: "Calendar",    modes: ["work", "personal"] },
  { id: "habits",    icon: "◎", label: "Habits",      modes: ["personal"] },
  { id: "journal",   icon: "✦", label: "Journal",     modes: ["personal"] },
];

export default function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const { viewMode, setViewMode } = useApp();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const nav = ALL_NAV.filter(item => item.modes.includes(viewMode));

  const handleModeSwitch = (mode: "work" | "personal") => {
    setViewMode(mode);
    const workOnly = new Set(["projects", "matters"]);
    const personalOnly = new Set(["habits", "journal"]);
    if (mode === "personal" && workOnly.has(activeView)) setActiveView("dashboard");
    if (mode === "work" && personalOnly.has(activeView)) setActiveView("dashboard");
  };

  return (
    <aside className="lo-sidebar">
      <div className="lo-sidebar-top">
        <div className="lo-sidebar-brand">
          <div className="lo-brand-icon">◈</div>
          <span className="lo-brand-name">Life OS</span>
        </div>
        <p className="lo-greeting">{greeting}</p>

        <div className="lo-mode-toggle">
          <button
            className={`lo-mode-btn ${viewMode === "work" ? "active" : ""}`}
            onClick={() => handleModeSwitch("work")}
          >Work</button>
          <button
            className={`lo-mode-btn ${viewMode === "personal" ? "active" : ""}`}
            onClick={() => handleModeSwitch("personal")}
          >Personal</button>
        </div>
      </div>

      <nav className="lo-sidebar-nav">
        {nav.map(item => (
          <button
            key={item.id}
            className={`lo-nav-item ${activeView === item.id ? "active" : ""}`}
            onClick={() => setActiveView(item.id)}
          >
            <span className="lo-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="lo-sidebar-footer">
        <div className="lo-date-display">
          {new Date().toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" })}
        </div>
      </div>
    </aside>
  );
}
