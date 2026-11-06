import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepKind, classifyRun } from './classify.mjs';

const run = (...calls) => [
  { type: 'system', subtype: 'init', skills: ['openspec-propose', 'openspec-explore', 'debug'] },
  ...calls.map(([name, input]) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } })),
];

test('skill and CLI calls count as entering OpenSpec', () => {
  assert.equal(stepKind('Skill', { skill: 'openspec-propose' }), 'openspec');
  assert.equal(stepKind('Skill', { skill: 'opsx:explore' }), 'openspec');
  assert.equal(stepKind('Bash', { command: 'openspec new change add-tags' }), 'openspec');
  assert.equal(stepKind('Bash', { command: 'cd x && openspec status --change a --json' }), 'openspec');
  assert.equal(stepKind('Read', { file_path: '/r/.claude/skills/openspec-propose/SKILL.md' }), 'openspec');
  assert.equal(stepKind('Write', { file_path: '/r/openspec/changes/add-tags/proposal.md' }), 'openspec');
});

test('reads and unrelated skills are neutral', () => {
  assert.equal(stepKind('Read', { file_path: '/r/src/server.js' }), null);
  assert.equal(stepKind('Bash', { command: 'git ls-files && ls openspec' }), null);
  assert.equal(stepKind('Bash', { command: 'node --test 2>&1 | tail -5' }), null);
  assert.equal(stepKind('Skill', { skill: 'debug' }), null);
  assert.equal(stepKind('Bash', { command: 'openspec --version' }), null);
});

test('source edits, including edits through Bash, count as code', () => {
  assert.equal(stepKind('Edit', { file_path: '/r/src/server.js' }), 'code');
  assert.equal(stepKind('Write', { file_path: '/r/test/tags.test.js' }), 'code');
  assert.equal(stepKind('Bash', { command: "python3 - <<'EOF'\np='src/store.js'\nopen(p,'w').write(s)\nEOF" }), 'code');
  assert.equal(stepKind('Bash', { command: 'cat > src/tags.js <<EOF\nx\nEOF' }), 'code');
  assert.equal(stepKind('Bash', { command: "sed -i '' 's/a/b/' src/store.js" }), 'code');
  assert.equal(stepKind('Bash', { command: 'cat > openspec/changes/a/tasks.md <<EOF\nx\nEOF' }), 'openspec');
});

test('first decisive step wins, neutral steps are skipped', () => {
  assert.equal(classifyRun(run(['Read', { file_path: 'src/a.js' }], ['Edit', { file_path: 'src/a.js' }], ['Skill', { skill: 'openspec-propose' }])).outcome, 'code_first');
  assert.equal(classifyRun(run(['Read', { file_path: 'src/a.js' }], ['Skill', { skill: 'openspec-propose' }], ['Edit', { file_path: 'src/a.js' }])).outcome, 'openspec_first');
  const none = classifyRun(run(['Read', { file_path: 'src/a.js' }]));
  assert.equal(none.outcome, 'neither');
  assert.equal(none.firstStep, null);
  assert.equal(none.openspecSkillsLoaded, 2);
});

test('empty run is neither', () => {
  assert.deepEqual(classifyRun([]), { outcome: 'neither', firstStep: null, toolCalls: 0, openspecSkillsLoaded: 0 });
});
