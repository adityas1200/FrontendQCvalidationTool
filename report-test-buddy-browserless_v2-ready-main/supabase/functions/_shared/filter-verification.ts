const normalize = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
export function filterValuesEqual(actual: unknown, requested: unknown): boolean {
  const a = normalize(actual), b = normalize(requested);
  if (!a || !b) return false;
  if (a === b) return true;
  const coded = /^([a-z]*\d+[a-z0-9]*)\s*[-–—:]\s*\S.+$/i;
  const left = a.match(coded), right = b.match(coded);
  return !!left && !!right && left[1] === right[1];
}
/** Exact key first, then case/whitespace-insensitive (e.g. "View By" vs "View by"). */
export function lookupObservedFilter(observed: any, key: string): any {
  if (!observed || typeof observed !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(observed, key)) return observed[key];
  const want = normalize(key);
  if (!want) return undefined;
  const found = Object.keys(observed).find((k) => normalize(k) === want);
  return found ? observed[found] : undefined;
}
export function verifyFilterEvidence(requested: Record<string, any>, observed: any) {
  const evidence = Object.entries(requested || {}).filter(([key]) => !key.startsWith("__")).map(([key, value]) => {
    const entry = lookupObservedFilter(observed, key);
    // Legacy scripts record the displayed filter text as `selected`; never
    // substitute the requested `option` or a boolean selection flag.
    const actual = entry && typeof entry === "object" ? entry.observed ?? entry.verified ?? entry.actual ?? (typeof entry.selected === "string" ? entry.selected : undefined) : entry;
    const selection = entry && typeof entry === "object" && entry.ok === false ? "failed" : actual == null ? "unobserved" : "observed";
    const verified = selection !== "failed" && filterValuesEqual(actual, value);
    return { key, requested: value, observed: actual ?? null, selection_outcome: selection, verification_outcome: verified ? "verified" : "failed", error: verified ? null : String(entry?.error || "FILTER_NOT_VERIFIED") };
  });
  return { ok: evidence.every(item => item.verification_outcome === "verified"), evidence };
}