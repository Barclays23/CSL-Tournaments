import { AppError } from "../../shared/errors/appError.js";
import type { SeasonMatchStatus } from "./seasonMatch.types.js";

export const MATCH_STATUS_TRANSITIONS: Readonly<Record<SeasonMatchStatus, readonly SeasonMatchStatus[]>> = {
  scheduled: ["live", "postponed", "cancelled"],
  live: ["completed", "scheduled", "postponed", "abandoned"],
  postponed: ["scheduled", "cancelled"],
  completed: [],
  cancelled: [],
  abandoned: [],
};

const MATCH_STATUS_LABELS: Record<SeasonMatchStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  postponed: "Postponed",
  cancelled: "Cancelled",
  abandoned: "Abandoned",
};

/**
 * A same-status update is a no-op, not a state transition.
 */
export function isAllowedMatchStatusTransition(
  currentStatus: SeasonMatchStatus,
  nextStatus: SeasonMatchStatus,
): boolean {
  return currentStatus === nextStatus || MATCH_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

/**
 * Central guard for every normal match-status change.
 * Completed-result correction and reopening final statuses are intentionally outside this rule.
 */
export function assertMatchStatusTransition(
  currentStatus: SeasonMatchStatus,
  nextStatus: SeasonMatchStatus,
): void {
  if (isAllowedMatchStatusTransition(currentStatus, nextStatus)) return;

  const currentLabel = MATCH_STATUS_LABELS[currentStatus];
  const nextLabel = MATCH_STATUS_LABELS[nextStatus];

  let message: string;
  if (currentStatus === "completed") {
    message = "Completed matches cannot have their status changed through the normal match update API.";
  } else if (currentStatus === "cancelled") {
    message = "Cancelled matches are final and cannot be reopened or changed to another status.";
  } else if (currentStatus === "abandoned") {
    message = "Abandoned matches are final and cannot be reopened or changed to another status.";
  } else {
    const allowed = MATCH_STATUS_TRANSITIONS[currentStatus]
      .map((status) => MATCH_STATUS_LABELS[status])
      .join(", ");
    message = `Cannot change match status from ${currentLabel} to ${nextLabel}. Allowed next statuses: ${allowed}.`;
  }

  throw new AppError(message, 409, "INVALID_MATCH_STATUS_TRANSITION", {
    status: message,
  });
}
