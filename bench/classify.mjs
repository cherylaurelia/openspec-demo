// Classify one Claude Code stream-json run: did the agent enter OpenSpec before touching code?

const OPENSPEC_PATH = /(^|\/)(\.claude\/(skills\/openspec-|commands\/opsx\/)|openspec\/)/;
const BASH_WRITE = /(^|[^<>&0-9])>{1,2}\s*[^&\s]|\bsed\s+-i|\btee\b|\bwriteFileSync\b|open\([^)]*['"][wa]\+?['"]|\bmv\b|\bcp\b|\brm\b|\bpatch\b|\bgit\s+apply\b/;

/** Return the step kind for one tool call: 'openspec', 'code', or null (neutral, e.g. a read). */
export function stepKind(name, input) {
  if (name === 'Skill' || name === 'SlashCommand') {
    const target = String(input.skill ?? input.command ?? input.name ?? '');

    return /openspec|opsx/i.test(target) ? 'openspec' : null;
  }

  const path = String(input.file_path ?? input.notebook_path ?? input.path ?? '');

  if (name === 'Read' || name === 'Glob' || name === 'Grep') {
    return /\.claude\/(skills\/openspec-|commands\/opsx\/)/.test(path) ? 'openspec' : null;
  }

  if (name === 'Edit' || name === 'Write' || name === 'MultiEdit' || name === 'NotebookEdit') {
    return OPENSPEC_PATH.test(path) ? 'openspec' : 'code';
  }

  if (name === 'Bash') {
    const cmd = String(input.command ?? '');

    if (/(^|[;&|]\s*|\n)\s*(npx\s+)?openspec\s+(new|instructions|status|validate|archive|show|list)\b/.test(cmd)) return 'openspec';

    if (BASH_WRITE.test(cmd)) return /openspec\/changes\//.test(cmd) ? 'openspec' : 'code';
  }

  return null;
}

/** Walk the run's events in order and return the outcome plus the first decisive step. */
export function classifyRun(events) {
  const steps = [];
  let skills = [];

  for (const e of events) {
    if (e.type === 'system' && e.subtype === 'init') skills = e.skills ?? [];

    if (e.type !== 'assistant') continue;

    for (const c of e.message?.content ?? []) {
      if (c.type !== 'tool_use') continue;
      steps.push({ name: c.name, kind: stepKind(c.name, c.input ?? {}), input: c.input ?? {} });
    }
  }

  const first = steps.find((s) => s.kind !== null);
  const outcome = first === undefined ? 'neither' : first.kind === 'openspec' ? 'openspec_first' : 'code_first';

  return {
    outcome,
    firstStep: first === undefined ? null : { name: first.name, detail: summarize(first) },
    toolCalls: steps.length,
    openspecSkillsLoaded: skills.filter((s) => s.startsWith('openspec-')).length,
  };
}

function summarize(step) {
  const i = step.input;

  return String(i.skill ?? i.command ?? i.file_path ?? i.path ?? '').slice(0, 160);
}
