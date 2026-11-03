/** In-process ledger of tasks steward dispatched + last-activity timestamps.
 *
 *  MVP: purely in-memory (Map<taskId, YuTaskRecord>). Persisting to a JSON
 *  file under the profile's state dir is a v0.0.3 concern.
 */
import { randomUUID } from 'node:crypto';
import type { YuTaskRecord, YuTaskStatus } from './contracts.ts';

const ledger = new Map<string, YuTaskRecord>();

export interface RegisterTaskInput {
  readonly parentSessionId: string;
  readonly title: string;
  readonly brief: string;
}

export function registerTask(input: RegisterTaskInput): YuTaskRecord {
  const now = Date.now();
  const record: YuTaskRecord = {
    taskId: randomUUID(),
    parentSessionId: input.parentSessionId,
    title: input.title,
    brief: input.brief,
    registeredAt: now,
    lastSeenAt: now,
    status: 'pending',
  };
  ledger.set(record.taskId, record);
  return record;
}

export function touchTask(taskId: string, status?: YuTaskStatus): YuTaskRecord | undefined {
  const current = ledger.get(taskId);
  if (current === undefined) return undefined;
  const updated: YuTaskRecord = {
    ...current,
    lastSeenAt: Date.now(),
    ...(status === undefined ? {} : { status }),
  };
  ledger.set(taskId, updated);
  return updated;
}

export function markStuck(taskId: string): YuTaskRecord | undefined {
  return touchTask(taskId, 'stuck_suspect');
}

export function markReported(taskId: string, raisedAt: number): YuTaskRecord | undefined {
  const current = ledger.get(taskId);
  if (current === undefined) return undefined;
  const updated: YuTaskRecord = { ...current, status: 'reported', reportedStuckAt: raisedAt };
  ledger.set(taskId, updated);
  return updated;
}

export function closeTask(taskId: string, status: YuTaskStatus, reason?: string): YuTaskRecord | undefined {
  const current = ledger.get(taskId);
  if (current === undefined) return undefined;
  const updated: YuTaskRecord = {
    ...current,
    status,
    ...(reason === undefined ? {} : { closeReason: reason }),
    lastSeenAt: Date.now(),
  };
  ledger.set(taskId, updated);
  return updated;
}

export function listAll(): readonly YuTaskRecord[] {
  return [...ledger.values()];
}

export function listOpen(): readonly YuTaskRecord[] {
  return [...ledger.values()].filter(t =>
    t.status === 'pending' || t.status === 'running' || t.status === 'idle'
    || t.status === 'stuck_suspect' || t.status === 'reported',
  );
}

export function get(taskId: string): YuTaskRecord | undefined {
  return ledger.get(taskId);
}

/** Test-only reset. Never invoked from production paths. */
export function __resetForTest(): void {
  ledger.clear();
}
