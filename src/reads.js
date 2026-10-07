// The statements the app reads with at first render, in one batch.
//
// Every table here is governed by a row policy, and the hub refuses a governed
// read whose shape it cannot rewrite. So each statement below is also replayed
// against the real runtime in scenarios.json, and __tests__/reads.test.mjs
// fails when one is missing there.
//
// Totals are SUMs, not sums over the lists: the lists are capped, a balance
// must not be.

export const READS = {
  prefs: "SELECT * FROM app_earn_it__prefs LIMIT 1",
  entries: "SELECT * FROM app_earn_it__entries ORDER BY created_at DESC, id DESC LIMIT 200",
  entriesTotal: "SELECT COALESCE(SUM(points), 0) AS total FROM app_earn_it__entries",
  directClaims: "SELECT * FROM app_earn_it__direct_claims ORDER BY created_at DESC, id DESC LIMIT 300",
  directTotal: "SELECT COALESCE(SUM(points_granted), 0) AS total FROM app_earn_it__direct_claims WHERE member_id = ? AND status = 'approved'",
  openClaims: "SELECT * FROM app_earn_it__open_claims ORDER BY created_at DESC, id DESC LIMIT 300",
  openDecisions: "SELECT * FROM app_earn_it__open_decisions ORDER BY decided_at DESC, id DESC LIMIT 600",
  openTotal: "SELECT COALESCE(SUM(points_granted), 0) AS total FROM app_earn_it__open_decisions WHERE member_id = ? AND status = 'approved'",
  goals: "SELECT * FROM app_earn_it__goals ORDER BY created_at DESC, id DESC LIMIT 200",
  goalProgress: "SELECT goal_id, SUM(points) AS points FROM app_earn_it__allocations GROUP BY goal_id",
  spentTotal: "SELECT COALESCE(SUM(points), 0) AS total FROM app_earn_it__allocations WHERE member_id = ?",
  autoAwards: "SELECT * FROM app_earn_it__auto_awards ORDER BY awarded_at DESC, id DESC LIMIT 100",
  autoTotal: "SELECT COALESCE(SUM(points), 0) AS total FROM app_earn_it__auto_awards",
};

/** Reads whose WHERE names the viewer. */
const TAKES_ME = new Set(["directTotal", "openTotal", "spentTotal"]);

export const READ_ORDER = Object.keys(READS);

/** The first-render batch for `meId`, in READ_ORDER. */
export function firstRenderBatch(meId) {
  return READ_ORDER.map(name => (TAKES_ME.has(name) ? { sql: READS[name], params: [meId] } : { sql: READS[name] }));
}

/** Batch results back to `{ name: rows }`. */
export function namedResults(results) {
  return Object.fromEntries(READ_ORDER.map((name, i) => [name, results?.[i]?.rows ?? []]));
}
