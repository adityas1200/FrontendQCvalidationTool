import { describe, expect, it } from "vitest";
import { effectiveRunBounds } from "./runTiming";

describe("effectiveRunBounds", () => {
  it("ignores late finished_at after last result activity", () => {
    const run = {
      status: "completed",
      started_at: "2026-11-26T08:47:40.435808+00:00",
      finished_at: "2026-11-26T10:30:16.981+00:00",
    };
    const results = [
      { created_at: "2026-11-26T08:48:29.8433+00:00" },
      { created_at: "2026-11-26T09:47:54.388822+00:00" },
    ];
    const bounds = effectiveRunBounds(run, results);
    const wallSec = Math.round((bounds.endMs - bounds.startMs) / 1000);
    expect(wallSec).toBe(3614);
    expect(wallSec).toBeLessThan(4000);
    expect(Date.parse(run.finished_at) - bounds.endMs).toBeGreaterThan(2500_000);
  });
});
