import { NeedStatus } from "@prisma/client";

// PRD §6.2 — the shared lifecycle graph. Every type follows this; only the fulfilment
// rule differs (§6.4), which later milestones layer on top when they move
// LIVE -> PARTIALLY_FULFILLED -> FULFILLED.
const ALLOWED_TRANSITIONS: Record<NeedStatus, NeedStatus[]> = {
  [NeedStatus.DRAFT]: [NeedStatus.PENDING_VERIFICATION, NeedStatus.CANCELLED],
  [NeedStatus.PENDING_VERIFICATION]: [NeedStatus.LIVE, NeedStatus.REJECTED, NeedStatus.CANCELLED],
  [NeedStatus.LIVE]: [NeedStatus.PARTIALLY_FULFILLED, NeedStatus.FULFILLED, NeedStatus.EXPIRED, NeedStatus.CANCELLED],
  [NeedStatus.PARTIALLY_FULFILLED]: [NeedStatus.FULFILLED, NeedStatus.EXPIRED, NeedStatus.CANCELLED],
  [NeedStatus.FULFILLED]: [],
  [NeedStatus.REJECTED]: [],
  // D-013 / PRD §7.4: an expired need can be re-submitted — back to DRAFT for editing
  // (e.g. pushing the deadline out), then through the normal submit flow again.
  [NeedStatus.EXPIRED]: [NeedStatus.DRAFT],
  [NeedStatus.CANCELLED]: [],
};

export class InvalidTransitionError extends Error {
  constructor(from: NeedStatus, to: NeedStatus) {
    super(`Cannot move a Need from ${from} to ${to}`);
  }
}

export function assertTransition(from: NeedStatus, to: NeedStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}
