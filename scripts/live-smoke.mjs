import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { emptyBag, legalTargets, RESOURCES } from "../src/game.ts";
import { randomBytes, randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";

const url = process.env.CATAN_TEST_URL;
const seats = Number(process.env.CATAN_TEST_SEATS || 8);
const rounds = Number(process.env.CATAN_TEST_ROUNDS || 1);
if (!url) throw Error("Set CATAN_TEST_URL to the Convex API URL.");
if (!Number.isInteger(seats) || seats < 3 || seats > 8)
  throw Error("CATAN_TEST_SEATS must be 3 to 8.");
if (!Number.isInteger(rounds) || rounds < 1)
  throw Error("CATAN_TEST_ROUNDS must be positive.");

const client = new ConvexHttpClient(url);
const tokens = Array.from({ length: seats }, () => randomBytes(32).toString("hex"));
let code;
let logPath;
const record = (entry) => {
  const line = JSON.stringify({ at: new Date().toISOString(), code, ...entry });
  console.log(line);
  if (logPath) appendFileSync(logPath, `${line}\n`);
};
const get = (seat = 0) =>
  client.query(api.games.get, { code, token: tokens[seat] });

try {
  code = await client.mutation(api.games.create, {
    name: "Smoke 0",
    token: tokens[0],
    maxPlayers: seats,
  });
  logPath = process.env.CATAN_TEST_LOG || `/tmp/catan-live-smoke-${code}.jsonl`;
  record({ event: "created", seats, rounds });
  for (let seat = 1; seat < seats; seat++) {
    await client.mutation(api.games.join, {
      code,
      token: tokens[seat],
      name: `Smoke ${seat}`,
    });
  }
  await client.mutation(api.games.start, { code, token: tokens[0] });

  let duplicateChecked = false;
  let actions = 0;
  const limit = seats * (4 + 12 * rounds);
  while (actions < limit) {
    const { game } = await get();
    if (game.status === "finished" || game.turnNumber >= 1 + rounds * seats)
      break;
    let seat = game.turn;
    let action;
    if (game.phase === "setup-settlement") {
      action = {
        type: "settlement",
        vertex: legalTargets(game, game.players[seat].id, "settlement")[0],
      };
    } else if (game.phase === "setup-road") {
      action = {
        type: "road",
        edge: legalTargets(game, game.players[seat].id, "road")[0],
      };
    } else if (game.phase === "roll") action = { type: "roll" };
    else if (game.phase === "discard") {
      seat = game.players.findIndex((p) => game.discardIds.includes(p.id));
      const privateGame = (await get(seat)).game;
      const resources = privateGame.players[seat].resources;
      let remaining = Math.floor(
        RESOURCES.reduce((n, r) => n + resources[r], 0) / 2,
      );
      const bag = emptyBag();
      for (const resource of RESOURCES) {
        bag[resource] = Math.min(resources[resource], remaining);
        remaining -= bag[resource];
      }
      action = { type: "discard", bag };
    } else if (game.phase === "robber") {
      action = {
        type: "robber",
        hex: game.hexes.findIndex((_, i) => i !== game.robber),
      };
    } else if (game.phase === "steal") {
      action = { type: "steal", victim: game.robberVictims[0] };
    } else if (game.phase === "main") action = { type: "end" };
    else throw Error(`Unexpected phase: ${game.phase}`);

    const actionId = randomUUID();
    const args = {
      code,
      token: tokens[seat],
      action,
      actionId,
      expectedClockSeq: game.clockSeq,
    };
    const before = {
      phase: game.phase,
      turnNumber: game.turnNumber,
      setupStep: game.setupStep,
      seat,
    };
    try {
      const result = await client.mutation(api.games.act, args);
      if (result.status !== "applied")
        throw Error(`Action returned ${result.status}`);
      actions++;
      record({ event: "action", before, action, result: result.status });
      if (!duplicateChecked) {
        const duplicate = await client.mutation(api.games.act, args);
        const after = (await get()).game;
        if (
          duplicate.status !== "applied" ||
          after.players[seat].settlements.length !== 1
        )
          throw Error("Duplicate action changed the board.");
        duplicateChecked = true;
        record({ event: "idempotency", result: "passed" });
        const stale = await client.mutation(api.games.act, {
          ...args,
          actionId: randomUUID(),
          expectedClockSeq: game.clockSeq - 1,
        });
        if (stale.status !== "stale")
          throw Error("Stale action was not rejected.");
        record({ event: "stale-action", result: "passed" });
      }
    } catch (error) {
      record({ event: "error", before, action, error: String(error) });
      throw error;
    }
  }
  const { game } = await get();
  if (
    game.players.some((p) => p.settlements.length !== 2 || p.roads.length !== 2)
  )
    throw Error("Opening placement did not complete for every seat.");
  if (game.turnNumber < 1 + rounds * seats)
    throw Error(`Stopped at turn ${game.turnNumber} before ${rounds} rounds.`);
  record({ event: "passed", actions, turnNumber: game.turnNumber });
} catch (error) {
  record({ event: "failed", error: String(error) });
  process.exitCode = 1;
}
