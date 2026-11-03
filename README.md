# dsh-superagent-governance

> **DeepSeek Harness (DSH) 插件 — 两官制预设 · MVP 骨架 · 非官方项目**

一个用 DSH **预设 (preset)** 落地的轻量「superagent 治理」实现：不独占 profile、
不整体替换 `cordis.patch.yml`，只做「入口官 + 巡检官」两职，方便与其它 dsh-*
插件共存。派生自：

- 官方研究原型语义 [`deepseek-ai/dsh-superagent-prototype`][upstream]
- 三省六部预设结构 [`Ruszero01/dsh-tang-governance`][tang]
- 「当皇上 / 菠萝王朝」的官职映射思路 [`wanikua/danghuangshang`][dang]

[upstream]: https://github.com/deepseek-ai/dsh-superagent-prototype
[tang]: https://github.com/Ruszero01/dsh-tang-governance
[dang]: https://github.com/wanikua/danghuangshang

## 两官分工

| 官职 | 代号 | 职责 | 实现层 |
|---|---|---|---|
| **鱼总管** | `steward` | 入口聊天、检查活跃 subagent、把任务派给 worker、接收阁老报告并向人汇报 | 主 Session + `yu_*` 工具 |
| **鱼阁老** | `elder` | 定时巡检活跃 subagent 的活动时间戳、发现疑似卡死后写入 inbox | 主机侧 `setInterval` + 机械扫描（MVP 不消耗 token） |

> Worker（被派发的 subagent）沿用 DSH 原生 `dispatch_subagent` 机制，本 bundle 只做
> 登记 + 巡检 + 汇报三件事，不重复造 subagent 生命周期。

## 鱼总管工具一览

| 工具 | 用途 |
|---|---|
| `yu_dispatch` | 登记一条要派发给 worker 的任务；返回 `taskId` 与后续调用指引 |
| `yu_touch` | 更新任务活动时间戳 / 状态（worker 有反馈时由总管调用） |
| `yu_list_active` | 列出当前登记的任务（默认仅未结案项） |
| `yu_poll_inbox` | 取走鱼阁老尚未送达的 stuck 报告（一次清空） |
| `yu_close_task` | 结案：`completed / failed / cancelled` |
| `yu_patrol_now` | 按需强制巡检一次（调试 / 用户显式请求） |

设置命名空间：`yu-governance`（`patrolIntervalSeconds` / `stuckThresholdSeconds` /
`enabled` / `notifyStewardOnStuck`）。默认：巡检 300s、静默 900s 判卡死。

## 装机

**前置**：DSH `0.2.1-rc.1 … rc.5`，Node `^22.19 || >=24`。

```bash
# 未来发版后可用
npm install -g dsh-superagent-governance   # 或者：dsh plugin install dsh-superagent-governance
```

装上后 `apply()` 会自动：
1. `ctx.agentPresets.copy('standard', 'yu-governance', '鱼氏两官制（总管+阁老）')` —
   基于当前宿主版本的 standard 预设派生；
2. 在 composition 中注入 `- id: yu-governance-tool` 行；
3. 写 `preset.yml`（`order: 6`）与 marker 文件 `.dsh-superagent-governance.json`；
4. 如果同名 preset 已存在但**不带** marker，仅 `logger.warn`，绝不覆盖用户自建的 preset。

用户在 DSH 会话切到「鱼氏两官制」预设即可启用。

## 版本状态

**v0.0.2** — 骨架与 MVP：
- ✅ 主机半：preset installer / ledger / patrol / tools / settings
- ✅ 客户半：占位 stub（面板在 v0.0.3 补）
- ✅ `test/patrol.spec.ts`：巡检语义单测（无 DSH 依赖）
- ⏭ v0.0.3：鱼阁老真正把 stuck 报告 push 到鱼总管 Session（依赖 host 注入 API 确认）
- ⏭ v0.0.3：client 面板 + 9 语 locale
- ⏭ v0.1.0：把「鱼阁老」升级为可选 LLM 人格（默认仍走机械路径省 token）

## Roadmap（GitHub Issues）

- [#1 Preset-driven office variants](https://github.com/drscrewdriver/dsh-superagent-governance/issues/1) —
  把 preset 参数化：两官制 / 精简制 / 三省六部完整制，同一 bundle 提供多个 preset id
- [#2 巡回御史：stuck-agent watcher office](https://github.com/drscrewdriver/dsh-superagent-governance/issues/2) —
  本 bundle 的核心目标：定时巡检 + 面板 + 人闸保留

## 与官方原型的关系

`deepseek-ai/dsh-superagent-prototype` 是**独占 profile** 的 bundle，`cordis.patch.yml`
会被整体替换，其它插件（包括本 bundle）挂不进去。本项目走的是另一条路：**保留普通
profile，用 preset 承载角色语义**，因此可与现有 dsh-*（`perm-gate`、
`session-steward`、`flash-presets`、`im-union` 等）共存。

## 免责 / 名称变更

- 本包不来自、也不代表 DeepSeek；`superagent` 一词与 npm 上的 `superagent` HTTP 库无关。
- 原名 `dsh-superagent` 因与已存在的 `dsh-super-agent` 归一化同名被 npm 拒绝，
  改用带后缀的 `dsh-superagent-governance`。若你（DeepSeek 或 `dsh-super-agent` 作者）
  希望我改名 / 下架 / 转让，请在 GitHub 开 issue。

## License

MIT
