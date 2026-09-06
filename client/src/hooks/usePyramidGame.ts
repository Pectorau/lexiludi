import { useEffect, useReducer } from "react";
import { MODERN_DAILY_MODES } from "@shared/dailyModes";
import { getDailyModeStorageKey, PyramidStateSchema, type DailyStorageScope, type PyramidPersistedState } from "@/lib/dailyStorage";

type Action =
  | { type: "HYDRATE"; payload: PyramidPersistedState }
  | { type: "VALIDATE_STEP"; payload: { word: string; points: number } }
  | { type: "USE_REROLL" }
  | { type: "USE_SHUFFLE" };

const initialState: PyramidPersistedState = { currentLevel: MODERN_DAILY_MODES.pyramid.minWordLength, solvedWords: [], rerollUsed: false, usedShuffleAid: false, status: "PLAYING", score: 0 };

function reducer(state: PyramidPersistedState, action: Action): PyramidPersistedState {
  switch (action.type) {
    case "HYDRATE": return action.payload;
    case "USE_REROLL": return { ...state, rerollUsed: true };
    case "USE_SHUFFLE": return { ...state, usedShuffleAid: true };
    case "VALIDATE_STEP": {
      const currentLevel = state.currentLevel + 1;
      return { ...state, currentLevel, solvedWords: [...state.solvedWords, action.payload.word], score: state.score + action.payload.points, status: currentLevel > MODERN_DAILY_MODES.pyramid.maxWordLength ? "FINISHED" : "PLAYING" };
    }
  }
}

export function validateSubWordAddition(previousWord: string, nextWord: string): boolean {
  if (nextWord.length !== previousWord.length + 1) return false;
  const remaining = nextWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("fr-FR").split("");
  return previousWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("fr-FR").split("").every((letter) => { const index = remaining.indexOf(letter); if (index < 0) return false; remaining.splice(index, 1); return true; }) && remaining.length === 1;
}

export function usePyramidGame(scope: DailyStorageScope = "daily") {
  const [state, dispatch] = useReducer(reducer, initialState);
  const storageKey = getDailyModeStorageKey("pyramid", scope);
  useEffect(() => { try { const raw = window.localStorage.getItem(storageKey); if (raw) dispatch({ type: "HYDRATE", payload: PyramidStateSchema.parse(JSON.parse(raw)) }); } catch { window.localStorage.removeItem(storageKey); } }, [storageKey]);
  useEffect(() => { try { window.localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* stockage facultatif */ } }, [state, storageKey]);
  const restart = () => { try { window.localStorage.removeItem(storageKey); } catch { /* stockage facultatif */ } dispatch({ type: "HYDRATE", payload: initialState }); };
  return { state, dispatch, restart };
}
