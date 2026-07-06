interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const NAV = [
  { id: "dashboard", icon: "⊞", label: "Overview" },
  { id: "ai",        icon: "◈", label: "AI Assistant" },
  { id: "tasks",     icon: "✓", label: "Tasks" },
  { id: "matters",   icon: "◇", label: "Matters" },
  { id: "calendar",  icon: "⊡", label: "Calendar" },
  { id: "habits",    icon: "◎", label: "Habits" },
  { id: "journal",   icon: "✦", label: "Journal" },
];

export default function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <aside className="lo-sidebar">
      <div className="lo-sidebar-top">
        <div className="lo-sidebar-brand">
          <div className="lo-brand-icon">◈</div>
          <span className="lo-brand-name">Life OS</span>
        </div>
        <p className="lo-greeting">{greeting}</p>
      </div>

      <nav className="lo-sidebar-nav">
        {NAV.map(item => (
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
