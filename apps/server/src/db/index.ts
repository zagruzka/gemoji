import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import { DEFAULT_UNDERCOVER_WORDS } from "@gemoji/game-undercover/words";
import { DEFAULT_WORDTRAP_WORDS } from "@gemoji/game-wordtrap/words";
import * as schema from "./schema";

const DEFAULT_DB_PATH = resolve(import.meta.dir, "../../gemoji.sqlite");
const DB_PATH =
  process.env.DATABASE_PATH ??
  (process.env.NODE_ENV === "test" ? ":memory:" : DEFAULT_DB_PATH);

export const sqlite = new Database(DB_PATH, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS word_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_a TEXT NOT NULL,
    word_b TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'id',
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(word_a, word_b, language)
  );

  CREATE TABLE IF NOT EXISTS wordtrap_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'id',
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(word, language)
  );

  CREATE TABLE IF NOT EXISTS match_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    player_count INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

export const db = drizzle(sqlite, { schema });

export function seedDefaultWordsIfEmpty(): number {
  const existing = sqlite.query("SELECT COUNT(*) as count FROM word_pairs").get() as { count: number };
  if (existing.count > 0) return existing.count;

  const insert = sqlite.prepare(
    "INSERT OR IGNORE INTO word_pairs (word_a, word_b, language, is_active) VALUES (?, ?, 'id', 1)",
  );
  const tx = sqlite.transaction(() => {
    for (const pair of DEFAULT_UNDERCOVER_WORDS) {
      insert.run(pair.wordA, pair.wordB);
    }
  });
  tx();

  const after = sqlite.query("SELECT COUNT(*) as count FROM word_pairs").get() as { count: number };
  return after.count;
}

export function pickLibraryWordPairFromDb(usedKeys: Set<string>): { wordA: string; wordB: string } | null {
  const rows = db
    .select({ wordA: schema.wordPairs.wordA, wordB: schema.wordPairs.wordB })
    .from(schema.wordPairs)
    .where(eq(schema.wordPairs.isActive, true))
    .all();

  if (rows.length === 0) return null;

  const normalize = (w: string) => w.trim().toLowerCase().replace(/\s+/g, " ");
  const unused = rows.filter((r) => !usedKeys.has(`${normalize(r.wordA)}::${normalize(r.wordB)}`));
  const source = unused.length > 0 ? unused : rows;
  const idx = Math.floor(Math.random() * source.length);
  return source[idx] ?? null;
}

export function seedWordtrapWordsIfEmpty(): number {
  const existing = sqlite.query("SELECT COUNT(*) as count FROM wordtrap_words").get() as {
    count: number;
  };
  if (existing.count > 0) return existing.count;

  const insert = sqlite.prepare(
    "INSERT OR IGNORE INTO wordtrap_words (word, language, is_active) VALUES (?, 'id', 1)",
  );
  const tx = sqlite.transaction(() => {
    for (const word of DEFAULT_WORDTRAP_WORDS) {
      insert.run(word);
    }
  });
  tx();

  const after = sqlite.query("SELECT COUNT(*) as count FROM wordtrap_words").get() as {
    count: number;
  };
  return after.count;
}

export function getAllWordtrapWordsFromDb(): string[] {
  const rows = db
    .select({ word: schema.wordtrapWords.word })
    .from(schema.wordtrapWords)
    .where(eq(schema.wordtrapWords.isActive, true))
    .all();
  return rows.map((r) => r.word);
}
