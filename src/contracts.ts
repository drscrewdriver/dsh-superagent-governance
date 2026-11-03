/** Shared identifiers, statuses, and settings surface for the 鱼氏两官制 preset.
 *
 *  Two offices:
 *   - steward  (鱼总管): the main session's role. Entry point for chat,
 *     dispatches tasks to worker subagents, and receives 阁老 reports.
 *   - elder    (鱼阁老): a mechanical patrol that periodically scans subagents
 *     registered by steward and raises stuck reports.
 *
 *  Everything else (worker subagents launched via yu_dispatch) is treated as
 *  "runners" whose liveness the elder observes. Runner identity is dynamic,
 *  so it is not part of TANG_OFFICES-style enum.
 */

export const YU_OFFICES = ['steward', 'elder'] as const;
export type YuOffice = (typeof YU_OFFICES)[number];

export const YU_OFFICE_LABELS: Record<YuOffice, string> = {
  steward: '鱼总管',
  elder: '鱼阁老',
};

/** Settings namespace shared between host router and web controls. */
export const YU_SETTINGS_NAMESPACE = 'yu-governance';

/** Stable preset id installed by the bundle. */
export const YU_PRESET_ID = 'yu-governance';
export const YU_PRESET_DISPLAY_NAME = '鱼氏两官制（总管+阁老）';

/** Marker file to distinguish our managed preset from a user-authored one
 *  that happens to share the id (mirrors dsh-tang-governance's discipline). */
export const YU_MARKER_FILE = '.dsh-superagent-governance.json';

/** Lifecycle of a task that steward dispatched. */
export const YU_TASK_STATUSES = [
  'pending',
  'running',
  'idle',
  'stuck_suspect',
  'reported',
  'completed',
  'failed',
  'cancelled',
] as const;
export type YuTaskStatus = (typeof YU_TASK_STATUSES)[number];

/** One row in the patrol ledger. Persisted in-process only for MVP. */
export interface YuTaskRecord {
  readonly taskId: string;
  readonly parentSessionId: string;
  readonly title: string;
  readonly brief: string;
  readonly registeredAt: number;
  lastSeenAt: number;
  status: YuTaskStatus;
  /** Set once elder has already raised a stuck report; prevents spam. */
  reportedStuckAt?: number;
  /** Free-form reason recorded by steward when closing. */
  closeReason?: string;
}

/** What elder writes when it decides to notify steward. */
export interface YuStuckReport {
  readonly raisedAt: number;
  readonly taskId: string;
  readonly parentSessionId: string;
  readonly title: string;
  readonly lastSeenAt: number;
  readonly silentSeconds: number;
  readonly thresholdSeconds: number;
}

/** Settings keys registered under YU_SETTINGS_NAMESPACE. */
export const YU_SETTINGS_KEYS = {
  patrolIntervalSeconds: 'patrolIntervalSeconds',
  stuckThresholdSeconds: 'stuckThresholdSeconds',
  enabled: 'enabled',
  notifyStewardOnStuck: 'notifyStewardOnStuck',
} as const;

/** Defaults chosen conservatively: 5-min patrol, 15-min silence = stuck. */
export const YU_DEFAULTS = {
  patrolIntervalSeconds: 300,
  stuckThresholdSeconds: 900,
  enabled: true,
  notifyStewardOnStuck: true,
} as const;
