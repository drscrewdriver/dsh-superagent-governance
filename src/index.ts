/** Installer: creates the 鱼氏两官制 preset from the target DSH version's
 *  standard preset, injects our tool row into its composition, and drops a
 *  marker file so we can distinguish our managed copy from a user-authored
 *  preset that happens to share the id. Mirrors the pattern validated by
 *  dsh-tang-governance v0.1.10.
 */
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { readFile, rename, writeFile } from 'node:fs/promises';

import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-agent-presets';

import {
  YU_MARKER_FILE,
  YU_PRESET_DISPLAY_NAME,
  YU_PRESET_ID,
} from './contracts.ts';

export const name = 'yu-governance';
export const inject = ['agentPresets'];

interface ManagedMarker {
  readonly package: 'dsh-superagent-governance';
  readonly presetVersion: 1;
}

const TOOL_ROW = [
  '',
  '# Managed by dsh-superagent-governance (yu-governance preset).',
  '- id: yu-governance-tool',
  "  name: 'dsh-superagent-governance/tool'",
  '',
].join('\n');

const PROMPT_ROWS = [
  '',
  '# 鱼氏两官制 system-prompt addendum (managed).',
  '# Steward: entry, chat, dispatch, receive elder reports. No direct worker work.',
  '# Elder: mechanical patrol, surfaces stuck via yu_poll_inbox.',
  '# See README for details.',
  '',
].join('\n');

async function atomicWrite(path: string, content: string): Promise<void> {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, path);
}

async function markerAt(directory: string): Promise<ManagedMarker | null> {
  try {
    const value = JSON.parse(await readFile(join(directory, YU_MARKER_FILE), 'utf8')) as Partial<ManagedMarker>;
    return value.package === 'dsh-superagent-governance' && value.presetVersion === 1
      ? { package: value.package, presetVersion: value.presetVersion }
      : null;
  } catch {
    return null;
  }
}

async function finishManagedPreset(compositionPath: string): Promise<void> {
  const directory = dirname(compositionPath);
  const composition = await readFile(compositionPath, 'utf8');

  if (!composition.includes("name: 'dsh-superagent-governance/tool'")) {
    await atomicWrite(compositionPath, composition.trimEnd() + TOOL_ROW + PROMPT_ROWS);
  }

  await atomicWrite(join(directory, 'preset.yml'), [
    `name: ${YU_PRESET_DISPLAY_NAME}`,
    'description: 两官制：鱼总管做入口/派发/汇报；鱼阁老做定时巡检活跃 subagent、上报卡死。',
    'order: 6',
    '',
  ].join('\n'));

  await atomicWrite(
    join(directory, YU_MARKER_FILE),
    `${JSON.stringify({
      package: 'dsh-superagent-governance',
      presetVersion: 1,
    } satisfies ManagedMarker, null, 2)}\n`,
  );
}

export async function apply(ctx: Context): Promise<void> {
  const existing = (await ctx.agentPresets.list()).find(preset => preset.id === YU_PRESET_ID);

  if (existing === undefined) {
    await ctx.agentPresets.copy('standard', YU_PRESET_ID, YU_PRESET_DISPLAY_NAME);
    const copied = await ctx.agentPresets.resolve(YU_PRESET_ID);
    await finishManagedPreset(copied.path);
    ctx.logger.info(`installed 鱼氏两官制 preset "${YU_PRESET_ID}" from this Harness version's standard preset`);
    return;
  }

  const directory = dirname(existing.path);
  if ((await markerAt(directory)) === null) {
    ctx.logger.warn(
      `preset "${YU_PRESET_ID}" already exists and is not managed by dsh-superagent-governance; leaving it unchanged`,
    );
    return;
  }

  await finishManagedPreset(existing.path);
  ctx.logger.info(`refreshed managed 鱼氏两官制 preset "${YU_PRESET_ID}" composition`);
}
