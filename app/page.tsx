import { CONDITIONS, REPO, bench, describeRun, logUrl, runIsGood, type BenchPrompt, type ConditionId } from "@/lib/bench";

const ISSUE = "https://github.com/Fission-AI/OpenSpec/issues";

function Label({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong md:pt-1">{children}</h2>;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-rule py-8 md:grid-cols-[150px_1fr] md:gap-8">
      <Label>{label}</Label>
      <div className="min-w-0 space-y-4 text-[15px] leading-7 text-ink-dim">{children}</div>
    </section>
  );
}

function Dots({ prompt, condition }: { prompt: BenchPrompt; condition: ConditionId }) {
  const cell = prompt.cells[condition];

  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {cell.runs.map((run) => (
        <span
          key={run.rep}
          className={`inline-block h-2.5 w-2.5 rounded-full border ${
            run.outcome === "openspec_first" ? "border-accent bg-accent" : "border-ink-dim bg-transparent"
          }`}
        />
      ))}
    </span>
  );
}

function ResultCell({ prompt, condition }: { prompt: BenchPrompt; condition: ConditionId }) {
  const cell = prompt.cells[condition];
  const wrong = cell.runs.filter((run) => !runIsGood(prompt.expect, run.outcome)).length;
  const kindOfWrong = prompt.expect === "enter" ? "missed" : "false trigger";

  return (
    <div className="space-y-1">
      <div className="text-ink">
        <span className="text-base font-semibold">
          {cell.entered}/{cell.n}
        </span>{" "}
        <span className="text-xs text-ink-dim">entered</span>
      </div>
      <Dots prompt={prompt} condition={condition} />
      <div className={`text-xs ${wrong > 0 ? "text-accent-strong" : "text-hit"}`}>
        {wrong > 0 ? `${wrong} ${kindOfWrong}` : "all as expected"}
      </div>
    </div>
  );
}

export default function Home() {
  const { meta, prompts, totals } = bench;

  return (
    <main className="mx-auto max-w-[880px] px-5 pb-16 pt-10 md:pt-16">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-4 text-xs uppercase tracking-[0.14em]">
        <span className="font-semibold text-ink">opsx-trigger-bench</span>
        <nav className="flex gap-5 text-ink-dim">
          <a href={REPO}>Repo</a>
          <a href={`${REPO}/tree/main/bench`}>Bench</a>
          <a href="https://openspec.dev/docs">OpenSpec docs ↗</a>
        </nav>
      </header>

      <section className="py-10">
        <h1 className="text-2xl font-medium leading-snug text-ink md:text-[32px] md:leading-tight">
          Does a plain request get Claude Code <em className="font-semibold">into OpenSpec?</em>
        </h1>
        <p className="mt-5 max-w-[640px] text-[15px] leading-7 text-ink-dim">
          Problem: nobody has numbers for how often an agent picks up OpenSpec&apos;s skills when the user just describes the work.
          Fix: a small bench that runs real Claude Code sessions in a fresh <code className="text-ink">openspec init</code> project and
          scores every run for missed triggers and false triggers.
        </p>
        <p className="mt-5 max-w-[640px] border-l-2 border-accent pl-4 text-[15px] leading-7 text-ink">
          Result: plain requests (two features, one &ldquo;what are the options?&rdquo;) entered OpenSpec in 0 of 15 runs, with the default install and again with skills only. Asks that
          said &ldquo;spec&rdquo; or named OpenSpec entered 10 of 10. No false triggers.
        </p>
        <p className="mt-4 text-xs text-ink-dim">
          {meta.runs} runs · OpenSpec {meta.openspec} · Claude Code {meta.claudeCode.replace(" (Claude Code)", "")} · model {meta.model} ·{" "}
          {meta.reps} reps per cell · {meta.startedAt.slice(0, 10)}
        </p>
      </section>

      <Section label="Question">
        <p>
          On <a href={`${ISSUE}/2156`}>#2156</a> Tabish asked{" "}
          <span className="text-ink">&ldquo;whether using OpenSpec should always require explicitly invoking a skill&rdquo;</span>, or whether
          users can describe the job and let the agent route it. <a href={`${ISSUE}/2043`}>#2043</a> reports the agent only engages
          propose when told to; <a href={`${ISSUE}/2156`}>#2156</a> asks for the reverse. With commands going away in{" "}
          <a href={`${ISSUE}/2022`}>#2022</a>, skill selection is the entry point. This measures it instead of guessing.
        </p>
      </Section>

      <Section label="Result">
        <ul className="space-y-2 text-ink">
          <li>
            → Plain feature asks and a fuzzy &ldquo;what are the options?&rdquo;: <strong>0 of 15</strong> runs entered OpenSpec, with the
            default install or skills-only. The agent edited code, or answered in chat without openspec-explore.
          </li>
          <li>
            → Asks that say &ldquo;spec&rdquo; or name OpenSpec: <strong>10 of 10</strong> entered, through propose.
          </li>
          <li>
            → Skills-only behaved the same as the default install on every prompt.
          </li>
          <li>
            → The bug fix never triggered OpenSpec in any condition, so <strong>no false triggers</strong> were seen, even with the
            CLAUDE.md line (25 of 25 entered).
          </li>
        </ul>
        <p>
          Each dot is one run: <span className="text-accent-strong">filled</span> = the agent&apos;s first decisive step was OpenSpec
          (an openspec skill, the openspec CLI, or writing under <code className="text-ink">openspec/changes/</code>); hollow = it edited
          code first or only answered. The expected behavior for each prompt was written down before running.
        </p>
        <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-rule text-xs uppercase tracking-[0.1em] text-ink-dim">
                <th className="py-2 pr-4 font-medium">Request</th>
                {CONDITIONS.map((c) => (
                  <th key={c.id} className="py-2 pr-4 font-medium">
                    <span className="text-ink">{c.label}</span>
                    <span className="block normal-case tracking-normal">{c.note}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prompts.map((p) => (
                <tr key={p.id} className="border-b border-rule align-top">
                  <td className="py-3 pr-4">
                    <span className="block text-ink">&ldquo;{p.text}&rdquo;</span>
                    <span className="text-xs text-ink-dim">
                      {p.kind} · expected: {p.expect === "enter" ? "enter OpenSpec" : "just fix it"}
                    </span>
                  </td>
                  {CONDITIONS.map((c) => (
                    <td key={c.id} className="py-3 pr-4">
                      <ResultCell prompt={p} condition={c.id} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-xs text-ink-dim">
                <td className="py-3 pr-4 uppercase tracking-[0.1em]">Totals</td>
                {CONDITIONS.map((c) => (
                  <td key={c.id} className="py-3 pr-4">
                    hit {totals[c.id].hit} · missed {totals[c.id].missed}
                    <br />
                    false trigger {totals[c.id].falseTrigger} · correct skip {totals[c.id].correctSkip}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs">Raw counts only: {meta.reps} runs per cell is enough to see a pattern, not to quote a rate.</p>
      </Section>

      <Section label="Every run">
        <p>The first decisive step of each run, with its full stream-json log.</p>
        <div className="space-y-5">
          {prompts.map((p) => (
            <details key={p.id} className="border border-rule bg-[#f7f5ec] px-4 py-3">
              <summary className="cursor-pointer text-sm text-ink">&ldquo;{p.text}&rdquo;</summary>
              <div className="mt-3 space-y-3">
                {CONDITIONS.map((c) => (
                  <div key={c.id}>
                    <div className="text-xs uppercase tracking-[0.1em] text-accent-strong">{c.label}</div>
                    <ul className="mt-1 space-y-1 text-xs leading-5">
                      {p.cells[c.id].runs.map((run) => (
                        <li key={run.rep} className="break-words">
                          <a href={logUrl(run.log)}>run {run.rep}</a>:{" "}
                          <span className={runIsGood(p.expect, run.outcome) ? "text-ink-dim" : "text-accent-strong"}>{describeRun(run)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </Section>

      <Section label="How it works">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Copies a 4-file Node notes API, runs <code className="text-ink">openspec init --tools claude</code> (with{" "}
            <code className="text-ink">delivery skills</code> in its own global config for the skills-only column), commits it.
          </li>
          <li>
            Each run gets a fresh copy and one <code className="text-ink">claude -p</code> session with{" "}
            <code className="text-ink">--setting-sources project</code>, so your own CLAUDE.md, rules and plugins stay out. It refuses to
            start if a parent folder has an AGENTS.md or CLAUDE.md that would leak in.
          </li>
          <li>
            <code className="text-ink">classify.mjs</code> walks the tool calls in order and takes the first decisive one: an OpenSpec step,
            or a source edit (Edit/Write, or a Bash command that writes). Reads don&apos;t count. Unit-tested.
          </li>
          <li>After the run, git status records whether a change folder was created and which source files changed.</li>
        </ol>
      </Section>

      <Section label="Run it">
        <pre className="overflow-x-auto border border-rule bg-[#f7f5ec] p-4 text-[13px] leading-6 text-ink">
          {`git clone ${REPO} && cd openspec-demo/bench
npm i -g @fission-ai/openspec@latest   # and Claude Code, logged in
node bench.mjs --reps 5                # all 3 conditions
node bench.mjs --skills ./my-skills    # try edited SKILL.md descriptions
node summarize.mjs results/<stamp>/results.json out.json`}
        </pre>
        <p>
          Edit <code className="text-ink">prompts.json</code> to add requests and their expected behavior. <code className="text-ink">--skills</code>{" "}
          copies your folders over <code className="text-ink">.claude/skills</code> after init, so a new description (for{" "}
          <a href={`${ISSUE}/2043`}>#2043</a>) can be compared against the shipped one on the same prompts. Telemetry is off in every run (
          <code className="text-ink">DO_NOT_TRACK=1</code>).
        </p>
      </Section>

      <Section label="Limits">
        <ul className="list-disc space-y-1 pl-5">
          <li>One agent (Claude Code), one model ({meta.model}), headless; interactive sessions or other agents may differ.</li>
          <li>A tiny fixture app; a large brownfield repo gives the agent more to read before it decides.</li>
          <li>Runs stop after {meta.maxTurns} turns, which is enough to see the first decisive step, not a finished change.</li>
          <li>The expected behavior per prompt is a judgment call, written down before the runs.</li>
        </ul>
      </Section>

      <footer className="border-t border-rule pt-6 text-xs text-ink-dim">
        Unofficial demo by Cheryl Aurelia: not affiliated with OpenSpec or Fission AI. Uses the published{" "}
        <code>@fission-ai/openspec</code> CLI. <a href={REPO}>Source</a>.
      </footer>
    </main>
  );
}
