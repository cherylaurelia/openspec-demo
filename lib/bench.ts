import summary from "@/data/summary.json";

export { runIsGood } from "./bench-logic";

export const REPO = "https://github.com/cherylaurelia/openspec-demo";

export const CONDITIONS = [
  { id: "default", label: "openspec init", note: "default: 6 skills + 6 /opsx commands" },
  { id: "skills-only", label: "skills only", note: "delivery = skills, the #2022 direction" },
  { id: "hint", label: "+ CLAUDE.md line", note: "reference only: the always-on hint #2032 argues against" },
] as const;

export type ConditionId = (typeof CONDITIONS)[number]["id"];

export const bench = summary;

export type BenchPrompt = (typeof summary.prompts)[number];

export type BenchRun = BenchPrompt["cells"][ConditionId]["runs"][number];

export function logUrl(log: string): string {
  return `${REPO}/blob/main/bench/${log}`;
}

export function describeRun(run: BenchRun): string {
  if (run.outcome === "openspec_first") {
    const folder = run.changeFolders.length > 0 ? `, created openspec/changes/${run.changeFolders.join(", ")}` : "";

    return `entered OpenSpec first (${run.firstStep})${folder}`;
  }

  if (run.outcome === "code_first") return `edited code first (${run.firstStep})`;

  return "answered without editing anything or entering OpenSpec";
}
