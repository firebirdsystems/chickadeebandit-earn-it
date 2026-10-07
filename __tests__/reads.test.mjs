import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";
import { READS, READ_ORDER, firstRenderBatch, namedResults } from "../src/reads.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenarios = JSON.parse(readFileSync(join(__dirname, "../scenarios.json"), "utf-8")).scenarios;
const replayed = new Set(scenarios.flatMap(s => s.steps).filter(step => step.action === "db").map(step => step.sql));

// Every read touches a governed table, and the hub refuses a governed
// statement whose shape it cannot rewrite. Nothing in this repo can check
// that; scenarios.json can, because the hub replays it against the real
// runtime. So a read that is not replayed there is a read nobody has proven.
describe("first-render reads", () => {
  it("are each replayed in scenarios.json, byte for byte", () => {
    for (const name of READ_ORDER) {
      expect(replayed.has(READS[name]), `READS.${name} is not a db step in scenarios.json`).toBe(true);
    }
  });

  it("read only this app's tables, one statement each", () => {
    for (const [name, sql] of Object.entries(READS)) {
      expect(sql, name).toMatch(/^SELECT /);
      expect(sql, name).not.toMatch(/;|--/);
      for (const table of sql.match(/FROM\s+(\w+)/g) ?? []) expect(table, name).toMatch(/\sapp_earn_it__/);
    }
  });

  it("bind the viewer wherever a statement has a placeholder", () => {
    const batch = firstRenderBatch("me-1");
    expect(batch).toHaveLength(READ_ORDER.length);
    for (const { sql, params = [] } of batch) {
      expect((sql.match(/\?/g) ?? []).length, sql).toBe(params.length);
      for (const p of params) expect(p).toBe("me-1");
    }
  });

  it("name batch results in the order they were sent", () => {
    const results = READ_ORDER.map((name) => ({ rows: [{ name }] }));
    const named = namedResults(results);
    for (const name of READ_ORDER) expect(named[name]).toEqual([{ name }]);
    expect(namedResults(undefined).prefs).toEqual([]);
  });
});
