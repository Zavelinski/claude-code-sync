#!/usr/bin/env bash
# Install the sync skill (SKILL.md + sync-skills.js) into ~/.claude (or $CLAUDE_CONFIG_DIR).
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
claude_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

mkdir -p "$claude_dir/skills/sync"
cp -r "$repo/skills/sync/." "$claude_dir/skills/sync/"

echo ""
echo "sync installed into $claude_dir"
echo "Restart Claude Code, then type 'sync' to check your skills against their latest published version."