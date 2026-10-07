import { describe, it, expect } from "vitest";
import { medalBird, targetBird } from "../src/art.js";

describe("drawings", () => {
  for (const [name, draw] of [["medalBird", medalBird], ["targetBird", targetBird]]) {
    it(`${name} is one labelled svg at the size asked for`, () => {
      const svg = draw(40);
      expect(svg.match(/<svg/g)).toHaveLength(1);
      expect(svg).toMatch(/width="40" height="40"/);
      expect(svg).toMatch(/role="img" aria-label="A chickadee [^"]+"/);
      expect(svg.trim().endsWith("</svg>")).toBe(true);
    });

    it(`${name} carries no markup that could run or load anything`, () => {
      expect(draw()).not.toMatch(/<script|href=|url\(|on[a-z]+=/i);
    });
  }
});
