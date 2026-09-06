import { useEffect, useReducer } from "react";
import { MODERN_DAILY_MODES } from "@shared/dailyModes";
import { AuctionStateSchema, getDailyModeStorageKey, type AuctionPersistedState, type DailyStorageScope } from "@/lib/dailyStorage";

type Action =
  | { type: "HYDRATE"; payload: AuctionPersistedState }
  | { type: "REVEAL_LENGTH"; payload: { cost: number } }
  | { type: "BUY_LETTER"; payload: { position: number; letter: string; cost: number } }
  | { type: "SUBMIT_ATTEMPT"; payload: { isCorrect: boolean; score?: number } };

const initialState: AuctionPersistedState = { budget: MODERN_DAILY_MODES.auction.startingCapital, revealedPositions: {}, isLengthRevealed: false, attemptsRemaining: 3, isBankrupt: false, status: "PLAYING", score: 0 };

function reducer(state: AuctionPersistedState, action: Action): AuctionPersistedState {
  switch (action.type) {
    case "HYDRATE": return action.payload;
    case "REVEAL_LENGTH": {
      if (state.isLengthRevealed) return state;
      const budget = Math.max(0, state.budget - action.payload.cost);
      return { ...state, budget, isLengthRevealed: true, isBankrupt: budget === 0, attemptsRemaining: budget === 0 ? 1 : state.attemptsRemaining };
    }
    case "BUY_LETTER": {
      if (state.revealedPositions[action.payload.position]) return state;
      const budget = Math.max(0, state.budget - action.payload.cost);
      return { ...state, budget, revealedPositions: { ...state.revealedPositions, [action.payload.position]: action.payload.letter }, isBankrupt: budget === 0, attemptsRemaining: budget === 0 ? 1 : state.attemptsRemaining };
    }
    case "SUBMIT_ATTEMPT": {
      if (action.payload.isCorrect) return { ...state, status: "FINISHED", score: action.payload.score ?? state.budget * 10 };
      const attemptsRemaining = Math.max(0, state.attemptsRemaining - 1);
      return { ...state, attemptsRemaining, status: attemptsRemaining ? "PLAYING" : "FINISHED" };
    }
  }
}

export function useAuctionGame(scope: DailyStorageScope = "daily", resetToken = 0) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const storageKey = getDailyModeStorageKey("auction", scope);
  useEffect(() => { try { const raw = window.localStorage.getItem(storageKey); if (raw) dispatch({ type: "HYDRATE", payload: AuctionStateSchema.parse(JSON.parse(raw)) }); } catch { window.localStorage.removeItem(storageKey); } }, [storageKey]);
  useEffect(() => { if (!resetToken) return; try { window.localStorage.removeItem(storageKey); } catch { /* stockage facultatif */ } dispatch({ type: "HYDRATE", payload: initialState }); }, [resetToken, storageKey]);
  useEffect(() => { try { window.localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* stockage facultatif */ } }, [state, storageKey]);
  return { state, dispatch };
}
