import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { config } from '../config.js';

/**
 * Тонкая обёртка над встроенным в Node модулем `node:sqlite`.
 * Никаких нативных зависимостей — проект запускается «из коробки».
 */
export class Db {
  private readonly raw: DatabaseSync;
  private readonly cache = new Map<string, StatementSync>();
  private txDepth = 0;

  constructor(file: string) {
    this.raw = new DatabaseSync(file);
    this.raw.exec('PRAGMA journal_mode = WAL');
    this.raw.exec('PRAGMA foreign_keys = ON');
    this.raw.exec('PRAGMA busy_timeout = 5000');
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  private stmt(sql: string): StatementSync {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  get<T = unknown>(sql: string, ...params: SqlParam[]): T | undefined {
    return this.stmt(sql).get(...(params as never[])) as T | undefined;
  }

  all<T = unknown>(sql: string, ...params: SqlParam[]): T[] {
    return this.stmt(sql).all(...(params as never[])) as T[];
  }

  run(sql: string, ...params: SqlParam[]): { changes: number; lastInsertRowid: number } {
    const r = this.stmt(sql).run(...(params as never[]));
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
  }

  /** Значение одного скалярного выражения */
  scalar<T = unknown>(sql: string, ...params: SqlParam[]): T | undefined {
    const row = this.get<Record<string, unknown>>(sql, ...params);
    if (!row) return undefined;
    const keys = Object.keys(row);
    return keys.length ? (row[keys[0]!] as T) : undefined;
  }

  /** Транзакция (с поддержкой вложенности через SAVEPOINT) */
  tx<T>(fn: () => T): T {
    const isOuter = this.txDepth === 0;
    this.raw.exec(isOuter ? 'BEGIN IMMEDIATE' : `SAVEPOINT sp_${this.txDepth}`);
    this.txDepth += 1;
    try {
      const result = fn();
      this.txDepth -= 1;
      this.raw.exec(isOuter ? 'COMMIT' : `RELEASE sp_${this.txDepth}`);
      return result;
    } catch (err) {
      this.txDepth -= 1;
      this.raw.exec(isOuter ? 'ROLLBACK' : `ROLLBACK TO sp_${this.txDepth}`);
      throw err;
    }
  }

  close(): void {
    this.cache.clear();
    this.raw.close();
  }
}

export type SqlParam = string | number | null | Uint8Array;

let instance: Db | null = null;

export function getDb(): Db {
  if (!instance) instance = new Db(config.databaseFile);
  return instance;
}

export function closeDb(): void {
  instance?.close();
  instance = null;
}

/** Транзакция поверх текущего соединения. */
export function transaction<T>(fn: () => T): T {
  return getDb().tx(fn);
}

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: '001_init',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name    TEXT    NOT NULL,
        last_name     TEXT    NOT NULL,
        username      TEXT    NOT NULL UNIQUE,
        password_hash TEXT    NOT NULL,
        role          TEXT    NOT NULL CHECK (role IN ('STUDENT', 'MONITOR', 'CURATOR')),
        position      INTEGER NOT NULL DEFAULT 0,
        is_active     INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT    NOT NULL,
        updated_at    TEXT    NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (lower(username));
      CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

      CREATE TABLE IF NOT EXISTS duties (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        date                TEXT    NOT NULL,
        user_id             INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        status              TEXT    NOT NULL CHECK (status IN ('ASSIGNED', 'DONE', 'MISSED', 'SICK', 'REPLACED')),
        replacement_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
        comment             TEXT,
        created_by          INTEGER REFERENCES users (id) ON DELETE SET NULL,
        updated_by          INTEGER REFERENCES users (id) ON DELETE SET NULL,
        created_at          TEXT    NOT NULL,
        updated_at          TEXT    NOT NULL,
        UNIQUE (date, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_duties_date ON duties (date);
      CREATE INDEX IF NOT EXISTS idx_duties_user ON duties (user_id);

      CREATE TABLE IF NOT EXISTS audit_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id    INTEGER REFERENCES users (id) ON DELETE SET NULL,
        actor_name  TEXT    NOT NULL,
        actor_role  TEXT    NOT NULL,
        action      TEXT    NOT NULL,
        entity_type TEXT    NOT NULL,
        entity_id   INTEGER,
        summary     TEXT    NOT NULL,
        details     TEXT,
        created_at  TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);
    `,
  },
];

export function migrate(): void {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);
  const applied = new Set(db.all<{ name: string }>('SELECT name FROM _migrations').map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    db.tx(() => {
      db.exec(m.sql);
      db.run('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', m.name, new Date().toISOString());
    });
  }
}
