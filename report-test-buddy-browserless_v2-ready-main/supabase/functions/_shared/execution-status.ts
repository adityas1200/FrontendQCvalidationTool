export type ExecutionOutcome = "passed" | "comparison_failed" | "execution_failed" | "partial" | "cancelled" | "pending";
const cancelled = /^(cancelled|canceled)$/i;
// Filter verification is informational only — do not treat filter_* as execution failure.
const failure = /auth|browserless|timeout|navigation|execution.*fail|scrape.*fail|error/i;
const filterVerificationError = /^filter verification failed$|^reference filter verification failed$/i;
function isSoftWaitTimeout(node: Record<string, any>): boolean {
  // Script wait helpers often record ok:false + timeout while the parent
  // navigation/extract still succeeds (e.g. performance_ready.loading).
  return node.timeout === true || String(node.ended_by || "").toLowerCase() === "timeout";
}

function isFilterVerificationOnlyPartial(row: any): boolean {
  const actual = row?.actual;
  if (!actual || typeof actual !== "object") return false;
  if (filterVerificationError.test(String(actual.error || ""))) return true;
  if (actual.filter_verification?.ok === false) return true;
  return false;
}

export function executionErrors(value: unknown, depth = 0, seen = new Set<object>()): string[] {
  if (!value || typeof value !== "object" || depth > 12 || seen.has(value)) return [];
  seen.add(value);
  const node = value as Record<string, any>;
  const errors: string[] = [];
  if (node.ok === false) {
    const msg = String(node.error || node.message || "").trim();
    if (msg) {
      if (!filterVerificationError.test(msg)) errors.push(msg);
    } else if (!isSoftWaitTimeout(node)) errors.push("Execution failed");
  }
  else if (typeof node.error === "string" && node.error.trim()) {
    if (!filterVerificationError.test(node.error)) errors.push(node.error);
  }
  // filter_verification.ok === false is intentionally ignored — extraction/compare decide pass/fail.
  for (const [key, child] of Object.entries(node)) {
    // Business data/table cells are not execution metadata.
    if (["rows", "data", "headers", "columns", "diff", "filter_verification"].includes(key)) continue;
    if (child && typeof child === "object") errors.push(...executionErrors(child, depth + 1, seen));
  }
  return errors;
}
export function deriveExecutionOutcome(row: any, comparison: "pass" | "fail" | "pending"): ExecutionOutcome {
  const statuses = [row?.status, row?.actual?.execution_status, row?.expected?.execution_status,
    row?.actual?.execution?.failure_category, row?.actual?.execution?.status,
    row?.expected?.execution?.failure_category, row?.diff?.__execution?.failure_category].map(s => String(s ?? ""));
  if (statuses.some(s => cancelled.test(s))) return "cancelled";
  const execErrs = [...executionErrors(row?.actual), ...executionErrors(row?.expected)];
  if (statuses.some(s => failure.test(s)) || execErrs.length) return "execution_failed";
  // Stale partial_extraction rows caused only by filter verification should compare normally.
  const filterOnlyPartial = statuses.some(s => /partial/i.test(s)) && isFilterVerificationOnlyPartial(row);
  if (statuses.some(s => /partial/i.test(s)) && !filterOnlyPartial) return "partial";
  if (statuses.some(s => /^(pending|running|queued|unresolved|unexecuted)$/i.test(s))) return "pending";
  return comparison === "pass" ? "passed" : comparison === "fail" ? "comparison_failed" : "pending";
}
export function outcomeStatus(outcome: ExecutionOutcome): "pass" | "fail" | "pending" {
  return outcome === "passed" ? "pass" : outcome === "pending" ? "pending" : "fail";
}
export function outcomeCounts(outcomes: ExecutionOutcome[]) {
  const count = (outcome: ExecutionOutcome) => outcomes.filter(o => o === outcome).length;
  const passed = count("passed"), comparison_failed = count("comparison_failed"), execution_failed = count("execution_failed"), partial = count("partial"), cancelledCount = count("cancelled"), pending = count("pending");
  return { passed, comparison_failed, execution_failed, partial, cancelled: cancelledCount, pending, unresolved: pending, pass: passed, fail: comparison_failed + execution_failed + partial, total: outcomes.length };
}