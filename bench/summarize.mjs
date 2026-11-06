#!/usr/bin/env node
// Turn one bench results.json into the compact summary the page reads.
// Usage: node summarize.mjs <results/STAMP/results.json> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

/** Group runs into prompt × condition cells, with verdict counts and per-run details. */
export function summarize(results, stamp) {
  const { meta, runs } = results;
  const conditions = [...new Set(runs.map((r) => r.condition))];
  const prompts = [...new Map(runs.map((r) => [r.prompt, { id: r.prompt, text: r.text, kind: r.kind, expect: r.expect }])).values()];

  const cell = (prompt, condition) => {
    const rows = runs.filter((r) => r.prompt === prompt && r.condition === condition).sort((a, b) => a.rep - b.rep);

    return {
      n: rows.length,
      entered: rows.filter((r) => r.outcome === 'openspec_first').length,
      runs: rows.map((r) => ({
        rep: r.rep,
        outcome: r.outcome,
        verdict: r.verdict,
        firstStep: r.firstStep === null ? '' : `${r.firstStep.name} ${shorten(r.firstStep.detail)}`.trim(),
        changeFolders: r.changeFolders,
        sourceFilesChanged: r.sourceFilesChanged,
        log: `results/${stamp}/logs/${condition}-${prompt}-${r.rep}.jsonl`,
      })),
    };
  };

  const totals = Object.fromEntries(conditions.map((c) => {
    const rows = runs.filter((r) => r.condition === c);
    const count = (v) => rows.filter((r) => r.verdict === v).length;

    return [c, { hit: count('hit'), missed: count('missed'), falseTrigger: count('false_trigger'), correctSkip: count('correct_skip') }];
  }));

  return {
    meta: { ...meta, stamp, runs: runs.length, costUsd: Math.round(runs.reduce((s, r) => s + (r.costUsd ?? 0), 0) * 100) / 100 },
    conditions,
    prompts: prompts.map((p) => ({ ...p, cells: Object.fromEntries(conditions.map((c) => [c, cell(p.id, c)])) })),
    totals,
  };
}

// Paths in the logs are per-run temp folders; keep the part inside the project.
function shorten(detail) {
  return detail.replace(/^.*\/run-[^/]+\//, '').split('\n')[0].slice(0, 90);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [input, output] = process.argv.slice(2);
  const results = JSON.parse(readFileSync(input, 'utf8'));
  writeFileSync(output, JSON.stringify(summarize(results, basename(dirname(input))), null, 2) + '\n');
  console.log(`wrote ${output}`);
}
