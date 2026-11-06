import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from './summarize.mjs';

const run = (condition, prompt, rep, outcome, verdict, expect = 'enter') => ({
  condition, prompt, rep, outcome, verdict, expect, kind: 'feature', text: `text ${prompt}`, costUsd: 0.1,
  firstStep: outcome === 'neither' ? null : { name: 'Edit', detail: '/tmp/opsx-bench/run-abc123/src/server.js' },
  changeFolders: [], sourceFilesChanged: ['src/server.js'],
});

test('groups runs into cells and counts verdicts per condition', () => {
  const s = summarize({ meta: { model: 'sonnet' }, runs: [
    run('default', 'a', 2, 'code_first', 'missed'),
    run('default', 'a', 1, 'openspec_first', 'hit'),
    run('hint', 'a', 1, 'openspec_first', 'hit'),
    run('default', 'b', 1, 'openspec_first', 'false_trigger', 'skip'),
    run('default', 'b', 2, 'neither', 'correct_skip', 'skip'),
  ] }, 'STAMP');

  assert.deepEqual(s.conditions, ['default', 'hint']);
  assert.equal(s.meta.runs, 5);
  assert.equal(s.meta.costUsd, 0.5);
  const a = s.prompts.find((p) => p.id === 'a');
  assert.equal(a.cells.default.n, 2);
  assert.equal(a.cells.default.entered, 1);
  assert.deepEqual(a.cells.default.runs.map((r) => r.rep), [1, 2]);
  assert.equal(a.cells.default.runs[1].firstStep, 'Edit src/server.js');
  assert.equal(a.cells.default.runs[0].log, 'results/STAMP/logs/default-a-1.jsonl');
  assert.equal(s.prompts.find((p) => p.id === 'b').cells.default.runs[1].firstStep, '');
  assert.deepEqual(s.totals.default, { hit: 1, missed: 1, falseTrigger: 1, correctSkip: 1 });
  assert.deepEqual(s.totals.hint, { hit: 1, missed: 0, falseTrigger: 0, correctSkip: 0 });
});

test('a condition with no run for a prompt gets an empty cell', () => {
  const s = summarize({ meta: {}, runs: [run('default', 'a', 1, 'code_first', 'missed'), run('hint', 'b', 1, 'code_first', 'missed')] }, 'S');
  assert.equal(s.prompts.find((p) => p.id === 'a').cells.hint.n, 0);
});
