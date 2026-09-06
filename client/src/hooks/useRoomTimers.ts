import { useEffect, useMemo, useState } from "react";
import { getRoundCountdownRemaining } from "@/lib/roundCountdown";

export interface RoomTimerRound {
  id?: number;
  status?: string;
  startedAt?: Date | string | null;
  endsAt?: Date | string | null;
  incomingFog?: { endsAt?: Date | string | null } | null;
  peek?: { endsAt?: Date | string | null } | null;
}

export interface RoomTimers {
  now: number;
  timerMilliseconds: number | null;
  countdownMilliseconds: number;
  fogMilliseconds: number;
  peekMilliseconds: number;
}

function getMilliseconds(value?: Date | string | null, now = Date.now()) {
  return value ? Math.max(0, new Date(value).getTime() - now) : 0;
}

export function getRoomTimerSnapshot(round: RoomTimerRound | null | undefined, now = Date.now()) {
  const countdownMilliseconds = getRoundCountdownRemaining(round?.startedAt, now);
  return {
    timerMilliseconds: round?.endsAt ? Math.max(0, getMilliseconds(round.endsAt, now) - countdownMilliseconds) : null,
    countdownMilliseconds,
    fogMilliseconds: getMilliseconds(round?.incomingFog?.endsAt, now),
    peekMilliseconds: getMilliseconds(round?.peek?.endsAt, now),
  };
}

export function useRoomTimers(round?: RoomTimerRound | null): RoomTimers {
  const [now, setNow] = useState(() => Date.now());
  const active = round?.status === "active";
  const hasSecondPrecision = Boolean(active && (round?.endsAt || round?.incomingFog?.endsAt || round?.peek?.endsAt));
  const hasCountdown = active && getRoundCountdownRemaining(round?.startedAt) > 0;

  useEffect(() => {
    if (!hasSecondPrecision && !hasCountdown) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), hasCountdown ? 100 : 1_000);
    return () => window.clearInterval(interval);
  }, [hasCountdown, hasSecondPrecision, round?.id]);

  return useMemo(() => ({ now, ...getRoomTimerSnapshot(round, now) }), [now, round?.endsAt, round?.incomingFog?.endsAt, round?.peek?.endsAt, round?.startedAt]);
}
