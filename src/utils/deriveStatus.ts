import type { CapsuleStatus } from '../types/capsule';

/**
 * Pure, side-effect-free lifecycle derivation — schema.md §5.
 *
 * Rules (Reliability NFR):
 * - `openedAt` is an immutable fact: once a capsule has been opened, it stays
 *   'opened' forever, even if the system clock is later moved into the past.
 * - Only the locked -> ready transition depends on `now`, and must be
 *   re-evaluated every time (e.g. on screen focus), never cached/persisted.
 *
 * @param openedAt ISO 8601 string, or null if never opened.
 * @param openDate ISO 8601 string — the date the capsule becomes openable.
 * @param now Current time. Defaults to `new Date()`; pass explicitly in tests.
 */
export function deriveStatus(
  openedAt: string | null,
  openDate: string,
  now: Date = new Date()
): CapsuleStatus {
  if (openedAt != null) {
    return 'opened';
  }
  if (now.getTime() >= new Date(openDate).getTime()) {
    return 'ready';
  }
  return 'locked';
}
