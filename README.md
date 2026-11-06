# opsx-trigger-bench

Does a plain request get Claude Code into OpenSpec? A small bench that runs real Claude Code sessions in a
fresh `openspec init` project and scores every run for missed triggers and false triggers.

Live page: https://openspec-trigger-bench.vercel.app

Unofficial demo by Cheryl Aurelia: not affiliated with OpenSpec or Fission AI.

## Why

- [#2156](https://github.com/Fission-AI/OpenSpec/issues/2156): the maintainer asks whether OpenSpec should
  require explicitly invoking a skill, or let users describe the job and have the agent route it.
- [#2043](https://github.com/Fission-AI/OpenSpec/issues/2043): a user reports the agent only engages
  propose when told to use the OpenSpec workflow; #2156 asks for explicit-only skills instead.
- [#2022](https://github.com/Fission-AI/OpenSpec/issues/2022): commands are being retired in favor of
  Agent Skills, so skill selection becomes the entry point.

## What it does

1. Copies `bench/fixture` (a 4-file Node notes API), runs `openspec init --tools claude`, and commits it.
   Three conditions:
   - `default`: what `openspec init` installs (6 skills + 6 `/opsx` commands),
   - `skills-only`: `openspec config set delivery skills` first (in a private `XDG_CONFIG_HOME`),
   - `hint`: default plus one CLAUDE.md line pointing at openspec-propose/explore. A reference point,
     not a recommendation (#2032 argues against always-on lines like this).
2. For each prompt in `bench/prompts.json` and each rep, runs `claude -p` in a fresh copy with
   `--setting-sources project` (your own CLAUDE.md, rules and plugins stay out), `--output-format stream-json`.
   It refuses to start if a parent of `--workdir` has an AGENTS.md, CLAUDE.md or `.claude/rules`.
3. `bench/classify.mjs` takes the first decisive tool call: an OpenSpec step (an openspec skill or `/opsx`
   command, the openspec CLI, reading an openspec skill, writing under `openspec/changes/`) or a source
   edit (Edit/Write, or a Bash command that writes). Reads don't count.
4. Each prompt has an expected behavior, written before running (`enter` or `skip`), so every run is a
   hit, a miss, a false trigger or a correct skip. Git status after the run records change folders and
   touched source files.

## Run it

Needs Node 22+, Claude Code (logged in) and the OpenSpec CLI on PATH.

```bash
cd bench
npm i -g @fission-ai/openspec@latest
node bench.mjs --reps 5                       # all three conditions, 5 parallel-safe temp copies at a time with --jobs
node bench.mjs --only bug-empty --reps 1      # one prompt
node bench.mjs --skills ./my-skills           # copy edited SKILL.md folders over .claude/skills after init
node summarize.mjs results/<stamp>/results.json ../data/summary.json
node --test                                   # classifier and summary tests
```

Telemetry is off in every run (`DO_NOT_TRACK=1`, `OPENSPEC_TELEMETRY=0`). Each run costs a few cents of
Claude usage.

## Results in this repo

`bench/results/<stamp>/` has `results.json`, `runs.jsonl` and every run's stream-json log. The page reads
`data/summary.json`.

## Limits

One agent, one model, headless; a tiny fixture app; runs stop after 8 turns (enough for the first decisive
step); 5 reps per cell is enough to see a pattern, not to quote a rate.

## Page

Next.js + Tailwind, `npm run build && npm start`. Colors and type follow openspec.dev.
