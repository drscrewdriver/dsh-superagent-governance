/** 鱼阁老：mechanical patrol.
 *
 *  Runs in the host bundle process via setInterval. It does NOT invoke a
 *  model per tick (that would burn tokens on a no-op). Instead it scans the
 *  ledger for open tasks whose lastSeenAt is older than the threshold and
 *  pushes a YuStuckReport into an in-process inbox that steward drains via
 *  the `yu_poll_inbox` tool. A real push into the steward session (via a
 *  subagent followup or trigger message) is a v0.0.3 concern once the host
 *  notify API surface is pinned; see issue #2.
 */
import type { YuStuckReport } from './contracts.ts';
import { listOpen, markReported, markStuck } from './ledger.ts';

const inbox: YuStuckReport[] = [];
let timer: NodeJS.Timeout | undefined;

export interface PatrolOptions {
  readonly intervalSeconds: number;
  readonly stuckThresholdSeconds: number;
  readonly onCycle?: (scanned: number, newlyStuck: YuStuckReport[]) => void;
}

/** One mechanical pass. Exported for tests and for the on-demand tool. */
export function runOnce(thresholdSeconds: number, now: number = Date.now()): YuStuckReport[] {
  const found: YuStuckReport[] = [];
  for (const task of listOpen()) {
    if (task.reportedStuckAt !== undefined) continue; // already raised once
    const silentSeconds = Math.floor((now - task.lastSeenAt) / 1000);
    if (silentSeconds < thresholdSeconds) continue;
    markStuck(task.taskId);
    const report: YuStuckReport = {
      raisedAt: now,
      taskId: task.taskId,
      parentSessionId: task.parentSessionId,
      title: task.title,
      lastSeenAt: task.lastSeenAt,
      silentSeconds,
      thresholdSeconds,
    };
    markReported(task.taskId, now);
    found.push(report);
  }
  if (found.length > 0) inbox.push(...found);
  return found;
}

/** Drain pending reports. Called by steward's `yu_poll_inbox` tool. */
export function drainInbox(): YuStuckReport[] {
  if (inbox.length === 0) return [];
  const snapshot = inbox.slice();
  inbox.length = 0;
  return snapshot;
}

/** Peek without consuming (diagnostics / panel). */
export function peekInbox(): readonly YuStuckReport[] {
  return inbox.slice();
}

export function start(opts: PatrolOptions): void {
  stop();
  if (opts.intervalSeconds <= 0) return;
  const ms = Math.max(30_000, opts.intervalSeconds * 1000);
  const tick = () => {
    try {
      const newly = runOnce(opts.stuckThresholdSeconds);
      opts.onCycle?.(listOpen().length, newly);
    } catch (error) {
      // Never let a scan failure kill the process. Log and continue.
      // eslint-disable-next-line no-console
      console.error('[yu-patrol] cycle failed', error);
    }
  };
  timer = setInterval(tick, ms);
  // Allow Node to exit even if interval is still scheduled.
  if (typeof timer.unref === 'function') timer.unref();
}

export function stop(): void {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
}

/** Test-only: clear accumulated inbox entries. */
export function __resetForTest(): void {
  inbox.length = 0;
  stop();
}
