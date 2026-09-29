export type Resource = "wood" | "brick" | "wool" | "grain" | "ore";
export type Terrain = Resource | "desert";
export type DevCard =
  "knight" | "victory" | "roadBuilding" | "yearOfPlenty" | "monopoly";
export type ResourceBag = Record<Resource, number>;
export type Player = {
  id: string;
  name: string;
  color: string;
  resources: ResourceBag;
  dev: DevCard[];
  newDev: DevCard[];
  roads: number[];
  settlements: number[];
  cities: number[];
  knights: number;
  playedDev: boolean;
  points: number;
  hiddenPoints: number;
  connected: boolean;
  cardCount?: number;
  devCount?: number;
};
export type Hex = {
  q: number;
  r: number;
  terrain: Terrain;
  number: number | null;
  vertices: number[];
};
export type Vertex = {
  x: number;
  y: number;
  hexes: number[];
  neighbors: number[];
  edges: number[];
  port?: Resource | "any";
};
export type Edge = { a: number; b: number; owner?: string };
export type Offer = {
  id: string;
  from: string;
  to?: string;
  give: ResourceBag;
  want: ResourceBag;
};
export type Game = {
  code: string;
  host: string;
  status: "lobby" | "playing" | "finished";
  maxPlayers: number;
  players: Player[];
  hexes: Hex[];
  vertices: Vertex[];
  edges: Edge[];
  robber: number;
  turn: number;
  phase:
    | "setup-settlement"
    | "setup-road"
    | "roll"
    | "discard"
    | "robber"
    | "steal"
    | "main"
    | "finished";
  robberResume?: "roll" | "main";
  deadlineAt: number;
  clockSeq: number;
  setupOrder: number[];
  setupStep: number;
  lastSettlement?: number;
  roll?: [number, number];
  discardIds: string[];
  robberVictims: string[];
  offers: Offer[];
  bank: ResourceBag;
  devDeck: DevCard[];
  playedCards: DevCard[];
  largestArmy?: string;
  longestRoad?: string;
  log: string[];
  winner?: string;
  turnNumber: number;
  houseRules: boolean;
};
export const RESOURCES: Resource[] = ["wood", "brick", "wool", "grain", "ore"];
export const TURN_MS = 60_000;
export const WIN_POINTS = 8;
export const COLORS = [
  "#df7857",
  "#6d9e9a",
  "#d9ae5b",
  "#858bb1",
  "#c8798d",
  "#8d9e65",
  "#ad8562",
  "#9d80a6",
];
export const emptyBag = (): ResourceBag => ({
  wood: 0,
  brick: 0,
  wool: 0,
  grain: 0,
  ore: 0,
});
export const COSTS: Record<string, ResourceBag> = {
  road: { wood: 1, brick: 1, wool: 0, grain: 0, ore: 0 },
  settlement: { wood: 1, brick: 1, wool: 1, grain: 1, ore: 0 },
  city: { wood: 0, brick: 0, wool: 0, grain: 2, ore: 3 },
  development: { wood: 0, brick: 0, wool: 1, grain: 1, ore: 1 },
};
const terrainSmall: Terrain[] = [
  "wood",
  "wood",
  "wood",
  "wood",
  "brick",
  "brick",
  "brick",
  "wool",
  "wool",
  "wool",
  "wool",
  "grain",
  "grain",
  "grain",
  "grain",
  "ore",
  "ore",
  "ore",
  "desert",
];
const terrainLarge: Terrain[] = [
  ...terrainSmall,
  "wood",
  "wood",
  "brick",
  "brick",
  "wool",
  "wool",
  "grain",
  "grain",
  "ore",
  "ore",
  "desert",
];
const numbersSmall = [
  2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12,
];
const numbersLarge = [...numbersSmall, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const shuffle = <T>(a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export function buildBoard(large: boolean) {
  const coords: { q: number; r: number }[] = [];
  if (!large) {
    for (let r = -2; r <= 2; r++)
      for (let q = -2; q <= 2; q++)
        if (Math.abs(q + r) <= 2) coords.push({ q, r });
  } else {
    for (let r = -3; r <= 3; r++) {
      let row = [] as number[];
      for (let q = -3; q <= 3; q++)
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 3)
          row.push(q);
      row = r % 2 === 0 ? row.slice(1) : row.slice(0, -1);
      for (const q of row) coords.push({ q, r });
    }
  }
  const terrains = shuffle([...(large ? terrainLarge : terrainSmall)]);
  const vertices: Vertex[] = [],
    edges: Edge[] = [],
    vmap = new Map<string, number>(),
    emap = new Map<string, number>();
  const hexes: Hex[] = coords.map(({ q, r }, hi) => {
    const terrain = terrains[hi] || "desert";
    const cx = Math.sqrt(3) * (q + r / 2),
      cy = 1.5 * r;
    const vs: number[] = [];
    for (let k = 0; k < 6; k++) {
      const angle = ((-90 + 60 * k) * Math.PI) / 180,
        x = cx + Math.cos(angle),
        y = cy + Math.sin(angle);
      const key = `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
      let id = vmap.get(key);
      if (id === undefined) {
        id = vertices.length;
        vmap.set(key, id);
        vertices.push({ x, y, hexes: [], neighbors: [], edges: [] });
      }
      vertices[id].hexes.push(hi);
      vs.push(id);
    }
    for (let k = 0; k < 6; k++) {
      const a = vs[k],
        b = vs[(k + 1) % 6],
        key = [a, b].sort((x, y) => x - y).join("-");
      if (!emap.has(key)) {
        const id = edges.length;
        emap.set(key, id);
        edges.push({ a, b });
        vertices[a].edges.push(id);
        vertices[b].edges.push(id);
        vertices[a].neighbors.push(b);
        vertices[b].neighbors.push(a);
      }
    }
    return { q, r, terrain, number: null, vertices: vs };
  });
  for (let attempt = 0; attempt < 1000; attempt++) {
    const numbers = shuffle([...(large ? numbersLarge : numbersSmall)]);
    let cursor = 0;
    for (const h of hexes)
      h.number = h.terrain === "desert" ? null : numbers[cursor++];
    const red = hexes.filter((h) => h.number === 6 || h.number === 8);
    const adjacent = red.some((a, i) =>
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
    );
    if (!adjacent) break;
  }
  const coast = edges
    .map((edge, i) => ({
      edge,
      i,
      shared: vertices[edge.a].hexes.filter((h) =>
        vertices[edge.b].hexes.includes(h),
      ).length,
    }))
    .filter((item) => item.shared === 1)
    .sort((a, b) => {
      const am = vertices[a.edge.a],
        an = vertices[a.edge.b],
        bm = vertices[b.edge.a],
        bn = vertices[b.edge.b];
      return (
        Math.atan2((am.y + an.y) / 2, (am.x + an.x) / 2) -
        Math.atan2((bm.y + bn.y) / 2, (bm.x + bn.x) / 2)
      );
    });
  const ports: (Resource | "any")[] = [
    "any",
    "wood",
    "any",
    "brick",
    "any",
    "wool",
    "grain",
    "any",
    "ore",
  ];
  const count = large ? 12 : 9;
  for (let k = 0; k < count; k++) {
    const item =
      coast[Math.floor(((k + 0.5) * coast.length) / count) % coast.length];
    if (item) {
      const type = ports[k % ports.length];
      vertices[item.edge.a].port = type;
      vertices[item.edge.b].port = type;
    }
  }
  return {
    hexes,
    vertices,
    edges,
    robber: hexes.findIndex((h) => h.terrain === "desert"),
  };
}
export function createGame(
  code: string,
  hostId: string,
  hostName: string,
  maxPlayers: number,
): Game {
  const large = maxPlayers > 4;
  const board = buildBoard(large);
  return {
    code,
    host: hostId,
    status: "lobby",
    maxPlayers,
    players: [makePlayer(hostId, hostName, 0)],
    ...board,
    turn: 0,
    phase: "setup-settlement",
    deadlineAt: 0,
    clockSeq: 0,
    setupOrder: [],
    setupStep: 0,
    discardIds: [],
    robberVictims: [],
    offers: [],
    bank: Object.fromEntries(
      RESOURCES.map((r) => [r, large ? 24 : 19]),
    ) as ResourceBag,
    devDeck: shuffle([
      ...Array(large ? 20 : 14).fill("knight"),
      ...Array(5).fill("victory"),
      ...Array(large ? 3 : 2).fill("roadBuilding"),
      ...Array(large ? 3 : 2).fill("yearOfPlenty"),
      ...Array(large ? 3 : 2).fill("monopoly"),
    ] as DevCard[]),
    playedCards: [],
    log: [`${hostName} opened the table.`],
    turnNumber: 0,
    houseRules: maxPlayers > 6,
  };
}
export function makePlayer(id: string, name: string, index: number): Player {
  return {
    id,
    name: name.trim().slice(0, 24) || "Guest",
    color: COLORS[index],
    resources: emptyBag(),
    dev: [],
    newDev: [],
    roads: [],
    settlements: [],
    cities: [],
    knights: 0,
    playedDev: false,
    points: 0,
    hiddenPoints: 0,
    connected: true,
  };
}
export function publicGame(game: Game, viewer: string): Game {
  const g = structuredClone(game);
  g.devDeck = [];
  g.players = g.players.map((p) =>
    p.id === viewer
      ? p
      : {
          ...p,
          cardCount: total(p.resources),
          devCount: p.dev.length + p.newDev.length,
          resources: emptyBag(),
          dev: [],
          newDev: [],
          points: p.points - p.hiddenPoints,
          hiddenPoints: 0,
        },
  );
  return g;
}
const fail = (message: string): never => {
  throw new Error(message);
};
const current = (g: Game) => g.players[g.turn];
const player = (g: Game, id: string) =>
  g.players.find((p) => p.id === id) || fail("You are not in this game.");
const requireTurn = (g: Game, id: string) => {
  if (current(g)?.id !== id) fail("Wait for your turn.");
};
const note = (g: Game, s: string) => {
  g.log.unshift(s);
  g.log = g.log.slice(0, 80);
};
const have = (p: Player, bag: ResourceBag) =>
  RESOURCES.every((r) => p.resources[r] >= bag[r]);
const transfer = (from: ResourceBag, to: ResourceBag, bag: ResourceBag) => {
  if (!RESOURCES.every((r) => from[r] >= bag[r])) fail("Not enough resources.");
  for (const r of RESOURCES) {
    from[r] -= bag[r];
    to[r] += bag[r];
  }
};
const total = (bag: ResourceBag) => RESOURCES.reduce((n, r) => n + bag[r], 0);
const charge = (g: Game, p: Player, what: keyof typeof COSTS) =>
  transfer(p.resources, g.bank, COSTS[what]);
const ownerAt = (g: Game, v: number) =>
  g.players.find((p) => p.settlements.includes(v) || p.cities.includes(v));
const roadOwner = (g: Game, e: number) => g.edges[e]?.owner;
const roadConnected = (g: Game, id: string, e: number) => {
  const edge = g.edges[e];
  if (!edge) return false;
  return [edge.a, edge.b].some((v) => {
    const owner = ownerAt(g, v);
    return (
      owner?.id === id ||
      (!owner &&
        g.vertices[v].edges.some(
          (other) => other !== e && roadOwner(g, other) === id,
        ))
    );
  });
};
const settlementLegal = (g: Game, id: string, v: number, setup = false) => {
  const vertex = g.vertices[v];
  if (!vertex || ownerAt(g, v) || vertex.neighbors.some((n) => ownerAt(g, n)))
    return false;
  return setup || vertex.edges.some((e) => roadOwner(g, e) === id);
};
const roadLegal = (g: Game, id: string, e: number, setup = false) => {
  const edge = g.edges[e];
  if (!edge || edge.owner) return false;
  return setup
    ? [edge.a, edge.b].includes(g.lastSettlement ?? -1)
    : roadConnected(g, id, e);
};
export function legalTargets(
  g: Game,
  id: string,
  kind: "road" | "settlement" | "city",
) {
  return kind === "road"
    ? g.edges.flatMap((_, i) =>
        roadLegal(g, id, i, g.phase === "setup-road" && current(g)?.id === id)
          ? [i]
          : [],
      )
    : g.vertices.flatMap((_, i) =>
        kind === "city"
          ? player(g, id).settlements.includes(i)
            ? [i]
            : []
          : settlementLegal(
                g,
                id,
                i,
                g.phase === "setup-settlement" && current(g)?.id === id,
              )
            ? [i]
            : [],
      );
}
function checkAwards(g: Game) {
  const army = [...g.players].sort((a, b) => b.knights - a.knights)[0];
  if (
    army &&
    army.knights >= 3 &&
    (!g.largestArmy || army.knights > player(g, g.largestArmy).knights)
  )
    g.largestArmy = army.id;
  const lengths = g.players
    .map((p) => ({ id: p.id, length: longestRoad(g, p.id) }))
    .sort((a, b) => b.length - a.length);
  const best = lengths[0];
  if (g.longestRoad && longestRoad(g, g.longestRoad) < 5)
    g.longestRoad = undefined;
  if (
    best &&
    best.length >= 5 &&
    (!g.longestRoad || best.length > longestRoad(g, g.longestRoad))
  )
    g.longestRoad = best.id;
  for (const p of g.players) {
    p.points =
      p.settlements.length +
      2 * p.cities.length +
      (g.largestArmy === p.id ? 2 : 0) +
      (g.longestRoad === p.id ? 2 : 0);
    p.hiddenPoints = [...p.dev, ...p.newDev].filter(
      (c) => c === "victory",
    ).length;
    p.points += p.hiddenPoints;
  }
  if (g.status === "playing" && current(g)?.points >= WIN_POINTS) {
    g.winner = current(g).id;
    g.status = "finished";
    g.phase = "finished";
    note(g, `${current(g).name} wins with ${current(g).points} points!`);
  }
}
export function longestRoad(g: Game, id: string) {
  const owned = g.edges
    .map((e, i) => (e.owner === id ? i : -1))
    .filter((i) => i >= 0);
  let best = 0;
  const walk = (v: number, used: Set<number>, length: number) => {
    best = Math.max(best, length);
    if (length > 0 && ownerAt(g, v) && ownerAt(g, v)?.id !== id) return;
    for (const e of g.vertices[v].edges) {
      if (!owned.includes(e) || used.has(e)) continue;
      used.add(e);
      const edge = g.edges[e];
      walk(edge.a === v ? edge.b : edge.a, used, length + 1);
      used.delete(e);
    }
  };
  for (const e of owned) {
    const edge = g.edges[e];
    walk(edge.a, new Set(), 0);
    walk(edge.b, new Set(), 0);
  }
  return best;
}
function nextSetup(g: Game, now: number) {
  g.setupStep++;
  if (g.setupStep >= g.setupOrder.length) {
    g.phase = "roll";
    g.turn = g.setupOrder[0];
    g.turnNumber = 1;
    note(g, `${current(g).name}'s turn begins.`);
  } else {
    g.turn = g.setupOrder[g.setupStep];
    g.phase = "setup-settlement";
  }
  g.clockSeq++;
  g.deadlineAt = now + TURN_MS;
}
function give(g: Game, p: Player, r: Resource, n = 1) {
  const amount = Math.min(g.bank[r], n);
  g.bank[r] -= amount;
  p.resources[r] += amount;
}
function distribute(g: Game, n: number) {
  for (const [hi, h] of g.hexes.entries()) {
    if (h.number !== n || g.robber === hi || h.terrain === "desert") continue;
    const claims = g.players
      .map((p) => ({
        p,
        n: h.vertices.reduce(
          (sum, v) =>
            sum +
            (p.cities.includes(v) ? 2 : p.settlements.includes(v) ? 1 : 0),
          0,
        ),
      }))
      .filter((x) => x.n);
    const needed = claims.reduce((a, x) => a + x.n, 0);
    if (g.bank[h.terrain] < needed) continue;
    for (const c of claims) give(g, c.p, h.terrain, c.n);
  }
}
function randomResource(p: Player): Resource | undefined {
  const cards = RESOURCES.flatMap(
    (r) => Array(p.resources[r]).fill(r) as Resource[],
  );
  return cards[Math.floor(Math.random() * cards.length)];
}
function moveRobber(g: Game, id: string, hex: number) {
  if (
    g.phase !== "robber" ||
    !Number.isInteger(hex) ||
    !g.hexes[hex] ||
    hex === g.robber
  )
    fail("Choose a different hex.");
  g.robber = hex;
  g.robberVictims = g.players
    .filter(
      (p) =>
        p.id !== id &&
        total(p.resources) > 0 &&
        g.hexes[hex].vertices.some(
          (v) => p.settlements.includes(v) || p.cities.includes(v),
        ),
    )
    .map((p) => p.id);
  g.phase = g.robberVictims.length ? "steal" : g.robberResume || "main";
  note(g, `${player(g, id).name} moved the robber.`);
}
export type Action = { type: string; [key: string]: unknown };
export function applyAction(
  original: Game,
  id: string,
  a: Action,
  now = Date.now(),
): Game {
  const g = structuredClone(original),
    p = player(g, id),
    type = a.type;
  if (g.status !== "playing") fail("The game is not in progress.");
  if (type === "discard") {
    if (g.phase !== "discard" || !g.discardIds.includes(id))
      fail("You do not need to discard.");
    const amount = Math.floor(total(p.resources) / 2),
      bag = a.bag as ResourceBag;
    if (
      !bag ||
      RESOURCES.some((r) => !Number.isInteger(bag[r]) || bag[r] < 0) ||
      total(bag) !== amount
    )
      fail(`Discard exactly ${amount} cards.`);
    transfer(p.resources, g.bank, bag);
    g.discardIds = g.discardIds.filter((x) => x !== id);
    note(g, `${p.name} discarded ${amount} cards.`);
    if (!g.discardIds.length) g.phase = "robber";
    return g;
  }
  if (type === "accept") {
    if (g.phase !== "main") fail("Trade during the active turn.");
    const offer = g.offers.find((x) => x.id === a.offerId);
    if (!offer) throw new Error("Offer unavailable.");
    if (
      offer.from !== current(g).id ||
      offer.from === id ||
      (offer.to && offer.to !== id)
    )
      fail("Offer unavailable.");
    const seller = player(g, offer.from);
    if (!have(seller, offer.give) || !have(p, offer.want))
      fail("Someone lacks those resources.");
    transfer(seller.resources, p.resources, offer.give);
    transfer(p.resources, seller.resources, offer.want);
    g.offers = [];
    note(g, `${p.name} traded with ${seller.name}.`);
    return g;
  }
  requireTurn(g, id);
  if (type === "settlement") {
    const v = Number(a.vertex);
    if (
      !["setup-settlement", "main"].includes(g.phase) ||
      !settlementLegal(g, id, v, g.phase === "setup-settlement")
    )
      fail("That settlement site is unavailable.");
    if (p.settlements.length >= 5) fail("No settlements left.");
    if (g.phase === "main") charge(g, p, "settlement");
    p.settlements.push(v);
    note(g, `${p.name} built a settlement.`);
    if (g.phase === "setup-settlement") {
      for (const hi of g.vertices[v].hexes) {
        const t = g.hexes[hi].terrain;
        if (t !== "desert") give(g, p, t);
      }
      g.lastSettlement = v;
      g.phase = "setup-road";
    }
  } else if (type === "road") {
    const e = Number(a.edge);
    if (
      !["setup-road", "main"].includes(g.phase) ||
      !roadLegal(g, id, e, g.phase === "setup-road")
    )
      fail("That road site is unavailable.");
    if (p.roads.length >= 15) fail("No roads left.");
    if (g.phase === "main") charge(g, p, "road");
    g.edges[e].owner = id;
    p.roads.push(e);
    note(g, `${p.name} built a road.`);
    if (g.phase === "setup-road") nextSetup(g, now);
  } else if (type === "city") {
    const v = Number(a.vertex);
    if (g.phase !== "main" || !p.settlements.includes(v))
      fail("Upgrade one of your settlements.");
    if (p.cities.length >= 4) fail("No cities left.");
    charge(g, p, "city");
    p.settlements = p.settlements.filter((x) => x !== v);
    p.cities.push(v);
    note(g, `${p.name} built a city.`);
  } else if (type === "roll") {
    if (g.phase !== "roll") fail("You cannot roll now.");
    const d1 = 1 + Math.floor(Math.random() * 6),
      d2 = 1 + Math.floor(Math.random() * 6);
    g.roll = [d1, d2];
    note(g, `${p.name} rolled ${d1 + d2}.`);
    if (d1 + d2 === 7) {
      g.discardIds = g.players
        .filter((x) => total(x.resources) > 7)
        .map((x) => x.id);
      g.robberResume = "main";
      g.phase = g.discardIds.length ? "discard" : "robber";
    } else {
      distribute(g, d1 + d2);
      g.phase = "main";
    }
  } else if (type === "robber") {
    moveRobber(g, id, Number(a.hex));
  } else if (type === "steal") {
    if (g.phase !== "steal" || !g.robberVictims.includes(String(a.victim)))
      fail("Choose an adjacent player.");
    const victim = player(g, String(a.victim)),
      r = randomResource(victim);
    if (r) {
      victim.resources[r]--;
      p.resources[r]++;
    }
    g.phase = g.robberResume || "main";
    g.robberVictims = [];
    note(g, `${p.name} stole a card from ${victim.name}.`);
  } else if (type === "end") {
    if (g.phase !== "main") fail("Finish the roll and robber first.");
    p.dev.push(...p.newDev);
    p.newDev = [];
    p.playedDev = false;
    g.offers = [];
    g.turn = (g.turn + 1) % g.players.length;
    g.turnNumber++;
    g.roll = undefined;
    g.phase = "roll";
    g.clockSeq++;
    g.deadlineAt = now + TURN_MS;
    note(g, `${current(g).name}'s turn begins.`);
  } else if (type === "buyDev") {
    if (g.phase !== "main" || !g.devDeck.length)
      fail("No development cards available.");
    charge(g, p, "development");
    const card = g.devDeck.pop()!;
    p.newDev.push(card);
    note(g, `${p.name} bought a development card.`);
  } else if (type === "playDev") {
    const card = String(a.card) as DevCard;
    if (
      !["main", "roll"].includes(g.phase) ||
      p.playedDev ||
      card === "victory" ||
      !p.dev.includes(card)
    )
      fail("You cannot play that card now.");
    p.dev.splice(p.dev.indexOf(card), 1);
    p.playedDev = true;
    g.playedCards.push(card);
    if (card === "knight") {
      p.knights++;
      g.robberResume = g.phase as "roll" | "main";
      g.phase = "robber";
      note(g, `${p.name} played a knight.`);
    } else if (card === "yearOfPlenty") {
      const r1 = String(a.r1) as Resource,
        r2 = String(a.r2) as Resource;
      if (
        !RESOURCES.includes(r1) ||
        !RESOURCES.includes(r2) ||
        g.bank[r1] < 1 ||
        g.bank[r2] < (r1 === r2 ? 2 : 1)
      )
        fail("Choose available resources.");
      give(g, p, r1);
      give(g, p, r2);
      note(g, `${p.name} played Year of Plenty.`);
    } else if (card === "monopoly") {
      const r = String(a.resource) as Resource;
      if (!RESOURCES.includes(r)) fail("Choose a resource.");
      let n = 0;
      for (const other of g.players) {
        if (other.id === id) continue;
        n += other.resources[r];
        p.resources[r] += other.resources[r];
        other.resources[r] = 0;
      }
      note(g, `${p.name} took ${n} ${r} with Monopoly.`);
    } else if (card === "roadBuilding") {
      const e1 = Number(a.edge1),
        e2 = Number(a.edge2);
      if (!roadLegal(g, id, e1) || p.roads.length >= 15)
        fail("Choose a legal first road.");
      g.edges[e1].owner = id;
      p.roads.push(e1);
      if (Number.isInteger(e2) && roadLegal(g, id, e2) && p.roads.length < 15) {
        g.edges[e2].owner = id;
        p.roads.push(e2);
      }
      note(g, `${p.name} played Road Building.`);
    }
  } else if (type === "bankTrade") {
    if (g.phase !== "main") fail("Trade during your turn.");
    const from = String(a.from) as Resource,
      to = String(a.to) as Resource;
    if (!RESOURCES.includes(from) || !RESOURCES.includes(to) || from === to)
      fail("Choose two resources.");
    const ports = [...p.settlements, ...p.cities].flatMap((v) =>
      g.vertices[v].port ? [g.vertices[v].port] : [],
    );
    const rate = ports.includes(from) ? 2 : ports.includes("any") ? 3 : 4;
    if (p.resources[from] < rate || g.bank[to] < 1) fail("Trade unavailable.");
    p.resources[from] -= rate;
    g.bank[from] += rate;
    g.bank[to]--;
    p.resources[to]++;
    note(g, `${p.name} traded ${rate} ${from} for 1 ${to}.`);
  } else if (type === "offer") {
    if (g.phase !== "main") fail("Trade during your turn.");
    const giveBag = a.give as ResourceBag,
      wantBag = a.want as ResourceBag;
    if (
      !giveBag ||
      !wantBag ||
      RESOURCES.some(
        (r) =>
          !Number.isInteger(giveBag[r]) ||
          giveBag[r] < 0 ||
          !Number.isInteger(wantBag[r]) ||
          wantBag[r] < 0,
      ) ||
      !total(giveBag) ||
      !total(wantBag) ||
      !have(p, giveBag)
    )
      fail("Choose resources you can offer.");
    const to = a.to ? String(a.to) : undefined;
    if (to && to === id) fail("Choose another player.");
    if (to && !g.players.some((other) => other.id === to))
      fail("Choose another player.");
    g.offers.push({
      id: crypto.randomUUID(),
      from: id,
      to,
      give: giveBag,
      want: wantBag,
    });
    note(g, `${p.name} proposed a trade.`);
  } else if (type === "cancelOffer") {
    g.offers = g.offers.filter((x) => x.id !== a.offerId || x.from !== id);
  } else fail("Unknown action.");
  checkAwards(g);
  return g;
}
export function beginGame(g: Game, id: string, now = Date.now()): Game {
  if (g.host !== id) fail("Only the host can start.");
  if (g.status !== "lobby" || g.players.length < 3)
    fail("You need at least three players.");
  const next = structuredClone(g);
  next.status = "playing";
  const first = Math.floor(Math.random() * next.players.length);
  const order = next.players.map((_, i) => (first + i) % next.players.length);
  next.setupOrder = [...order, ...order.slice().reverse()];
  next.turn = next.setupOrder[0];
  next.phase = "setup-settlement";
  next.clockSeq = (next.clockSeq || 0) + 1;
  next.deadlineAt = now + TURN_MS;
  note(next, "The opening placement begins.");
  return next;
}

export function expireTurn(original: Game, now = Date.now()): Game {
  let g = structuredClone(original);
  if (g.status !== "playing") return g;
  const seq = g.clockSeq;
  note(g, `${current(g).name} ran out of time.`);
  for (
    let step = 0;
    step < 24 && g.status === "playing" && g.clockSeq === seq;
    step++
  ) {
    const id = current(g).id;
    if (g.phase === "setup-settlement") {
      const vertex = legalTargets(g, id, "settlement")[0];
      if (vertex === undefined) break;
      g = applyAction(g, id, { type: "settlement", vertex }, now);
    } else if (g.phase === "setup-road") {
      const edge = legalTargets(g, id, "road")[0];
      if (edge === undefined) break;
      g = applyAction(g, id, { type: "road", edge }, now);
    } else if (g.phase === "roll") {
      g = applyAction(g, id, { type: "roll" }, now);
    } else if (g.phase === "discard") {
      const discardId = g.discardIds[0];
      if (!discardId) break;
      const holder = player(g, discardId);
      let remaining = Math.floor(total(holder.resources) / 2);
      const bag = emptyBag();
      for (const resource of RESOURCES) {
        bag[resource] = Math.min(holder.resources[resource], remaining);
        remaining -= bag[resource];
      }
      g = applyAction(g, discardId, { type: "discard", bag }, now);
    } else if (g.phase === "robber") {
      const choices = g.hexes.map((_, i) => i).filter((i) => i !== g.robber);
      g = applyAction(
        g,
        id,
        {
          type: "robber",
          hex: choices[Math.floor(Math.random() * choices.length)],
        },
        now,
      );
    } else if (g.phase === "steal") {
      g = applyAction(
        g,
        id,
        { type: "steal", victim: g.robberVictims[0] },
        now,
      );
    } else if (g.phase === "main") {
      g = applyAction(g, id, { type: "end" }, now);
    } else break;
  }
  return g;
}
