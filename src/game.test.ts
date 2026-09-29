import { describe, it, expect } from "vitest";
import {
  applyAction,
  beginGame,
  createGame,
  makePlayer,
  expireTurn,
  publicGame,
  RESOURCES,
  TURN_MS,
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
  it("passes directly to the next clockwise player in larger games", () => {
    let g = finishSetup(started(5));
    expect(g.phase).toBe("roll");
    g.phase = "main";
    const first = g.turn;
    const seq = g.clockSeq;
    g = applyAction(g, `p${first}`, { type: "end" }, 1000);
    expect(g.turn).toBe((first + 1) % 5);
    expect(g.phase).toBe("roll");
    expect(g.clockSeq).toBe(seq + 1);
    expect(g.deadlineAt).toBe(1000 + TURN_MS);
  });
  it("lets another player accept an offer during the active turn", () => {
    let g = finishSetup(started(3));
    g.phase = "main";
    const active = g.players[g.turn];
    const recipient = g.players[(g.turn + 1) % 3];
    const stranger = g.players[(g.turn + 2) % 3];
    active.resources.wood = 1;
    active.resources.brick = 0;
    recipient.resources.brick = 1;
    recipient.resources.wood = 0;
    g = applyAction(g, active.id, {
      type: "offer",
      give: { wood: 1, brick: 0, wool: 0, grain: 0, ore: 0 },
      want: { wood: 0, brick: 1, wool: 0, grain: 0, ore: 0 },
      to: recipient.id,
    });
    expect(() =>
      applyAction(g, stranger.id, { type: "accept", offerId: g.offers[0].id }),
    ).toThrow("Offer unavailable");
    g = applyAction(g, recipient.id, {
      type: "accept",
      offerId: g.offers[0].id,
    });
    expect(g.players.find((p) => p.id === active.id)?.resources.wood).toBe(0);
    expect(g.players.find((p) => p.id === active.id)?.resources.brick).toBe(1);
    expect(g.players.find((p) => p.id === recipient.id)?.resources.wood).toBe(
      1,
    );
    expect(g.offers).toHaveLength(0);
    expect(g.players[g.turn].id).toBe(active.id);
  });
  it("automatically completes a timed-out opening placement", () => {
    let g = started(3);
    const first = g.turn;
    const seq = g.clockSeq;
    g = expireTurn(g, g.deadlineAt);
    expect(g.players[first].settlements).toHaveLength(1);
    expect(g.players[first].roads).toHaveLength(1);
    expect(g.clockSeq).toBe(seq + 1);
    expect(g.phase).toBe("setup-settlement");
  });
  it("grants resources at the first opening settlement", () => {
    let g = started();
    const id = g.players[g.turn].id;
    const vertex = g.vertices.findIndex((v) =>
      v.hexes.some((hi) => g.hexes[hi].terrain !== "desert"),
    );
    g = applyAction(g, id, { type: "settlement", vertex });
    expect(
      RESOURCES.reduce((sum, r) => sum + g.players[g.turn].resources[r], 0),
    ).toBeGreaterThan(0);
  });
  it("automatically rolls and passes a timed-out normal turn", () => {
    let g = finishSetup(started(3));
    const first = g.turn;
    const seq = g.clockSeq;
    g = expireTurn(g, g.deadlineAt);
    expect(g.roll).toBeUndefined();
    expect(g.turn).toBe((first + 1) % 3);
    expect(g.phase).toBe("roll");
    expect(g.clockSeq).toBe(seq + 1);
  });
  it("finishes at eight points", () => {
    let g = finishSetup(started());
    g.phase = "main";
    g.players[g.turn].dev = Array(6).fill("victory");
    g = applyAction(g, g.players[g.turn].id, {
      type: "cancelOffer",
      offerId: "none",
    });
    expect(g.players[g.turn].points).toBe(8);
    expect(g.status).toBe("finished");
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
  it("can time out every opening placement at an eight-player table", () => {
    let g = started(8);
    for (let i = 0; i < 16; i++) g = expireTurn(g, g.deadlineAt);
    expect(g.phase).toBe("roll");
    expect(
      g.players.every(
        (p) => p.settlements.length === 2 && p.roads.length === 2,
      ),
    ).toBe(true);
  });
  it("lets a Knight move the robber before the dice roll", () => {
    let g = finishSetup(started());
    const id = g.players[g.turn].id;
    g.players[g.turn].dev.push("knight");
    g = applyAction(g, id, { type: "playDev", card: "knight" });
    expect(g.phase).toBe("robber");
    const hex = g.hexes.findIndex(
      (_, i) =>
        i !== g.robber &&
        !g.hexes[i].vertices.some((v) =>
          g.players.some(
            (p) =>
              p.id !== id &&
              (p.settlements.includes(v) || p.cities.includes(v)),
          ),
        ),
    );
    g = applyAction(g, id, { type: "robber", hex });
    expect(g.phase).toBe("roll");
  });
  it("lets other action cards play before rolling", () => {
    let g = finishSetup(started());
    const id = g.players[g.turn].id;
    const other = g.players[(g.turn + 1) % 3];
    other.resources.wood = 2;
    g.players[g.turn].dev.push("monopoly");
    g = applyAction(g, id, {
      type: "playDev",
      card: "monopoly",
      resource: "wood",
    });
    expect(g.phase).toBe("roll");
    expect(g.players[g.turn].resources.wood).toBeGreaterThanOrEqual(2);
    expect(g.players[(g.turn + 1) % 3].resources.wood).toBe(0);
  });
  it("rejects out of turn actions", () => {
    const g = started();
    const other = (g.turn + 1) % 3;
    expect(() =>
      applyAction(g, `p${other}`, { type: "settlement", vertex: 0 }),
    ).toThrow("Wait for your turn");
  });
});
