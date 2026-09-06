import { useCallback, useRef } from "react";

type GameAudioCue = "card" | "success" | "warning" | "trade";

const frequencies: Record<GameAudioCue, number> = { card: 420, success: 660, warning: 180, trade: 520 };

export function useGameAudio() {
  const contextRef = useRef<AudioContext | null>(null);
  return useCallback((cue: GameAudioCue) => {
    if (typeof window === "undefined") return;
    const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = contextRef.current ?? new Context();
    contextRef.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = cue === "warning" ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(frequencies[cue], context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.13);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
  }, []);
}
