// Pure, testable logic extracted from index.html.
// No DOM, no network — safe to import from Node for unit tests.

import { isAdult } from "./shared.js";
export { isAdult };

export const MAX_POINTS = 100000;
export const MODE_NONE = "none";
export const MODE_PERSON = "person";
export const MODE_ANYONE = "anyone";

// ── Points ───────────────────────────────────────────────────────────────────

/** A whole number of points from 1 to MAX_POINTS, or 0 when the input is not one. */
export function clampPoints(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(n, MAX_POINTS);
}

export function formatPoints(n) {
  const value = Number(n) || 0;
  return `${value.toLocaleString("en-US")} ${value === 1 ? "point" : "points"}`;
}

const num = (v) => Number(v) || 0;

/**
 * The balance. Nothing stores it: it is every kind of earned point, less what
 * has been put toward goals. `available` never reads below zero, though
 * `overdrawn` says when it would (a decision taken back after the points were
 * put toward a goal).
 */
export function balance(totals) {
  const earned = num(totals?.self) + num(totals?.direct) + num(totals?.open) + num(totals?.auto);
  const spent = num(totals?.spent);
  return { earned, spent, available: Math.max(0, earned - spent), overdrawn: Math.max(0, spent - earned) };
}

// ── Verifier choice ──────────────────────────────────────────────────────────

/** The members a claim can be sent to: every other adult who can open the app.
 *  `appMembers` is null when the hub did not say; the roster is used then. */
export function verifierChoices(meId, members, appMembers) {
  const pool = appMembers?.length ? appMembers : members ?? [];
  return pool.filter(m => m.id !== meId && isAdult(m));
}

/**
 * A stored prefs row as `{ mode, verifierId }`. A named verifier who is no
 * longer a choice (they left, or lost access) falls back to "none", so the
 * form never offers to send a claim to nobody.
 */
export function normalizePrefs(row, choices) {
  const ids = new Set((choices ?? []).map(m => m.id));
  if (row?.verifier_mode === MODE_ANYONE && ids.size) return { mode: MODE_ANYONE, verifierId: "" };
  if (row?.verifier_mode === MODE_PERSON && ids.has(row.verifier_id)) return { mode: MODE_PERSON, verifierId: row.verifier_id };
  return { mode: MODE_NONE, verifierId: "" };
}

/** The `<select>` value for a choice, and back. */
export function choiceValue({ mode, verifierId }) {
  return mode === MODE_PERSON ? `person:${verifierId}` : mode;
}

export function parseChoice(value) {
  const text = String(value ?? "");
  if (text.startsWith("person:") && text.length > 7) return { mode: MODE_PERSON, verifierId: text.slice(7) };
  if (text === MODE_ANYONE) return { mode: MODE_ANYONE, verifierId: "" };
  return { mode: MODE_NONE, verifierId: "" };
}

// ── Claims ───────────────────────────────────────────────────────────────────

/** The one decision on each open claim, by claim id. */
export function decisionsByClaim(decisions) {
  return new Map((decisions ?? []).map(d => [d.claim_id, d]));
}

/**
 * Whether `meId` may decide this direct claim. Mirrors the row policy: only
 * the named verifier writes the decision columns, and a decided claim is frozen.
 */
export function canDecideDirect(meId, claim) {
  return !!meId && !!claim && claim.verifier_id === meId && claim.member_id !== meId && claim.status === "pending";
}

/** Whether `meId` may decide this open claim: anyone but its owner, once. */
export function canDecideOpen(meId, claim, decision) {
  return !!meId && !!claim && claim.member_id !== meId && !decision;
}

/** A pending claim can be withdrawn by the member who filed it. */
export function canWithdraw(meId, item) {
  return !!meId && item.memberId === meId && item.state === "pending" && (item.kind === "direct" || item.kind === "open");
}

/**
 * Everything that earned (or may earn) `meId` points, newest first, as one
 * list. Each item:
 *   kind    "self" | "direct" | "open" | "auto"
 *   state   "counted" | "pending" | "denied"
 *   points  what counts (or, while pending or denied, what was asked for)
 *   by      who verified or will verify it ("" for self, auto, or an open claim nobody has taken)
 *   self    true when the member verified their own claim — counted, but shown
 *           as self-logged, never as verified
 */
export function activityFeed({ meId, entries, directClaims, openClaims, decisions, autoAwards }) {
  const byClaim = decisionsByClaim(decisions);
  const items = [];
  for (const e of entries ?? []) {
    if (e.member_id !== meId) continue;
    items.push({ kind: "self", id: e.id, memberId: meId, at: e.created_at, note: e.note ?? "", points: num(e.points), state: "counted", by: "", self: false });
  }
  for (const c of directClaims ?? []) {
    if (c.member_id !== meId) continue;
    const approved = c.status === "approved";
    items.push({
      kind: "direct", id: c.id, memberId: meId, at: c.created_at, note: c.note ?? "",
      points: approved ? num(c.points_granted) : num(c.points_requested), asked: num(c.points_requested),
      state: approved ? "counted" : c.status === "denied" ? "denied" : "pending",
      by: c.verifier_id, self: c.verifier_id === meId,
    });
  }
  for (const c of openClaims ?? []) {
    if (c.member_id !== meId) continue;
    const d = byClaim.get(c.id);
    const approved = d?.status === "approved";
    items.push({
      kind: "open", id: c.id, memberId: meId, at: c.created_at, note: c.note ?? "",
      points: approved ? num(d.points_granted) : num(c.points_requested), asked: num(c.points_requested),
      state: approved ? "counted" : d ? "denied" : "pending",
      by: d?.decided_by ?? "", self: d?.decided_by === meId,
    });
  }
  for (const a of autoAwards ?? []) {
    if (a.member_id !== meId) continue;
    items.push({ kind: "auto", id: a.id, memberId: meId, at: a.awarded_at, note: a.note ?? "", points: num(a.points), state: "counted", by: "", self: false });
  }
  return items.sort((a, b) => String(b.at).localeCompare(String(a.at)) || String(b.id).localeCompare(String(a.id)));
}

/** Points asked for and not yet decided. */
export function pendingPoints(feed) {
  return (feed ?? []).reduce((sum, item) => sum + (item.state === "pending" ? item.points : 0), 0);
}

/** How a feed item reads: a short label and a tone for its badge. */
export function itemStatus(item, nameOf) {
  const who = item.by ? nameOf(item.by) : "";
  if (item.kind === "auto") return { label: "Automatic", tone: "ok" };
  if (item.kind === "self" || (item.self && item.state === "counted")) return { label: "Self-logged", tone: "plain" };
  if (item.state === "counted") return { label: `Verified by ${who}`, tone: "ok" };
  if (item.state === "denied") return { label: who ? `Denied by ${who}` : "Denied", tone: "no" };
  if (item.kind === "direct") return { label: `Waiting for ${who}`, tone: "wait" };
  return { label: "Waiting for anyone", tone: "wait" };
}

/**
 * The claims `meId` can decide right now, oldest first so nobody waits behind
 * a newer one: direct claims addressed to them, and open claims nobody has taken.
 */
export function toVerify({ meId, directClaims, openClaims, decisions }) {
  const byClaim = decisionsByClaim(decisions);
  const items = [];
  for (const c of directClaims ?? []) {
    if (canDecideDirect(meId, c)) items.push({ kind: "direct", id: c.id, memberId: c.member_id, at: c.created_at, note: c.note ?? "", points: num(c.points_requested) });
  }
  for (const c of openClaims ?? []) {
    if (canDecideOpen(meId, c, byClaim.get(c.id))) items.push({ kind: "open", id: c.id, memberId: c.member_id, at: c.created_at, note: c.note ?? "", points: num(c.points_requested) });
  }
  return items.sort((a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)));
}

// ── Goals ────────────────────────────────────────────────────────────────────

/** A goal with its progress. `allocated` is the points put toward it so far. */
export function goalView(goal, allocated) {
  const cost = Math.max(1, num(goal?.cost_points));
  const put = Math.max(0, num(allocated));
  return {
    cost, allocated: put,
    remaining: Math.max(0, cost - put),
    pct: Math.min(1, put / cost),
    reached: put >= cost,
  };
}

/** The most that can be put toward a goal now: what it still needs, capped by the balance. */
export function maxAllocation(view, available) {
  return Math.max(0, Math.min(num(view?.remaining), num(available)));
}

/** A member's own goals: those still being saved for first, then reached ones. */
export function sortGoals(goals, progress) {
  const reached = (g) => goalView(g, progress?.get?.(g.id)).reached;
  return [...(goals ?? [])].sort((a, b) =>
    Number(reached(a)) - Number(reached(b)) || String(b.created_at).localeCompare(String(a.created_at)));
}

// ── Search ───────────────────────────────────────────────────────────────────

/** Everything a member might type to find a feed item: what they did, how it
 *  was verified, and who by. `statusLabel` is passed in so this stays pure. */
export function searchableFields(item, statusLabel) {
  return [item.note, statusLabel, String(item.points)];
}
