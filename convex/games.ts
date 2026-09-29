import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  applyAction,
  beginGame,
  createGame,
  expireTurn,
  makePlayer,
  publicGame,
  TURN_MS,
  type Game,
} from "../src/game";
const cleanName = (name: string) =>
  name.trim().slice(0, 24).replace(/[<>]/g, "") || "Guest";
const lookup = async (ctx: any, code: string) =>
  ctx.db
    .query("games")
    .withIndex("by_code", (q: any) => q.eq("code", code.toUpperCase()))
    .unique();
const seat = (doc: any, token: string) =>
  doc?.seats.find((x: any) => x.token === token)?.id;
export const get = query({
  args: { code: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const doc = await lookup(ctx, args.code);
    if (!doc) return null;
    const id = seat(doc, args.token);
    if (!id)
      return {
        needsJoin: true,
        code: doc.code,
        status: (doc.state as Game).status,
        players: (doc.state as Game).players.map((p) => p.name),
        full:
          (doc.state as Game).players.length >= (doc.state as Game).maxPlayers,
      };
    return {
      needsJoin: false,
      game: publicGame(doc.state as Game, id),
      you: id,
    };
  },
});
export const create = mutation({
  args: { name: v.string(), token: v.string(), maxPlayers: v.number() },
  handler: async (ctx, args) => {
    if (
      !Number.isInteger(args.maxPlayers) ||
      args.maxPlayers < 3 ||
      args.maxPlayers > 8
    )
      throw Error("Choose 3 to 8 seats.");
    if (args.token.length < 20) throw Error("Invalid session.");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 12; i++) {
      code = Array.from(
        { length: 6 },
        () => alphabet[Math.floor(Math.random() * alphabet.length)],
      ).join("");
      if (!(await lookup(ctx, code))) break;
    }
    if (await lookup(ctx, code)) throw Error("Could not create a unique code.");
    const id = crypto.randomUUID();
    const state = createGame(code, id, cleanName(args.name), args.maxPlayers);
    await ctx.db.insert("games", {
      code,
      state,
      seats: [{ id, token: args.token }],
    });
    return code;
  },
});
export const join = mutation({
  args: { code: v.string(), name: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const doc = await lookup(ctx, args.code);
    if (!doc) throw Error("No table found for that code.");
    if (seat(doc, args.token)) return doc.code;
    const g = structuredClone(doc.state as Game);
    if (g.status !== "lobby") throw Error("This game has already started.");
    if (g.players.length >= g.maxPlayers) throw Error("This table is full.");
    const id = crypto.randomUUID();
    g.players.push(makePlayer(id, cleanName(args.name), g.players.length));
    g.log.unshift(`${cleanName(args.name)} joined the table.`);
    await ctx.db.patch(doc._id, {
      state: g,
      seats: [...doc.seats, { id, token: args.token }],
    });
    return doc.code;
  },
});
export const start = mutation({
  args: { code: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const doc = await lookup(ctx, args.code);
    const id = seat(doc, args.token);
    if (!doc || !id) throw Error("Join this table first.");
    const next = beginGame(doc.state as Game, id);
    await ctx.db.patch(doc._id, { state: next });
    await ctx.scheduler.runAt(next.deadlineAt, internal.games.timeout, {
      gameId: doc._id,
      seq: next.clockSeq,
    });
  },
});
export const act = mutation({
  args: {
    code: v.string(),
    token: v.string(),
    action: v.any(),
    actionId: v.optional(v.string()),
    expectedClockSeq: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const doc = await lookup(ctx, args.code);
    const id = seat(doc, args.token);
    if (!doc || !id) throw Error("Join this table first.");
    if (!args.action || typeof args.action.type !== "string")
      throw Error("Invalid action.");
    if (args.actionId && args.actionId.length > 64)
      throw Error("Invalid action ID.");
    const state = doc.state as Game;
    if (args.actionId && state.processedActionIds?.includes(args.actionId))
      return { status: "applied" as const };
    if (
      args.expectedClockSeq !== undefined &&
      state.clockSeq !== args.expectedClockSeq
    )
      return { status: "stale" as const };
    const now = Date.now();
    const previous = structuredClone(state);
    const oldSeq = previous.clockSeq;
    const wasUnarmed = !previous.deadlineAt;
    if (!previous.deadlineAt) {
      previous.clockSeq = (previous.clockSeq || 0) + 1;
      previous.deadlineAt = now + TURN_MS;
    }
    const next =
      previous.deadlineAt <= now
        ? expireTurn(previous, now)
        : applyAction(previous, id, args.action, now);
    const expired = previous.deadlineAt <= now;
    if (!expired && args.actionId)
      next.processedActionIds = [
        ...(next.processedActionIds || []).slice(-31),
        args.actionId,
      ];
    await ctx.db.patch(doc._id, { state: next });
    if (next.status === "playing" && (next.clockSeq !== oldSeq || wasUnarmed)) {
      await ctx.scheduler.runAt(next.deadlineAt, internal.games.timeout, {
        gameId: doc._id,
        seq: next.clockSeq,
      });
    }
    return { status: expired ? ("expired" as const) : ("applied" as const) };
  },
});

export const timeout = internalMutation({
  args: { gameId: v.id("games"), seq: v.number() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.gameId);
    if (!doc) return;
    const game = doc.state as Game;
    if (game.status !== "playing" || game.clockSeq !== args.seq) return;
    const now = Date.now();
    if (now < game.deadlineAt) {
      await ctx.scheduler.runAt(game.deadlineAt, internal.games.timeout, args);
      return;
    }
    const next = expireTurn(game, now);
    await ctx.db.patch(doc._id, { state: next });
    if (next.status === "playing") {
      await ctx.scheduler.runAt(next.deadlineAt, internal.games.timeout, {
        gameId: doc._id,
        seq: next.clockSeq,
      });
    }
  },
});

export const armExisting = internalMutation({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("games").collect();
    let armed = 0;
    for (const doc of docs) {
      const game = doc.state as Game;
      if (game.status !== "playing" || game.deadlineAt) continue;
      game.clockSeq = (game.clockSeq || 0) + 1;
      game.deadlineAt = Date.now() + TURN_MS;
      await ctx.db.patch(doc._id, { state: game });
      await ctx.scheduler.runAt(game.deadlineAt, internal.games.timeout, {
        gameId: doc._id,
        seq: game.clockSeq,
      });
      armed++;
    }
    return armed;
  },
});

export const deleteTestGame = internalMutation({
  args: { code: v.string(), expectedHostName: v.string() },
  handler: async (ctx, args) => {
    const doc = await lookup(ctx, args.code);
    if (!doc) return false;
    const game = doc.state as Game;
    if (game.players[0]?.name !== args.expectedHostName)
      throw Error("Host name does not match.");
    if (!/^(Root|Eight 0|Smoke 0)$/.test(args.expectedHostName))
      throw Error("Only playtest rooms can be deleted here.");
    await ctx.db.delete(doc._id);
    return true;
  },
});
