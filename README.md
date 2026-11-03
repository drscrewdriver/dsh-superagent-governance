# dsh-superagent-governance

> **Reserved placeholder. Do NOT install.**

This npm identifier is reserved for a future DeepSeek Harness (DSH) plugin
on the `0.2.1-rc` line — a governance / inspector layer built on top of
the official research prototype [`deepseek-ai/dsh-superagent-prototype`][upstream],
cross-referenced with the role model of [`Ruszero01/dsh-tang-governance`][tang].

[upstream]: https://github.com/deepseek-ai/dsh-superagent-prototype
[tang]: https://github.com/Ruszero01/dsh-tang-governance

## What this package is NOT

- **Not** published by, affiliated with, sponsored by, or endorsed by
  DeepSeek / deepseek-ai. All trademarks belong to their owners.
- **Not** the official prototype. The upstream prototype ships via
  `git clone` + local `pnpm install`; it is not published to npm at all.
- **Not** a working DSH bundle. The tarball contains only `index.js`
  (`module.exports = {};`), this README, and a LICENSE. No
  `dsh.bundle.patch`, no `dsh.client` declaration, no Cordis patch, no
  tools. Installing it into any profile has no effect on the host and
  is not the intent.

## Why reserve

`dsh-*` is the conventional npm prefix for DeepSeek Harness plugins. Once
a name in this family is claimed by an unrelated project, honest
maintainers lose the ability to publish real derivatives under the same
identifier. This placeholder is the minimum-viable claim: v0.0.1, empty
module, this README, MIT license.

## Plan (tracked as GitHub issues)

The real bundle, when it ships, will:

- target DSH `0.2.1-rc.x`, per the workspace's peer/engines discipline
  (compatibility gate reads `package.json.engines.dsh`);
- be a proper `dsh.bundle` with both `host` and `client` halves;
- cover two goals:
  1. **Preset-driven office variants** — parameterise role mapping onto a
     governance bundle so users can install 三省六部 / 两官制
     (转发官 + 管理官) / 精简制 variants as ordinary DSH presets, without
     the exclusive-profile constraint of the official prototype;
  2. **巡回御史 (roving inspector)** — an observation-only office that
     walks the active subagent children across sessions and flags
     stuck / unresponded ones. Kill/restart authority stays with the
     human gate; the inspector only reads and reports.

## Name-change / takeover

If DeepSeek or another upstream party needs this identifier: open an
issue on [the GitHub repo][repo]. It will be deprecated or transferred
under npm's normal name-change process — no claim is made on
`superagent` (the popular HTTP library) or on any DeepSeek trademark.

[repo]: https://github.com/drscrewdriver/dsh-superagent-governance

## License

MIT. Placeholder only; no code of value is included.
