import { describe, it, expect } from "vitest";
import {
  applyAction,
  beginGame,
  createGame,
  makePlayer,
  publicGame,
  RESOURCES,
  type Game,
} from "./game";
function started(count = 3) {
  let g = createGame("ABC123", "p0", "Player 0", count);
  for (let i = 1; i < count; i++)
    g.players.push(makePlayer(`p${i}`, `Player ${i}`, i));
  return beginGame(g, "p0");
}
function finishSetup(g: Game) {
  while (g.phase.startsWith("setup")) {
    const id = g.players[g.turn].id;
    const type = g.phase === "setup-settlement" ? "settlement" : "road";
    let placed = false;
    const length = type === "settlement" ? g.vertices.length : g.edges.length;
    for (let i = 0; i < length; i++) {
      try {
        g = applyAction(
          g,
          id,
          type === "settlement" ? { type, vertex: i } : { type, edge: i },
        );
        placed = true;
        break;
      } catch {}
    }
    if (!placed) throw Error("No " + type + " placement");
  }
  return g;
}
describe("game rules", () => {
  it("builds valid boards and starts a snake placement for three and eight players", () => {
    for (const n of [3, 8]) {
      const g = started(n);
      expect(g.hexes.length).toBe(n > 4 ? 30 : 19);
      expect(g.devDeck.length).toBe(n > 4 ? 34 : 25);
      expect(g.setupOrder.slice(n)).toEqual(g.setupOrder.slice(0, n).reverse());
      expect(new Set(g.setupOrder.slice(0, n)).size).toBe(n);
      const boardResources = g.hexes.filter((h) => h.terrain !== "desert");
      expect(boardResources.every((h) => h.number !== null)).toBe(true);
      const red = g.hexes.filter((h) => h.number === 6 || h.number === 8);
      expect(
        red.some((a, i) =>
          red
            .slice(i + 1)
            .some(
              (b) =>
                Math.max(
                  Math.abs(a.q - b.q),
                  Math.abs(a.r - b.r),
                  Math.abs(a.q + a.r - b.q - b.r),
                ) === 1,
            ),
        ),
      ).toBe(false);
    }
  });
  it("forces distance between opening settlements and reaches the first roll", () => {
    let g = started();
    const first = g.players[g.turn].id;
    g = applyAction(g, first, { type: "settlement", vertex: 0 });
    const adjacent = g.vertices[0].neighbors[0];
    expect(() =>
      applyAction(g, first, { type: "settlement", vertex: adjacent }),
    ).toThrow();
    g = finishSetup(g);
    expect(g.phase).toBe("roll");
    expect(
      g.players.every(
        (p) => p.settlements.length === 2 && p.roads.length === 2,
      ),
    ).toBe(true);
  });
  it("keeps hands and victory cards secret from other seats", () => {
    const g = started();
    g.players[0].resources.wood = 3;
    g.players[0].dev = ["victory"];
    g.players[0].points = 1;
    g.players[0].hiddenPoints = 1;
    const publicState = publicGame(g, "p1");
    expect(publicState.players[0].cardCount).toBe(3);
    expect(publicState.players[0].resources.wood).toBe(0);
    expect(publicState.players[0].dev).toEqual([]);
    expect(publicState.players[0].points).toBe(0);
    expect(publicState.players[1].resources).toEqual(
      Object.fromEntries(RESOURCES.map((r) => [r, 0])),
    );
  });
  it("gives the paired player an action phase in larger games", () => {
    let g = finishSetup(started(5));
    expect(g.phase).toBe("roll");
    g.phase = "main";
    const first = g.turn;
    g = applyAction(g, `p${first}`, { type: "end" });
    expect(g.paired).toBe(true);
    expect(g.turn).toBe((first + 2) % 5);
    expect(g.phase).toBe("main");
    expect(() =>
      applyAction(g, `p${(first + 2) % 5}`, {
        type: "offer",
        give: { wood: 1, brick: 0, wool: 0, grain: 0, ore: 0 },
        want: { wood: 0, brick: 1, wool: 0, grain: 0, ore: 0 },
      }),
    ).toThrow("Player trades");
    g = applyAction(g, `p${(first + 2) % 5}`, { type: "end" });
    expect(g.paired).toBe(false);
    expect(g.turn).toBe((first + 1) % 5);
    expect(g.phase).toBe("roll");
  });
  it("can complete opening placement with eight players", () => {
    const g = finishSetup(started(8));
    expect(
      g.players.every(
        (p) => p.settlements.length === 2 && p.roads.length === 2,
      ),
    ).toBe(true);
    expect(g.phase).toBe("roll");
  });
  it("rejects out of turn actions", () => {
    const g = started();
    const other = (g.turn + 1) % 3;
    expect(() =>
      applyAction(g, `p${other}`, { type: "settlement", vertex: 0 }),
    ).toThrow("Wait for your turn");
  });
});
