# Install the sync skill (SKILL.md + sync-skills.js) into ~/.claude (or $env:CLAUDE_CONFIG_DIR).
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$claudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }

New-Item -ItemType Directory -Force -Path (Join-Path $claudeDir 'skills\sync') | Out-Null
Copy-Item -Path (Join-Path $repo 'skills\sync\*') -Destination (Join-Path $claudeDir 'skills\sync') -Recurse -Force

Write-Host ""
Write-Host "sync installed into $claudeDir"
Write-Host "Restart Claude Code, then type 'sync' to check your skills against their latest published version."