export type MotusFeedbackKind = "typing" | "near" | "miss" | "win" | "error";

export type MotusFeedback = {
  notes: number[];
  vibration: number | number[];
};

const FEEDBACK: Record<MotusFeedbackKind, MotusFeedback> = {
  typing: { notes: [520], vibration: 4 },
  near: { notes: [392], vibration: 8 },
  miss: { notes: [210], vibration: 18 },
  win: { notes: [523, 659, 784], vibration: [12, 35, 20] },
  error: { notes: [], vibration: 20 },
};

export function getMotusFeedback(kind: MotusFeedbackKind): MotusFeedback {
  return FEEDBACK[kind];
}
