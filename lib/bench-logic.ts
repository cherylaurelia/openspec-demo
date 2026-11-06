/** Whether entering OpenSpec was the right call for this run. */
export function runIsGood(expect: string, outcome: string): boolean {
  const entered = outcome === "openspec_first";

  return expect === "enter" ? entered : !entered;
}
