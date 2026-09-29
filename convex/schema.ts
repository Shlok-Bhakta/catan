import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
  games: defineTable({
    code: v.string(),
    state: v.any(),
    seats: v.array(v.object({ id: v.string(), token: v.string() })),
  }).index("by_code", ["code"]),
});
