/**
 * SQLite (initial default via `bun:sqlite`) & PostgreSQL Unified Database Schema & Adapter
 */
import { ENV } from '../config/env';

export const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  pilot_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'PILOT',
  credits INTEGER NOT NULL DEFAULT 25000,
  current_planet_id TEXT NOT NULL DEFAULT 'planet_1',
  ship_name TEXT NOT NULL DEFAULT 'Aegis Voyager MK-I',
  ship_tier INTEGER NOT NULL DEFAULT 1,
  hull INTEGER NOT NULL DEFAULT 100,
  max_hull INTEGER NOT NULL DEFAULT 100,
  fuel INTEGER NOT NULL DEFAULT 100,
  max_fuel INTEGER NOT NULL DEFAULT 100,
  cargo_capacity INTEGER NOT NULL DEFAULT 60,
  mining_laser_level INTEGER NOT NULL DEFAULT 1,
  warp_drive_level INTEGER NOT NULL DEFAULT 1,
  shield_level INTEGER NOT NULL DEFAULT 1,
  cargo_json TEXT NOT NULL DEFAULT '{}',
  crew_json TEXT NOT NULL DEFAULT '[]',
  reputation INTEGER NOT NULL DEFAULT 100,
  total_trades INTEGER NOT NULL DEFAULT 0,
  total_mined INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  tier TEXT NOT NULL,
  base_price INTEGER NOT NULL,
  unit_mass INTEGER NOT NULL DEFAULT 1,
  color TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS planets (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  name_ko TEXT NOT NULL,
  origin_category TEXT NOT NULL,
  biome TEXT NOT NULL,
  sector TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL NOT NULL,
  radius REAL NOT NULL,
  color_primary TEXT NOT NULL,
  color_secondary TEXT NOT NULL,
  atmosphere_color TEXT NOT NULL,
  has_rings INTEGER NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0.03,
  danger_level INTEGER NOT NULL DEFAULT 1,
  has_trading_post INTEGER NOT NULL DEFAULT 1,
  has_repair_shop INTEGER NOT NULL DEFAULT 1,
  has_tavern INTEGER NOT NULL DEFAULT 1,
  specialty_desc TEXT NOT NULL,
  is_auto_expanded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS planet_markets (
  planet_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  stock INTEGER NOT NULL,
  base_stock INTEGER NOT NULL,
  production_rate INTEGER NOT NULL,
  specialty_multiplier REAL NOT NULL DEFAULT 1.0,
  buy_price INTEGER NOT NULL,
  sell_price INTEGER NOT NULL,
  PRIMARY KEY (planet_id, resource_id)
);

CREATE TABLE IF NOT EXISTS galaxy_events (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resource_id TEXT,
  price_multiplier REAL NOT NULL DEFAULT 1.0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
`;

export const POSTGRES_SCHEMA = SQLITE_SCHEMA
  .replace(/INTEGER/g, 'INTEGER')
  .replace(/REAL/g, 'DOUBLE PRECISION');

export interface DatabaseAdapter {
  clientType: 'sqlite' | 'postgres';
  exec(sql: string): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  get<T = any>(sql: string, params?: any[]): Promise<T | null>;
  run(sql: string, params?: any[]): Promise<void>;
}

let dbInstance: DatabaseAdapter | null = null;

export async function getDb(): Promise<DatabaseAdapter> {
  if (dbInstance) return dbInstance;

  if (ENV.DB_CLIENT === 'postgres') {
    const postgres = (await import('postgres')).default;
    const sqlClient = postgres(ENV.POSTGRES_URL);
    dbInstance = {
      clientType: 'postgres',
      async exec(sql: string) {
        await sqlClient.unsafe(sql);
      },
      async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        let idx = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
        const rows = await sqlClient.unsafe(pgSql, params);
        return rows as unknown as T[];
      },
      async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
        const rows = await this.query<T>(sql, params);
        return rows[0] || null;
      },
      async run(sql: string, params: any[] = []): Promise<void> {
        await this.query(sql, params);
      },
    };
    await dbInstance.exec(POSTGRES_SCHEMA);
    return dbInstance;
  }

  // Default: Initial SQLite database via Bun's native bun:sqlite
  const { Database } = await import('bun:sqlite');
  const { mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  mkdirSync(dirname(ENV.SQLITE_DB_PATH), { recursive: true });
  const sqlite = new Database(ENV.SQLITE_DB_PATH, { create: true });

  dbInstance = {
    clientType: 'sqlite',
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      return sqlite.query(sql).all(...params) as T[];
    },
    async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
      return (sqlite.query(sql).get(...params) as T) || null;
    },
    async run(sql: string, params: any[] = []): Promise<void> {
      sqlite.query(sql).run(...params);
    },
  };

  await dbInstance.exec(SQLITE_SCHEMA);
  return dbInstance;
}
