import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const wordPairs = sqliteTable("word_pairs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  wordA: text("word_a").notNull(),
  wordB: text("word_b").notNull(),
  language: text("language").notNull().default("id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const matchLogs = sqliteTable("match_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: text("game_id").notNull(),
  playerCount: integer("player_count").notNull(),
  durationSec: integer("duration_sec").notNull(),
  createdAt: integer("created_at").notNull(),
});
