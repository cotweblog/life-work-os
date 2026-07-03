import { useState } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import Tasks from "@/pages/Tasks";
import Projects from "@/pages/Projects";
import Matters from "@/pages/Matters";
import Calendar from "@/pages/Calendar";
import Habits from "@/pages/Habits";
import AIAssistant from "@/pages/AIAssistant";
import Journal from "@/pages/Journal";

type View = "dashboard" | "tasks" | "projects" | "matters" | "calendar" | "habits" | "ai" | "journal";

function AppContent() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const { loading } = useApp();
  const navigate = (view: string) => setActiveView(view as View);

  const views: Record<View, JSX.Element> = {
    dashboard: <Dashboard setActiveView={navigate} />,
    tasks: <Tasks />,
    projects: <Projects />,
    matters: <Matters />,
    calendar: <Calendar />,
    habits: <Habits />,
    ai: <AIAssistant />,
    journal: <Journal />,
  };

  if (loading) {
    return (
      <div className="lo-app-loading">
        <div className="lo-loading-spinner" />
        <p>Loading your data…</p>
      </div>
    );
  }

  return (
    <div className="lo-app">
      <Sidebar activeView={activeView} setActiveView={navigate} />
      <main className="lo-main-content">
        {views[activeView]}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
