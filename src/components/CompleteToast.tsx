import { useState, useRef, useEffect } from "react";
import { useApp } from "@/context/AppContext";

const AUTO_DISMISS_MS = 6000;

export default function CompleteToast({ taskId, taskText, onDismiss }: {
  taskId: number;
  taskText: string;
  onDismiss: () => void;
}) {
  const { addWait, today } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState(taskText);
  const [waitingOn, setWaitingOn] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };
  const armTimer = (ms: number) => {
    clearTimer();
    timerRef.current = setTimeout(onDismiss, ms);
  };

  useEffect(() => {
    armTimer(AUTO_DISMISS_MS);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!description.trim()) return;
    await addWait(taskId, { description: description.trim(), waitingOn, sentDate: today });
    onDismiss();
  };

  return (
    <div
      className="lo-toast"
      onMouseEnter={clearTimer}
      onMouseLeave={() => armTimer(2500)}
    >
      {!expanded ? (
        <>
          <span className="lo-toast-text">✓ Marked complete — waiting on someone?</span>
          <button className="lo-toast-action" onClick={() => { clearTimer(); setExpanded(true); }}>Add</button>
          <button className="lo-toast-close" onClick={onDismiss}>×</button>
        </>
      ) : (
        <div className="lo-toast-form">
          <input
            placeholder="What's outstanding…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            autoFocus
          />
          <input
            placeholder="Who / where"
            value={waitingOn}
            onChange={e => setWaitingOn(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
          />
          <div className="lo-toast-form-btns">
            <button className="lo-btn lo-btn-primary lo-btn-sm" onClick={handleSave} disabled={!description.trim()}>Save</button>
            <button className="lo-btn lo-btn-ghost lo-btn-sm" onClick={onDismiss}>Skip</button>
          </div>
        </div>
      )}
    </div>
  );
}
