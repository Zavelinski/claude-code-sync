#!/usr/bin/env node
// sync-skills.js — compare locally installed skills vs the latest published
// version on GitHub, and optionally sync. Cross-platform, no dependencies.
//
// Usage:
//   node sync-skills.js              # dry-run: report version drift only
//   node sync-skills.js --apply      # sync PUBLIC skills that are outdated
//   node sync-skills.js --apply --force-personal   # also overwrite PERSONAL
//                                     skills (godmode/best-tool/salve) — DANGER
//   node sync-skills.js --slug salve  # check/sync one skill only
//
// Premise baked in: ALWAYS report the current tool version (latest tag) before
// claiming anything is up to date. A skill is "synced" only when its local
// .sync-version tag equals the latest release tag AND the SKILL.md hash matches
// the published SKILL.md at that tag.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const SKILLS_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH || '',
  '.claude',
  'skills'
);
const OWNER = 'Zavelinski';

// slug: local skill folder name. repo: github repo. repoPath: path inside the
// repo to the skill dir (usually skills/<slug>). personal: true => dry-run only
// unless --force-personal (user keeps a customized local copy).
const MANIFEST = [
  { slug: 'godmode', repo: 'claude-code-godmode', repoPath: 'skills/godmode', personal: true },
  { slug: 'best-tool', repo: 'claude-code-godmode', repoPath: 'skills/best-tool', personal: true },
  { slug: 'adversarial-verify', repo: 'claude-code-adversarial-verify', repoPath: 'skills/adversarial-verify', personal: false },
  { slug: 'skill-security-scan', repo: 'claude-code-skill-security-scan', repoPath: 'skills/skill-security-scan', personal: false },
  { slug: 'scheduled-sop-runner', repo: 'claude-code-scheduled-sop-runner', repoPath: 'skills/scheduled-sop-runner', personal: false },
  { slug: 'docs-drift-sync', repo: 'claude-code-docs-drift-sync', repoPath: 'skills/docs-drift-sync', personal: false },
  { slug: 'geo-aeo-audit', repo: 'claude-code-geo-aeo-audit', repoPath: 'skills/geo-aeo-audit', personal: false },
  { slug: 'content-repurpose-engine', repo: 'claude-code-content-repurpose-engine', repoPath: 'skills/content-repurpose-engine', personal: false },
  { slug: 'weekly-ai-digest', repo: 'claude-code-weekly-ai-digest', repoPath: 'skills/weekly-ai-digest', personal: false },
  { slug: 'salve', repo: 'claude-code-salve', repoPath: 'skills/salve', personal: true },
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'sync-skills.js', Accept: 'application/vnd.github+json' } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(fetchUrl(res.headers.location));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout ' + url)));
  });
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

function semverOf(name) {
  const m = String(name).match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

async function latestTag(repo) {
  // The "current version of the tool" is the highest semver tag, NOT the
  // GitHub Releases "latest" pointer (a tag can be pushed without publishing a
  // Release, so releases/latest can lag behind the real latest tag).
  try {
    const buf = await fetchUrl(`https://api.github.com/repos/${OWNER}/${repo}/tags`);
    const tags = JSON.parse(buf.toString('utf8'));
    if (Array.isArray(tags) && tags.length) {
      const ranked = tags
        .map((t) => ({ name: t.name, v: semverOf(t.name) }))
        .filter((t) => t.v)
        .sort((a, b) =>
          b.v[0] - a.v[0] || b.v[1] - a.v[1] || b.v[2] - a.v[2]);
      if (ranked.length) return { tag: ranked[0].name, ref: ranked[0].name };
    }
  } catch (e) {
    // fall through
  }
  // Fallback: the published latest release (if any).
  try {
    const buf = await fetchUrl(`https://api.github.com/repos/${OWNER}/${repo}/releases/latest`);
    const j = JSON.parse(buf.toString('utf8'));
    if (j && j.tag_name) return { tag: j.tag_name, ref: j.tag_name };
  } catch (e) {
    // fall through
  }
  // Last resort: track main HEAD. No released version.
  return { tag: 'no-release', ref: 'main' };
}

async function listRepoTree(repo, ref) {
  const buf = await fetchUrl(
    `https://api.github.com/repos/${OWNER}/${repo}/git/trees/${ref}?recursive=1`
  );
  const j = JSON.parse(buf.toString('utf8'));
  if (!j || !Array.isArray(j.tree)) throw new Error('no tree in response');
  return j.tree.filter((t) => t.type === 'blob').map((t) => t.path);
}

function statusOf(localHash, remoteHash, localTag, latestTag, personal) {
  if (personal) {
    return localHash === remoteHash ? 'personal-synced' : 'personal-diverged';
  }
  if (localHash === remoteHash && localTag === latestTag) return 'synced';
  if (localHash === remoteHash && localTag !== latestTag) return 'synced-untracked';
  if (localTag === latestTag && localHash !== remoteHash) return 'local-modified';
  return 'outdated';
}

async function checkOne(entry) {
  const localDir = path.join(SKILLS_DIR, entry.slug);
  const localSkill = path.join(localDir, 'SKILL.md');
  const versionFile = path.join(localDir, '.sync-version');
  const localExists = fs.existsSync(localSkill);
  const localTag = localExists && fs.existsSync(versionFile)
    ? fs.readFileSync(versionFile, 'utf8').trim()
    : 'untracked';
  const { tag: latest, ref } = await latestTag(entry.repo);
  const remoteUrl = `https://raw.githubusercontent.com/${OWNER}/${entry.repo}/${ref}/${entry.repoPath}/SKILL.md`;
  let remoteHash = 'n/a';
  let localHash = 'n/a';
  let remoteOk = true;
  try {
    remoteHash = sha256(await fetchUrl(remoteUrl));
  } catch (e) {
    remoteOk = false;
  }
  if (localExists) localHash = sha256(fs.readFileSync(localSkill));
  const status = remoteOk
    ? statusOf(localHash, remoteHash, localTag, latest, entry.personal)
    : 'remote-missing';
  return {
    ...entry,
    localExists,
    localTag,
    latestTag: latest,
    ref,
    localHash,
    remoteHash,
    remoteOk,
    status,
    remoteUrl,
    localDir,
  };
}

async function applyOne(r, forcePersonal) {
  if (!r.remoteOk) return { applied: false, reason: 'remote missing' };
  if (r.personal && !forcePersonal) {
    return { applied: false, reason: 'personal; skipped (use --force-personal to overwrite your custom copy)' };
  }
  if (r.status === 'synced') return { applied: false, reason: 'already synced' };
  // Download every file under skills/<slug>/ at the ref and overwrite locally.
  const tree = await listRepoTree(r.repo, r.ref);
  const prefix = r.repoPath + '/';
  const files = tree.filter((p) => p.startsWith(prefix));
  if (!files.length) return { applied: false, reason: 'no files under repoPath in tree' };
  if (!fs.existsSync(r.localDir)) fs.mkdirSync(r.localDir, { recursive: true });
  let written = 0;
  for (const p of files) {
    const rel = p.slice(prefix.length);
    if (rel === '' ) continue;
    const out = path.join(r.localDir, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const buf = await fetchUrl(
      `https://raw.githubusercontent.com/${OWNER}/${r.repo}/${r.ref}/${p}`
    );
    fs.writeFileSync(out, buf);
    written++;
  }
  // Record the version we synced from. Stays even after a future sync.
  fs.writeFileSync(path.join(r.localDir, '.sync-version'), r.ref + '\n');
  return { applied: true, written, ref: r.ref };
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const forcePersonal = argv.includes('--force-personal');
  const slugArg = argv.find((a) => a.startsWith('--slug='));
  const onlySlug = slugArg ? slugArg.split('=')[1] : null;
  let entries = MANIFEST;
  if (argv.includes('--slug')) {
    const i = argv.indexOf('--slug');
    if (argv[i + 1]) { entries = MANIFEST.filter((m) => m.slug === argv[i + 1]); }
  } else if (onlySlug) {
    entries = MANIFEST.filter((m) => m.slug === onlySlug);
  }

  console.log(`sync-skills — skills dir: ${SKILLS_DIR}`);
  console.log(`mode: ${apply ? (forcePersonal ? 'APPLY (incl. personal)' : 'APPLY (public only)') : 'DRY-RUN'}`);
  console.log('');

  const results = [];
  for (const e of entries) {
    try {
      results.push(await checkOne(e));
    } catch (err) {
      console.error(`[debug] ${e.slug}: ${err.stack || err.message}`);
      results.push({ ...e, status: 'error', error: err.message, localExists: false, localTag: '?', latestTag: '?', localHash: '?', remoteHash: '?', remoteOk: false });
    }
  }

  // Report
  console.log(
    pad('skill', 26) + pad('latest', 10) + pad('local-tag', 12) +
    pad('status', 20) + 'personal'
  );
  console.log('-'.repeat(80));
  for (const r of results) {
    console.log(
      pad(r.slug, 26) + pad(r.latestTag, 10) + pad(r.localTag, 12) +
      pad(r.status, 20) + (r.personal ? 'yes' : 'no')
    );
  }
  console.log('');

  if (!apply) {
    const outdated = results.filter((r) => r.status === 'outdated' || r.status === 'local-modified' || r.status === 'personal-diverged');
    if (outdated.length) {
      console.log(`Drift detected on ${outdated.length} skill(s). Re-run with --apply to sync the public ones.`);
      console.log('Personal skills (godmode/best-tool/salve) keep your local custom copy; review the diff yourself before --force-personal.');
    } else {
      console.log('All tracked skills match their latest published version.');
    }
    return;
  }

  // Apply phase. Per the global security gate, the caller (Claude) should run
  // skill-security-scan on any NEW skill content before letting it overwrite a
  // local skill. This script does the copy; it does NOT bypass that gate.
  console.log('Applying...');
  for (const r of results) {
    const res = await applyOne(r, forcePersonal);
    console.log(`  ${pad(r.slug, 26)} ${res.applied ? `synced ${res.written} files @ ${res.ref}` : 'skipped: ' + res.reason}`);
  }
  console.log('');
  console.log('Done. Restart Claude Code so updated skills reload.');
}

main().catch((e) => {
  console.error('fatal:', e.message);
  process.exit(1);
});