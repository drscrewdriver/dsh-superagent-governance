/** Host half: registers 鱼总管 tools, settings, and starts the 鱼阁老 patrol.
 *
 *  Tool list (all are steward-side; the elder is a mechanical timer, not an LLM):
 *   - yu_dispatch       Register a task for a worker subagent. The steward must then
 *                       invoke DSH's native `dispatch_subagent` tool to actually launch
 *                       the worker, and call yu_touch to update liveness.
 *   - yu_touch          Update a task's last-seen timestamp (and optionally status).
 *   - yu_list_active    List currently open (or all) tracked tasks.
 *   - yu_poll_inbox     Drain stuck reports raised by the elder.
 *   - yu_close_task     Mark a task as completed / failed / cancelled with a reason.
 *   - yu_patrol_now     Force an immediate patrol scan (for debug / user-triggered check).
 *
 *  The patrol is a plain `setInterval` inside the bundle process (mirrors the
 *  polling mechanism used by deepseek-ai/dsh-superagent-prototype). It does
 *  NOT spawn an LLM turn per tick; only when the mechanical scan produces a
 *  stuck report does the steward see anything. Pushing the report into the
 *  steward session as an inbound trigger is a v0.0.3 concern.
 */
import { z } from '@deepseek-ai/schemastery';
import type { Context } from '@deepseek-ai/cordis';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';

import {
  YU_DEFAULTS,
  YU_SETTINGS_KEYS,
  YU_SETTINGS_NAMESPACE,
  YU_TASK_STATUSES,
  type YuStuckReport,
  type YuTaskStatus,
} from './contracts.ts';
import {
  closeTask,
  get as getTask,
  listAll,
  listOpen,
  registerTask,
  touchTask,
} from './ledger.ts';
import {
  drainInbox,
  peekInbox,
  runOnce,
  start as startPatrol,
  stop as stopPatrol,
} from './patrol.ts';

export const name = 'yu-governance-tool';
export const inject = ['tools', 'settings', 'agent'];

export interface Config {
  readonly patrolIntervalSeconds?: number;
  readonly stuckThresholdSeconds?: number;
  readonly enabled?: boolean;
  readonly notifyStewardOnStuck?: boolean;
}

const SettingsSchema: z<Config> = z.object({
  [YU_SETTINGS_KEYS.patrolIntervalSeconds]: z
    .nat()
    .default(YU_DEFAULTS.patrolIntervalSeconds)
    .describe('鱼阁老巡检周期（秒），最小 30 秒'),
  [YU_SETTINGS_KEYS.stuckThresholdSeconds]: z
    .nat()
    .default(YU_DEFAULTS.stuckThresholdSeconds)
    .describe('subagent 无活动超过该秒数即视为疑似卡死'),
  [YU_SETTINGS_KEYS.enabled]: z
    .boolean()
    .default(YU_DEFAULTS.enabled)
    .describe('是否启用鱼阁老定时巡检'),
  [YU_SETTINGS_KEYS.notifyStewardOnStuck]: z
    .boolean()
    .default(YU_DEFAULTS.notifyStewardOnStuck)
    .describe('发现 stuck 任务时是否推送至鱼总管（v0.0.3 起生效，MVP 由 yu_poll_inbox 主动拉取）'),
});

/** Best-effort extraction of the current agent session id across DSH rc lines. */
function readSessionId(toolCtx: unknown): string | undefined {
  const c = toolCtx as any;
  return (
    (typeof c?.session?.id === 'string' && c.session.id) ||
    (typeof c?.sessionId === 'string' && c.sessionId) ||
    (typeof c?.session_id === 'string' && c.session_id) ||
    (typeof c?.agent?.sessionId === 'string' && c.agent.sessionId) ||
    (typeof c?.agent?.session?.id === 'string' && c.agent.session.id) ||
    undefined
  );
}

export async function apply(ctx: Context, config: Config): Promise<void> {
  const ns = settingsNamespace(YU_SETTINGS_NAMESPACE);
  ctx.settings.register(ns, SettingsSchema as any);

  const interval = clamp(config.patrolIntervalSeconds, 30, 86_400, YU_DEFAULTS.patrolIntervalSeconds);
  const threshold = clamp(config.stuckThresholdSeconds, 60, 86_400, YU_DEFAULTS.stuckThresholdSeconds);
  const enabled = config.enabled ?? YU_DEFAULTS.enabled;

  if (enabled) {
    startPatrol({
      intervalSeconds: interval,
      stuckThresholdSeconds: threshold,
      onCycle: (scanned, newly) => {
        if (scanned === 0 && newly.length === 0) return;
        ctx.logger.info(
          `[yu-patrol] tick: scanned=${scanned} newly_stuck=${newly.length} interval=${interval}s threshold=${threshold}s`,
        );
      },
    });
  } else {
    stopPatrol();
  }

  ctx.dispose += () => stopPatrol();

  // ---- Tools ----
  ctx.tools.register({
    name: 'yu_dispatch',
    description:
      '鱼总管：登记一条要交给 worker 的任务，返回 taskId。随后请调用 DSH 原生 dispatch_subagent 实际拉起 worker，并在 worker 反馈时调用 yu_touch 刷新时间戳。',
    parameters: {
      title: z.string().min(1).max(200).describe('简短标题（<=200 字符，用于日志/面板展示）'),
      brief: z.string().min(1).describe('给 worker 的完整任务简述：目标 / 约束 / 验收标准'),
    },
    handler: async (params: { title: string; brief: string }, toolCtx: unknown) => {
      const parentSessionId = readSessionId(toolCtx);
      if (parentSessionId === undefined) {
        ctx.logger.warn('[yu-governance] yu_dispatch 无法读取 sessionId，已拒绝登记');
        return { ok: false, error: 'missing-session-id' };
      }
      const record = registerTask({
        parentSessionId,
        title: params.title.trim(),
        brief: params.brief,
      });
      return {
        ok: true,
        taskId: record.taskId,
        instruction:
          `请立即调用原生 dispatch_subagent 拉起 worker 执行本任务；worker 反馈时调用 ` +
          `yu_touch(task_id="${record.taskId}", status="running"|"idle"|"completed"|"failed") 更新时间戳。`,
      };
    },
  } as any);

  ctx.tools.register({
    name: 'yu_touch',
    description: '鱼总管：刷新某条任务的活动时间戳（可选带 status）。巡检据此判断是否卡死。',
    parameters: {
      task_id: z.string().describe('yu_dispatch 返回的 taskId'),
      status: z
        .enum(YU_TASK_STATUSES as unknown as [YuTaskStatus, ...YuTaskStatus[]])
        .optional()
        .describe('可选：running / idle / completed / failed / cancelled 等'),
    },
    handler: async (params: { task_id: string; status?: YuTaskStatus }) => {
      const updated = touchTask(params.task_id, params.status);
      if (updated === undefined) return { ok: false, error: 'unknown-task-id' };
      return { ok: true, lastSeenAt: updated.lastSeenAt, status: updated.status };
    },
  } as any);

  ctx.tools.register({
    name: 'yu_list_active',
    description: '鱼总管：列出当前登记的任务；默认仅返回未完成项。',
    parameters: {
      only_open: z.boolean().optional().describe('true=仅开放任务；false=全部；默认 true'),
    },
    handler: async (params: { only_open?: boolean }) => {
      const rows = (params.only_open ?? true) ? listOpen() : listAll();
      return { ok: true, count: rows.length, tasks: rows };
    },
  } as any);

  ctx.tools.register({
    name: 'yu_poll_inbox',
    description:
      '鱼总管：取走鱼阁老尚未送达的 stuck 报告（一次清空）。收到后请向人汇报，必要时 yu_close_task 结案。',
    parameters: {},
    handler: async () => {
      const reports: YuStuckReport[] = drainInbox();
      return { ok: true, count: reports.length, reports };
    },
  } as any);

  ctx.tools.register({
    name: 'yu_close_task',
    description: '鱼总管：结案。status 只能是 completed / failed / cancelled 之一。',
    parameters: {
      task_id: z.string(),
      status: z.union([
        z.literal('completed'),
        z.literal('failed'),
        z.literal('cancelled'),
      ]) as any,
      reason: z.string().max(500).optional().describe('可选：结案原因/备注'),
    },
    handler: async (params: { task_id: string; status: 'completed' | 'failed' | 'cancelled'; reason?: string }) => {
      const closed = closeTask(params.task_id, params.status, params.reason);
      if (closed === undefined) return { ok: false, error: 'unknown-task-id' };
      return { ok: true, taskId: closed.taskId, status: closed.status };
    },
  } as any);

  ctx.tools.register({
    name: 'yu_patrol_now',
    description: '调试/按需：立刻执行一次巡检扫描，返回本轮新增 stuck 报告与当前 inbox 快照。',
    parameters: {},
    handler: async () => {
      const just = runOnce(threshold);
      return { ok: true, newlyStuck: just, pending: peekInbox(), openCount: listOpen().length };
    },
  } as any);

  ctx.logger.info(
    `[yu-governance] installed. offices=steward+elder enabled=${enabled} patrol=${interval}s threshold=${threshold}s`,
  );
}

// ---- helpers -----------------------------------------------------------------

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

// 保留一处引用避免打包器认为 getTask 未使用（在后续 handler 里会用到）
void getTask;
