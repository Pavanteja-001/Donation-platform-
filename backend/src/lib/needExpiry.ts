import type { Need } from "@prisma/client";
import { NeedStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { assertTransition } from "./needLifecycle";

// PRD §7.4 / D-013: no scheduler/cron infra yet, so deadline expiry is checked lazily —
// whenever a Need is read, not on a timer. Called from every read path that returns a Need.
const EXPIRABLE_STATUSES: NeedStatus[] = [NeedStatus.LIVE, NeedStatus.PARTIALLY_FULFILLED];

export async function expireIfPastDeadline(need: Need): Promise<Need> {
  if (!need.deadline) return need;
  if (!EXPIRABLE_STATUSES.includes(need.status)) return need;
  if (need.deadline.getTime() > Date.now()) return need;

  assertTransition(need.status, NeedStatus.EXPIRED);
  return prisma.need.update({ where: { id: need.id }, data: { status: NeedStatus.EXPIRED } });
}

export async function expireManyIfPastDeadline(needs: Need[]): Promise<Need[]> {
  const now = new Date();
  const expiredNeedIds = needs
    .filter((n) => n.deadline && EXPIRABLE_STATUSES.includes(n.status) && n.deadline.getTime() <= now.getTime())
    .map((n) => n.id);

  if (expiredNeedIds.length > 0) {
    await prisma.need.updateMany({
      where: { id: { in: expiredNeedIds } },
      data: { status: NeedStatus.EXPIRED },
    });
    // Sync memory object statuses for the immediate response
    for (const need of needs) {
      if (expiredNeedIds.includes(need.id)) {
        need.status = NeedStatus.EXPIRED;
      }
    }
  }
  return needs;
}
