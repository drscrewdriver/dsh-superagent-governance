/** Web client half of the bundle (stub for MVP).
 *
 *  v0.0.2 keeps the panel intentionally thin so the host side can be verified
 *  first. Real 巡检面板 (stuck 报告列表 + patrol 配置卡) 在 v0.0.3 加入：
 *   - Slot registration for a sidebar "yu-governance" panel
 *   - Read `yu_list_active` / inbox state via host bridge
 *   - Edit patrolIntervalSeconds / stuckThresholdSeconds / enabled
 *
 *  See issue #2 for the full contract.
 */
export const name = 'yu-governance-client';

export function apply(): void {
  // no-op: bundle installs without touching the web UI yet
}
