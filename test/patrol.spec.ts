import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeTask,
  get as getTask,
  listAll,
  listOpen,
  registerTask,
  touchTask,
  __resetForTest as resetLedger,
} from '../src/ledger.ts';
import {
  drainInbox,
  peekInbox,
  runOnce,
  __resetForTest as resetPatrol,
} from '../src/patrol.ts';

beforeEach(() => {
  resetLedger();
  resetPatrol();
});

afterEach(() => {
  resetLedger();
  resetPatrol();
});

describe('ledger', () => {
  it('registers a task and appears in listOpen', () => {
    const record = registerTask({ parentSessionId: 's1', title: 'T', brief: 'B' });
    expect(record.status).toBe('pending');
    expect(getTask(record.taskId)?.title).toBe('T');
    expect(listOpen().length).toBe(1);
  });

  it('touch updates lastSeenAt and status', async () => {
    const record = registerTask({ parentSessionId: 's1', title: 'T', brief: 'B' });
    const before = record.lastSeenAt;
    await new Promise(r => setTimeout(r, 5));
    const updated = touchTask(record.taskId, 'running');
    expect(updated?.status).toBe('running');
    expect(updated!.lastSeenAt).toBeGreaterThan(before);
  });

  it('closeTask removes from open list', () => {
    const record = registerTask({ parentSessionId: 's1', title: 'T', brief: 'B' });
    closeTask(record.taskId, 'completed', 'done');
    expect(listOpen().length).toBe(0);
    expect(listAll().length).toBe(1);
  });

  it('returns undefined for unknown task', () => {
    expect(touchTask('missing')).toBeUndefined();
    expect(closeTask('missing', 'failed')).toBeUndefined();
  });
});

describe('patrol (鱼阁老)', () => {
  it('does nothing when no tasks are open', () => {
    const newly = runOnce(10, Date.now());
    expect(newly).toEqual([]);
  });

  it('raises a stuck report when silence exceeds threshold', () => {
    const record = registerTask({ parentSessionId: 's1', title: 'T', brief: 'B' });
    // Simulate an old lastSeenAt
    (record as { lastSeenAt: number }).lastSeenAt = Date.now() - 30_000;
    const newly = runOnce(10, Date.now());
    expect(newly.length).toBe(1);
    expect(newly[0].taskId).toBe(record.taskId);
    expect(newly[0].silentSeconds).toBeGreaterThanOrEqual(10);
    expect(peekInbox().length).toBe(1);
  });

  it('does not double-report the same task', () => {
    const record = registerTask({ parentSessionId: 's1', title: 'T', brief: 'B' });
    (record as { lastSeenAt: number }).lastSeenAt = Date.now() - 30_000;
    runOnce(10, Date.now());
    const second = runOnce(10, Date.now());
    expect(second.length).toBe(0);
  });

  it('drainInbox clears the queue', () => {
    const record = registerTask({ parentSessionId: 's1', title: 'T', brief: 'B' });
    (record as { lastSeenAt: number }).lastSeenAt = Date.now() - 30_000;
    runOnce(10, Date.now());
    expect(drainInbox().length).toBe(1);
    expect(drainInbox().length).toBe(0);
  });

  it('touch resets the silence window', () => {
    const record = registerTask({ parentSessionId: 's1', title: 'T', brief: 'B' });
    (record as { lastSeenAt: number }).lastSeenAt = Date.now() - 30_000;
    touchTask(record.taskId);
    const newly = runOnce(10, Date.now());
    expect(newly.length).toBe(0);
  });
});
