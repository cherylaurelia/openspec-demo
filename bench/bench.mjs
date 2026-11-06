#!/usr/bin/env node
// Measure how often Claude Code enters an OpenSpec workflow on its own in an `openspec init` project.
// Usage: node bench.mjs [--reps 5] [--model sonnet] [--conditions default,skills-only,hint] [--only id,id]
//                       [--skills ./my-skills] [--jobs 3]
// --skills copies a folder of edited SKILL.md folders over .claude/skills after init, to test new descriptions.
import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, createWriteStream } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { classifyRun } from './classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const { values: opts } = parseArgs({
  options: {
    reps: { type: 'string', default: '5' },
    model: { type: 'string', default: 'sonnet' },
    conditions: { type: 'string', default: 'default,skills-only,hint' },
    skills: { type: 'string', default: '' },
    only: { type: 'string', default: '' },
    jobs: { type: 'string', default: '3' },
    out: { type: 'string', default: join(here, 'results') },
    'max-turns': { type: 'string', default: '8' },
    workdir: { type: 'string', default: '/tmp/opsx-bench' },
  },
});

// One line in CLAUDE.md telling the agent the project plans with OpenSpec (the "hint" condition).
const HINT = 'This project plans changes with OpenSpec. For new features or behavior changes, start with the openspec-propose skill (or openspec-explore if the idea is still fuzzy) before editing code.\n';

// Claude Code also reads AGENTS.md, CLAUDE.md and .claude/rules from parent folders (your home folder included), so a stray one above the runs would leak in.
function assertCleanParents(dir) {
  for (let d = resolve(dir); ; d = dirname(d)) {
    for (const f of ['AGENTS.md', 'CLAUDE.md', 'CLAUDE.local.md', '.claude/CLAUDE.md', '.claude/rules']) {
      if (existsSync(join(d, f))) throw new Error(`${join(d, f)} would be loaded into every run; pick another --workdir`);
    }

    if (dirname(d) === d) return;
  }
}

mkdirSync(opts.workdir, { recursive: true });

assertCleanParents(opts.workdir);

const env = { ...process.env, DO_NOT_TRACK: '1', OPENSPEC_TELEMETRY: '0' };
const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function makeTemplate(condition) {
  const dir = mkdtempSync(join(opts.workdir, `${condition}-`));
  // Each condition gets its own OpenSpec global config, so `delivery` never leaks between them or into yours.
  const cenv = { ...env, XDG_CONFIG_HOME: join(dir, '.xdg-config') };
  const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, env: cenv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const app = join(dir, 'app');
  cpSync(join(here, 'fixture'), app, { recursive: true });
  run('git', ['init', '-q'], app);

  if (condition === 'skills-only') run('openspec', ['config', 'set', 'delivery', 'skills'], app);
  run('openspec', ['init', '--tools', 'claude', '--no-animation', '.'], app);

  if (opts.skills) cpSync(opts.skills, join(app, '.claude', 'skills'), { recursive: true });

  if (condition === 'hint') writeFileSync(join(app, 'CLAUDE.md'), HINT);
  run('git', ['add', '-A'], app);
  run('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=bench', '-c', 'user.email=bench@example.com', 'commit', '-qm', 'fixture'], app);
  const installed = run('git', ['ls-files', '.claude'], app).trim().split('\n');

  return { dir, app, installed };
}

function runOne(template, prompt, logPath) {
  const dir = mkdtempSync(join(opts.workdir, 'run-'));
  cpSync(template.app, dir, { recursive: true });

  const args = ['-p', prompt.text, '--setting-sources', 'project', '--output-format', 'stream-json', '--verbose',
    '--max-turns', opts['max-turns'], '--permission-mode', 'bypassPermissions', '--model', opts.model, '--no-session-persistence'];

  return new Promise((resolve) => {
    const log = createWriteStream(logPath);
    const child = spawn('claude', args, { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), 6 * 60_000);
    child.stdout.pipe(log);
    child.on('close', (code) => {
      clearTimeout(timer);
      log.end(() => {
        const events = readFileSync(logPath, 'utf8').split('\n').filter(Boolean).flatMap((l) => {
          try { return [JSON.parse(l)]; } catch { return []; }
        });

        const changed = sh('git', ['status', '--porcelain', '--untracked-files=all'], dir).split('\n').filter(Boolean).map((l) => l.slice(3));
        const result = events.findLast((e) => e.type === 'result');
        rmSync(dir, { recursive: true, force: true });
        resolve({
          ...classifyRun(events),
          exitCode: code,
          costUsd: result?.total_cost_usd ?? null,
          changeFolders: [...new Set(changed.filter((f) => f.startsWith('openspec/changes/')).map((f) => f.split('/')[2]))],
          sourceFilesChanged: changed.filter((f) => !f.startsWith('openspec/') && !f.startsWith('.claude/')),
        });
      });
    });
  });
}

async function pool(tasks, n) {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < tasks.length) { const i = next++; results[i] = await tasks[i](); }
  }));

  return results;
}

const prompts = JSON.parse(readFileSync(join(here, 'prompts.json'), 'utf8'))
  .filter((p) => !opts.only || opts.only.split(',').includes(p.id));

const conditions = opts.conditions.split(',');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(opts.out, stamp);

mkdirSync(join(outDir, 'logs'), { recursive: true });

const meta = {
  startedAt: new Date().toISOString(),
  openspec: sh('openspec', ['--version']).trim(),
  claudeCode: sh('claude', ['--version']).trim(),
  model: opts.model, reps: Number(opts.reps), maxTurns: Number(opts['max-turns']), hint: HINT.trim(),
  customSkills: Boolean(opts.skills),
};

const templates = Object.fromEntries(conditions.map((c) => [c, makeTemplate(c)]));
const tasks = [];

for (let rep = 1; rep <= meta.reps; rep++) {
  for (const condition of conditions) {
    for (const prompt of prompts) {
      tasks.push(async () => {
        const log = join(outDir, 'logs', `${condition}-${prompt.id}-${rep}.jsonl`);
        const r = await runOne(templates[condition], prompt, log);
        appendFileSync(join(outDir, 'runs.jsonl'), JSON.stringify({ condition, prompt: prompt.id, rep, ...r }) + '\n');
        console.log(`${condition.padEnd(8)} ${prompt.id.padEnd(14)} rep${rep} ${r.outcome.padEnd(15)} ${r.firstStep?.name ?? '-'}`);
        const triggered = r.outcome === 'openspec_first';
        const verdict = prompt.expect === 'enter' ? (triggered ? 'hit' : 'missed') : (triggered ? 'false_trigger' : 'correct_skip');

        return { condition, prompt: prompt.id, kind: prompt.kind, expect: prompt.expect, text: prompt.text, rep, verdict, ...r };
      });
    }
  }
}

const runs = await pool(tasks, Number(opts.jobs));
const installed = Object.fromEntries(Object.entries(templates).map(([c, t]) => [c, t.installed]));

for (const t of Object.values(templates)) rmSync(t.dir, { recursive: true, force: true });

writeFileSync(join(outDir, 'results.json'), JSON.stringify({ meta: { ...meta, installed, finishedAt: new Date().toISOString() }, runs }, null, 2));

for (const c of conditions) {
  const rows = runs.filter((r) => r.condition === c);
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  console.log(`${c}: hit ${count('hit')}, missed ${count('missed')}, false trigger ${count('false_trigger')}, correct skip ${count('correct_skip')}`);
}

console.log(`\nwrote ${join(outDir, 'results.json')}`);
