import { useEffect, useState } from "react";
import type { SeasonMatch } from "@/types/seasonMatch.types";
import { formatMatchClock } from "@/utils/matchTiming";

/** Local visual ticker driven by the Match's last server-provided clock segment. */
export function MatchClockTicker({ match }: { match: SeasonMatch }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!match.clock.isRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [match.clock.isRunning]);

  return <>{formatMatchClock(match, now)}</>;
}
