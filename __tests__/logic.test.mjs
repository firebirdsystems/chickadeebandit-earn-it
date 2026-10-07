import { describe, it, expect } from "vitest";
import {
  MAX_POINTS, MODE_NONE, MODE_PERSON, MODE_ANYONE,
  clampPoints, formatPoints, balance,
  verifierChoices, normalizePrefs, choiceValue, parseChoice,
  decisionsByClaim, canDecideDirect, canDecideOpen, canWithdraw,
  activityFeed, pendingPoints, itemStatus, toVerify,
  goalView, maxAllocation, sortGoals, searchableFields,
} from "../src/logic.js";

const ana = { id: "ana", name: "Ana", role: "adult" };
const ben = { id: "ben", name: "Ben", role: "adult" };
const cy = { id: "cy", name: "Cy", role: "admin" };
const kid = { id: "kid", name: "Kit", role: "child" };
const nameOf = (id) => ({ ana: "Ana", ben: "Ben", cy: "Cy" })[id] ?? "Someone";

describe("points", () => {
  it("accepts whole points from 1 to the cap, and nothing else", () => {
    expect(clampPoints("5")).toBe(5);
    expect(clampPoints(2.6)).toBe(3);
    expect(clampPoints(0)).toBe(0);
    expect(clampPoints(-4)).toBe(0);
    expect(clampPoints("abc")).toBe(0);
    expect(clampPoints("")).toBe(0);
    expect(clampPoints(MAX_POINTS * 5)).toBe(MAX_POINTS);
  });

  it("writes one point in the singular", () => {
    expect(formatPoints(1)).toBe("1 point");
    expect(formatPoints(0)).toBe("0 points");
    expect(formatPoints(1250)).toBe("1,250 points");
    expect(formatPoints(null)).toBe("0 points");
  });

  it("derives the balance from every kind of earned point, less what was put toward goals", () => {
    expect(balance({ self: 8, direct: 15, open: 10, auto: 7, spent: 32 })).toEqual({ earned: 40, spent: 32, available: 8, overdrawn: 0 });
  });

  it("never shows a negative balance, and says by how much it is over", () => {
    expect(balance({ self: 5, spent: 20 })).toEqual({ earned: 5, spent: 20, available: 0, overdrawn: 15 });
    expect(balance(null)).toEqual({ earned: 0, spent: 0, available: 0, overdrawn: 0 });
  });
});

describe("verifier choice", () => {
  it("offers every other adult, not the member themself and not children", () => {
    expect(verifierChoices("ana", [ana, ben, cy, kid], null).map(m => m.id)).toEqual(["ben", "cy"]);
  });

  it("uses the members who can open the app when the hub names them", () => {
    expect(verifierChoices("ana", [ana, ben, cy], [ana, ben]).map(m => m.id)).toEqual(["ben"]);
    expect(verifierChoices("ana", [ana, ben, cy], []).map(m => m.id)).toEqual(["ben", "cy"]);
  });

  it("reads a stored choice back", () => {
    expect(normalizePrefs({ verifier_mode: "person", verifier_id: "ben" }, [ben, cy])).toEqual({ mode: MODE_PERSON, verifierId: "ben" });
    expect(normalizePrefs({ verifier_mode: "anyone", verifier_id: null }, [ben])).toEqual({ mode: MODE_ANYONE, verifierId: "" });
    expect(normalizePrefs(null, [ben])).toEqual({ mode: MODE_NONE, verifierId: "" });
  });

  it("falls back to self-logging when the named verifier is no longer a choice", () => {
    expect(normalizePrefs({ verifier_mode: "person", verifier_id: "gone" }, [ben])).toEqual({ mode: MODE_NONE, verifierId: "" });
    expect(normalizePrefs({ verifier_mode: "anyone" }, [])).toEqual({ mode: MODE_NONE, verifierId: "" });
  });

  it("round-trips a choice through the select value", () => {
    for (const choice of [{ mode: MODE_NONE, verifierId: "" }, { mode: MODE_ANYONE, verifierId: "" }, { mode: MODE_PERSON, verifierId: "ben" }]) {
      expect(parseChoice(choiceValue(choice))).toEqual(choice);
    }
    expect(parseChoice(undefined)).toEqual({ mode: MODE_NONE, verifierId: "" });
    expect(parseChoice("person:")).toEqual({ mode: MODE_NONE, verifierId: "" });
  });
});

const direct = (over = {}) => ({ id: "c1", member_id: "ana", verifier_id: "ben", note: "Gym", points_requested: 10, status: "pending", points_granted: null, created_at: "2026-01-02T00:00:00Z", ...over });
const open = (over = {}) => ({ id: "o1", member_id: "ana", note: "Book", points_requested: 5, created_at: "2026-01-03T00:00:00Z", ...over });
const decision = (over = {}) => ({ id: "d1", claim_id: "o1", member_id: "ana", decided_by: "cy", status: "approved", points_granted: 4, decided_at: "2026-01-04T00:00:00Z", ...over });

describe("who may decide a claim (mirrors the row policies)", () => {
  it("lets only the named verifier decide a pending direct claim", () => {
    expect(canDecideDirect("ben", direct())).toBe(true);
    expect(canDecideDirect("ana", direct())).toBe(false);
    expect(canDecideDirect("cy", direct())).toBe(false);
    expect(canDecideDirect("ben", direct({ status: "approved" }))).toBe(false);
    expect(canDecideDirect(undefined, direct())).toBe(false);
  });

  it("does not offer a member their own self-addressed claim", () => {
    expect(canDecideDirect("ana", direct({ verifier_id: "ana" }))).toBe(false);
  });

  it("lets anyone but the owner decide an open claim, once", () => {
    expect(canDecideOpen("ben", open(), undefined)).toBe(true);
    expect(canDecideOpen("ana", open(), undefined)).toBe(false);
    expect(canDecideOpen("ben", open(), decision())).toBe(false);
  });
});

describe("activity feed", () => {
  const data = {
    meId: "ana",
    entries: [
      { id: "e1", member_id: "ana", points: 5, note: "Run", created_at: "2026-01-01T00:00:00Z" },
      { id: "e9", member_id: "ben", points: 99, note: "Not mine", created_at: "2026-01-09T00:00:00Z" },
    ],
    directClaims: [
      direct(),
      direct({ id: "c2", status: "approved", points_granted: 8, created_at: "2026-01-05T00:00:00Z" }),
      direct({ id: "c3", status: "denied", points_granted: 0, created_at: "2026-01-06T00:00:00Z" }),
      direct({ id: "c4", member_id: "ben", verifier_id: "ana", created_at: "2026-01-07T00:00:00Z" }),
    ],
    openClaims: [open(), open({ id: "o2", created_at: "2026-01-08T00:00:00Z" }), open({ id: "o3", member_id: "cy" })],
    decisions: [decision()],
    autoAwards: [{ id: "w1", member_id: "ana", points: 7, note: "Streak", awarded_at: "2026-01-10T00:00:00Z" }],
  };
  const items = activityFeed(data);
  const byId = Object.fromEntries(items.map(i => [i.id, i]));

  it("holds only the member's own points, newest first", () => {
    expect(items.map(i => i.id)).toEqual(["w1", "o2", "c3", "c2", "o1", "c1", "e1"]);
  });

  it("counts what the verifier granted, not what was asked for", () => {
    expect(byId.c2).toMatchObject({ state: "counted", points: 8, asked: 10, by: "ben" });
    expect(byId.o1).toMatchObject({ state: "counted", points: 4, asked: 5, by: "cy" });
  });

  it("shows what was asked for while a claim waits or after it is denied", () => {
    expect(byId.c1).toMatchObject({ state: "pending", points: 10 });
    expect(byId.o2).toMatchObject({ state: "pending", points: 5, by: "" });
    expect(byId.c3).toMatchObject({ state: "denied", points: 10 });
  });

  it("adds up only the points still waiting", () => {
    expect(pendingPoints(items)).toBe(15);
    expect(pendingPoints([])).toBe(0);
  });

  it("labels each item by how it was verified", () => {
    expect(itemStatus(byId.e1, nameOf)).toEqual({ label: "Self-logged", tone: "plain" });
    expect(itemStatus(byId.w1, nameOf)).toEqual({ label: "Automatic", tone: "ok" });
    expect(itemStatus(byId.c2, nameOf)).toEqual({ label: "Verified by Ben", tone: "ok" });
    expect(itemStatus(byId.c1, nameOf)).toEqual({ label: "Waiting for Ben", tone: "wait" });
    expect(itemStatus(byId.c3, nameOf)).toEqual({ label: "Denied by Ben", tone: "no" });
    expect(itemStatus(byId.o2, nameOf)).toEqual({ label: "Waiting for anyone", tone: "wait" });
    expect(itemStatus(byId.o1, nameOf)).toEqual({ label: "Verified by Cy", tone: "ok" });
  });

  it("never calls a claim the member approved themself verified", () => {
    const own = activityFeed({
      meId: "ana",
      directClaims: [direct({ verifier_id: "ana", status: "approved", points_granted: 10 })],
      openClaims: [open()],
      decisions: [decision({ decided_by: "ana" })],
    });
    for (const item of own) {
      expect(item).toMatchObject({ state: "counted", self: true });
      expect(itemStatus(item, nameOf)).toEqual({ label: "Self-logged", tone: "plain" });
    }
  });

  it("offers Withdraw on the member's own pending claims only", () => {
    expect(canWithdraw("ana", byId.c1)).toBe(true);
    expect(canWithdraw("ana", byId.o2)).toBe(true);
    expect(canWithdraw("ana", byId.c2)).toBe(false);
    expect(canWithdraw("ana", byId.e1)).toBe(false);
    expect(canWithdraw("ben", byId.c1)).toBe(false);
  });

  it("is findable by what was done and by who verified it", () => {
    const fields = searchableFields(byId.c2, itemStatus(byId.c2, nameOf).label);
    expect(fields).toContain("Gym");
    expect(fields).toContain("Verified by Ben");
  });
});

describe("claims waiting for a member", () => {
  it("lists direct claims addressed to them and open claims nobody has taken, oldest first", () => {
    const list = toVerify({
      meId: "ben",
      directClaims: [direct({ id: "c2", created_at: "2026-01-09T00:00:00Z" }), direct(), direct({ id: "c3", status: "approved" }), direct({ id: "c4", verifier_id: "cy" })],
      openClaims: [open(), open({ id: "o2", created_at: "2026-01-05T00:00:00Z" }), open({ id: "o3", member_id: "ben" })],
      decisions: [decision()],
    });
    expect(list.map(i => [i.kind, i.id])).toEqual([["direct", "c1"], ["open", "o2"], ["direct", "c2"]]);
    expect(list[0]).toMatchObject({ memberId: "ana", points: 10, note: "Gym" });
  });

  it("is empty for the claimant", () => {
    expect(toVerify({ meId: "ana", directClaims: [direct()], openClaims: [open()], decisions: [] })).toEqual([]);
  });

  it("indexes decisions by claim", () => {
    expect(decisionsByClaim([decision()]).get("o1").decided_by).toBe("cy");
    expect(decisionsByClaim(undefined).size).toBe(0);
  });
});

describe("goals", () => {
  const goal = { id: "g1", cost_points: 60, created_at: "2026-01-01T00:00:00Z" };

  it("reports progress toward the cost", () => {
    expect(goalView(goal, 15)).toEqual({ cost: 60, allocated: 15, remaining: 45, pct: 0.25, reached: false });
    expect(goalView(goal, undefined)).toMatchObject({ allocated: 0, remaining: 60, pct: 0, reached: false });
  });

  it("is reached at the cost, and never reads past it", () => {
    expect(goalView(goal, 60)).toMatchObject({ remaining: 0, pct: 1, reached: true });
    expect(goalView(goal, 75)).toMatchObject({ remaining: 0, pct: 1, reached: true });
  });

  it("caps an allocation by what the goal needs and by the balance", () => {
    expect(maxAllocation(goalView(goal, 15), 100)).toBe(45);
    expect(maxAllocation(goalView(goal, 15), 20)).toBe(20);
    expect(maxAllocation(goalView(goal, 60), 20)).toBe(0);
    expect(maxAllocation(goalView(goal, 15), 0)).toBe(0);
  });

  it("lists goals still being saved for before reached ones", () => {
    const goals = [
      { id: "old", cost_points: 10, created_at: "2026-01-01T00:00:00Z" },
      { id: "done", cost_points: 10, created_at: "2026-01-03T00:00:00Z" },
      { id: "new", cost_points: 10, created_at: "2026-01-02T00:00:00Z" },
    ];
    expect(sortGoals(goals, new Map([["done", 10]])).map(g => g.id)).toEqual(["new", "old", "done"]);
  });
});
