import { useCallback, useEffect, useState } from "react";

type SavedDailySession = { isFinished: boolean; score?: number; date?: string };

function createUuid() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return "00000000-0000-4000-8000-000000000001";
}

function restore(storageKey: string) {
  try {
    const completed = JSON.parse(localStorage.getItem(storageKey) ?? "null") as SavedDailySession | null;
    const sessionKey = `${storageKey}:session`;
    const sessionId = localStorage.getItem(sessionKey) ?? createUuid();
    localStorage.setItem(sessionKey, sessionId);
    return { sessionId, completion: completed?.isFinished ? completed : null };
  } catch {
    return { sessionId: createUuid(), completion: null as SavedDailySession | null };
  }
}

export function useDailySession(storageKey: string, date: string) {
  const [state, setState] = useState(() => restore(storageKey));
  useEffect(() => setState(restore(storageKey)), [storageKey]);
  const finish = useCallback((score: number) => {
    const completion = { isFinished: true, score, date };
    setState((current) => ({ ...current, completion }));
    try { localStorage.setItem(storageKey, JSON.stringify(completion)); } catch { /* stockage facultatif */ }
  }, [date, storageKey]);
  const restart = useCallback(() => {
    const sessionId = createUuid();
    setState({ sessionId, completion: null });
    try { localStorage.removeItem(storageKey); localStorage.setItem(`${storageKey}:session`, sessionId); } catch { /* stockage facultatif */ }
  }, [storageKey]);
  return { sessionId: state.sessionId, completion: state.completion, isFinished: Boolean(state.completion?.isFinished), finish, restart };
}
