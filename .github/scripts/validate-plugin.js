#!/usr/bin/env node
// Validates a Claude Code skill plugin repo structure.
// Checks .claude-plugin/plugin.json (name, description, version semver),
// skills/<name>/SKILL.md exists with YAML frontmatter name + description,
// frontmatter name equals plugin.json name, and optional hooks/hooks.json
// parses as JSON with a "hooks" object.
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const failures = [];

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

const pjPath = path.join(root, '.claude-plugin', 'plugin.json');
const pjRaw = read(pjPath);
if (!pjRaw) { console.error('FAIL: .claude-plugin/plugin.json not found'); process.exit(1); }
let pj;
try { pj = JSON.parse(pjRaw); } catch (e) { console.error('FAIL: plugin.json invalid JSON:', e.message); process.exit(1); }

for (const k of ['name', 'description', 'version']) {
  if (typeof pj[k] !== 'string' || !pj[k].trim()) failures.push(`plugin.json missing/empty: ${k}`);
}
if (pj.version && !/^\d+\.\d+\.\d+$/.test(pj.version)) failures.push(`plugin.json version not semver: ${pj.version}`);

const name = pj.name;

const skillPath = path.join(root, 'skills', name, 'SKILL.md');
const skillRaw = read(skillPath);
if (!skillRaw) {
  failures.push(`skills/${name}/SKILL.md not found`);
} else {
  const fm = skillRaw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) {
    failures.push('SKILL.md missing frontmatter block');
  } else {
    const block = fm[1];
    const getName = (b) => { const m = b.match(/^name:\s*(.+)$/m); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null; };
    const getDesc = (b) => { const m = b.match(/^description:\s*(.+)$/m); return m ? m[1].trim() : null; };
    const sname = getName(block);
    const sdesc = getDesc(block);
    if (!sname) failures.push('SKILL.md frontmatter missing name');
    if (!sdesc) failures.push('SKILL.md frontmatter missing description');
    if (sname && sname !== name) failures.push(`SKILL.md name "${sname}" != plugin.json name "${name}"`);
  }
}

const hooksPath = path.join(root, 'hooks', 'hooks.json');
const hooksRaw = read(hooksPath);
if (hooksRaw) {
  try {
    const hj = JSON.parse(hooksRaw);
    if (!hj || typeof hj.hooks !== 'object' || hj.hooks === null) {
      failures.push('hooks/hooks.json missing "hooks" object');
    }
  } catch (e) {
    failures.push(`hooks/hooks.json invalid JSON: ${e.message}`);
  }
}

if (failures.length) {
  console.error('FAIL validate-plugin:');
  failures.forEach((x) => console.error('  - ' + x));
  process.exit(1);
}
console.log(`OK validate-plugin: ${name} v${pj.version}`);