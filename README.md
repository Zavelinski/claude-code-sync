# sync for Claude Code

[![License: MIT](https://img.shields.io/github/license/Zavelinski/claude-code-sync)](LICENSE)
[![Stars](https://img.shields.io/github/stars/Zavelinski/claude-code-sync?style=flat)](https://github.com/Zavelinski/claude-code-sync/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/Zavelinski/claude-code-sync)](https://github.com/Zavelinski/claude-code-sync/commits)
[![Claude Code skill](https://img.shields.io/badge/Claude%20Code-skill-8A2BE2)](https://claude.com/claude-code)

A [Claude Code](https://claude.com/claude-code) skill that checks your locally installed skills against the **latest published version on GitHub** and reports version drift. Type **`sync`** and it lists, per skill, the latest tag, the local tag, and whether they match. With your OK, it syncs the outdated public ones. The premise is baked in: it always states the current tool version before claiming anything is up to date.

It never auto-overwrites skills you keep a custom copy of (godmode, best-tool, salve by default); those report drift only, and need `--force-personal` plus an explicit OK to touch.

## Prerequisites

Claude Code with `/plugin` support (v2.x+) and [Node.js](https://nodejs.org/) 18+ (the drift check is a no-dependency Node script).

## Install

### Option 1 — Claude Code plugin marketplace (recommended)

```bash
/plugin marketplace add Zavelinski/claude-code-skills
/plugin install sync@claude-code-skills
```

Registered hooks (if any) install through the Claude Code consent UI, with no manual edit to `~/.claude/settings.json`. This skill ships no hooks.

### Option 2 — Manual fallback (run it yourself)

> **Security note.** This script copies files into `~/.claude/skills/sync/`. It is benign and local-only (the drift check reads public GitHub APIs; `--apply` downloads from your own public repos). Review and run it yourself. Prefer Option 1.

```bash
git clone https://github.com/Zavelinski/claude-code-sync.git
cd claude-code-sync
bash install.sh        # macOS / Linux
.\install.ps1          # Windows (PowerShell)
```

## Uninstall

```bash
/plugin uninstall sync@claude-code-skills    # Option 1
bash uninstall.sh                                # Option 2 (or uninstall.ps1 on Windows)
```

## Update

```bash
/plugin marketplace update claude-code-skills    # Option 1
# Option 2: pull the latest commit and re-run the manual fallback.
```

## What it does

1. **Dry-run (default)** — `node ~/.claude/skills/sync/sync-skills.js` prints a table: skill, latest tag, local tag, status, personal.
2. **Latest tag** — ranks all git tags by semver and picks the highest (NOT the GitHub `releases/latest` pointer, which can lag behind tags pushed without a Release).
3. **Synced** = local `.sync-version` tag equals the latest tag AND the local `SKILL.md` sha256 matches the published `SKILL.md` at that tag.
4. **Apply** — `--apply` downloads every file under `skills/<slug>/` at the latest tag and overwrites the local folder, then stamps `.sync-version`. Public skills only.
5. **Personal skills** — godmode/best-tool/salve report drift only; never overwritten without `--force-personal` + your OK.

Statuses you will see: `synced`, `synced-untracked` (hash matches, no version stamp yet), `outdated`, `local-modified`, `personal-synced`, `personal-diverged`, `remote-missing`, `error`.

## Use

- `sync` — check all skills.
- `sync salve` — check one skill (`--slug=salve`).
- After applying, restart Claude Code so updated skills reload.

## Safety

- `--apply` overwrites `~/.claude/skills/<slug>/` for public skills. Each repo is git-tracked, so the prior copy is recoverable from the previous tag or your local checkout.
- Personal skills protect your custom hooks/URLs/keys. Keep a backup of the custom `SKILL.md` before any `--force-personal`.
- Run **skill-security-scan** on any incoming `SKILL.md` before letting `--apply` overwrite a local skill; only apply on `ALLOW` or an explicit override.

## Not a substitute for /plugin

This is the manual-fallback path. The primary install/update path is still `/plugin marketplace update claude-code-skills` (consent UI, hook registration). Use `sync` to audit version drift and refresh a manual copy fast.

## Provenance

Original work, MIT-licensed. Pairs well with [skill-security-scan](https://github.com/Zavelinski/claude-code-skill-security-scan) and [docs-drift-sync](https://github.com/Zavelinski/claude-code-docs-drift-sync).

## License

MIT. See [LICENSE](LICENSE). Original work.

---

## Part of claude-code-skills

This skill ships in the [claude-code-skills](https://zavelinski.github.io/claude-code-skills/) marketplace. See also: [skill-security-scan](https://github.com/Zavelinski/claude-code-skill-security-scan), [docs-drift-sync](https://github.com/Zavelinski/claude-code-docs-drift-sync).