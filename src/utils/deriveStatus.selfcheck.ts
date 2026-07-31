/**
 * Runnable self-check for deriveStatus (schema.md §5 invariants).
 * No test framework needed — plain assertions, run via:
 *   npx tsc --module commonjs --target es2019 --esModuleInterop --outDir .selfcheck-build src/utils/deriveStatus.ts src/utils/deriveStatus.selfcheck.ts
 *   node .selfcheck-build/utils/deriveStatus.selfcheck.js
 */
import { deriveStatus } from './deriveStatus';

function assertStrictEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message} (expected ${expected}, got ${actual})`);
  }
}
const assert = { strictEqual: assertStrictEqual };

const NOW = new Date('2026-07-31T12:00:00.000Z');

// locked: openDate in the future, never opened
assert.strictEqual(
  deriveStatus(null, '2026-08-15T00:00:00.000Z', NOW),
  'locked',
  'future openDate + not opened => locked'
);

// ready: openDate exactly now
assert.strictEqual(
  deriveStatus(null, '2026-07-31T12:00:00.000Z', NOW),
  'ready',
  'openDate == now => ready (boundary inclusive)'
);

// ready: openDate in the past
assert.strictEqual(
  deriveStatus(null, '2026-01-01T00:00:00.000Z', NOW),
  'ready',
  'past openDate + not opened => ready'
);

// opened: openedAt set, regardless of openDate being in the future
assert.strictEqual(
  deriveStatus('2026-07-30T00:00:00.000Z', '2026-08-15T00:00:00.000Z', NOW),
  'opened',
  'openedAt set => opened even if openDate is still ahead of now'
);

// Reliability NFR: system clock rolled back after opening must NOT un-open the capsule.
const clockRolledBack = new Date('2020-01-01T00:00:00.000Z');
assert.strictEqual(
  deriveStatus('2019-06-01T00:00:00.000Z', '2026-08-15T00:00:00.000Z', clockRolledBack),
  'opened',
  'opened stays opened even if now is moved into the past relative to openDate'
);

console.log('deriveStatus selfcheck: all assertions passed');
