import { useEffect, useReducer } from "react";
import { MODERN_DAILY_MODES } from "@shared/dailyModes";
import { getDailyModeStorageKey, MysteryStateSchema, type DailyStorageScope, type MysteryPersistedState } from "@/lib/dailyStorage";

type Action =
  | { type: "HYDRATE"; payload: MysteryPersistedState }
  | { type: "TICK" }
  | { type: "REVEAL_WORD"; payload: { index: number; manual: boolean } }
  | { type: "REVEAL_BONUS_HINT"; payload: string }
  | { type: "SUBMIT_ATTEMPT"; payload: { word: string; isCorrect: boolean } }
  | { type: "SET_SUBMITTING"; payload: boolean };

const initialState: MysteryPersistedState = { revealedIndices: [0], revealedBonusHints: [], attempts: [], elapsedSeconds: 0, status: "PLAYING", score: MODERN_DAILY_MODES.mystery.initialScore, isSuccess: false };

function reducer(state: MysteryPersistedState, action: Action): MysteryPersistedState {
  switch (action.type) {
    case "HYDRATE": return action.payload;
    case "TICK": return state.status === "PLAYING" ? { ...state, elapsedSeconds: state.elapsedSeconds + 1, score: Math.max(0, state.score - MODERN_DAILY_MODES.mystery.penaltyPerSecond) } : state;
    case "REVEAL_WORD": {
      if (state.revealedIndices.includes(action.payload.index)) return state;
      return { ...state, revealedIndices: [...state.revealedIndices, action.payload.index], score: Math.max(0, state.score - (action.payload.manual ? MODERN_DAILY_MODES.mystery.manualRevealCost : 0)) };
    }
    case "REVEAL_BONUS_HINT": return state.revealedBonusHints.includes(action.payload) ? state : { ...state, revealedBonusHints: [...state.revealedBonusHints, action.payload], score: Math.max(0, state.score - MODERN_DAILY_MODES.mystery.bonusHintCost) };
    case "SET_SUBMITTING": return { ...state, status: action.payload ? "SUBMITTING" : "PLAYING" };
    case "SUBMIT_ATTEMPT": {
      const attempts = [...state.attempts, { word: action.payload.word, outcome: action.payload.isCorrect ? "correct" as const : "incorrect" as const, timestamp: Date.now() }];
      return action.payload.isCorrect ? { ...state, attempts, status: "FINISHED", isSuccess: true } : { ...state, attempts, status: "PLAYING", score: Math.max(0, state.score - MODERN_DAILY_MODES.mystery.penaltyPerWrongGuess) };
    }
  }
}

export function useMysteryGame(scope: DailyStorageScope = "daily", resetToken = 0) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const storageKey = getDailyModeStorageKey("mystery", scope);
  useEffect(() => { try { const raw = window.localStorage.getItem(storageKey); if (raw) dispatch({ type: "HYDRATE", payload: MysteryStateSchema.parse(JSON.parse(raw)) }); } catch { window.localStorage.removeItem(storageKey); } }, [storageKey]);
  useEffect(() => { if (!resetToken) return; try { window.localStorage.removeItem(storageKey); } catch { /* stockage facultatif */ } dispatch({ type: "HYDRATE", payload: initialState }); }, [resetToken, storageKey]);
  useEffect(() => { try { window.localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* stockage facultatif */ } }, [state, storageKey]);
  useEffect(() => { if (state.status !== "PLAYING") return; const timer = window.setInterval(() => dispatch({ type: "TICK" }), 1_000); return () => window.clearInterval(timer); }, [state.status]);
  return { state, dispatch };
}
