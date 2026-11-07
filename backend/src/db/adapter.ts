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
  credits INTEGER NOT NULL DEFAULT 3500,
  net_worth INTEGER NOT NULL DEFAULT 3500,
  pilot_level INTEGER NOT NULL DEFAULT 1,
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
  warp_tickets INTEGER NOT NULL DEFAULT 0,
  ai_agent_uses INTEGER NOT NULL DEFAULT 0,
  cargo_json TEXT NOT NULL DEFAULT '{}',
  crew_json TEXT NOT NULL DEFAULT '[]',
  inventory_json TEXT NOT NULL DEFAULT '{}',
  unlocked_maps_json TEXT NOT NULL DEFAULT '{}',
  settings_json TEXT NOT NULL DEFAULT '{"lang":"en","bgmEnabled":true,"sfxEnabled":true,"bgmVolume":0.45,"sfxVolume":0.7}',
  emergency_map_used INTEGER NOT NULL DEFAULT 0,
  flight_speed_bonus REAL NOT NULL DEFAULT 1.0,
  ship_x REAL NOT NULL DEFAULT 95,
  ship_y REAL NOT NULL DEFAULT 2,
  ship_z REAL NOT NULL DEFAULT 12,
  last_seen_at INTEGER NOT NULL DEFAULT 0,
  auth_provider TEXT NOT NULL DEFAULT 'LOCAL',
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

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quests (
  id TEXT PRIMARY KEY,
  min_level INTEGER NOT NULL DEFAULT 1,
  max_level INTEGER NOT NULL DEFAULT 10,
  quest_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_amount INTEGER NOT NULL DEFAULT 5,
  reward_credits INTEGER NOT NULL DEFAULT 1500,
  reward_warp_tickets INTEGER NOT NULL DEFAULT 0,
  title_en TEXT NOT NULL,
  title_ko TEXT NOT NULL,
  title_ja TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  desc_en TEXT NOT NULL,
  desc_ko TEXT NOT NULL,
  desc_ja TEXT NOT NULL,
  desc_zh TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_quests (
  user_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, quest_id)
);

CREATE TABLE IF NOT EXISTS space_pirates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ko TEXT NOT NULL,
  sector TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  hp INTEGER NOT NULL DEFAULT 100,
  max_hp INTEGER NOT NULL DEFAULT 100,
  attack INTEGER NOT NULL DEFAULT 12,
  reward_credits INTEGER NOT NULL DEFAULT 1200,
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
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

async function ensureColumnsExist(db: DatabaseAdapter) {
  const alterStatements = [
    `ALTER TABLE users ADD COLUMN inventory_json TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE users ADD COLUMN unlocked_maps_json TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE users ADD COLUMN emergency_map_used INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN flight_speed_bonus REAL NOT NULL DEFAULT 1.0`,
    `ALTER TABLE users ADD COLUMN net_worth INTEGER NOT NULL DEFAULT 3500`,
    `ALTER TABLE users ADD COLUMN pilot_level INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN warp_tickets INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN ai_agent_uses INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{"lang":"en","bgmEnabled":true,"sfxEnabled":true,"bgmVolume":0.45,"sfxVolume":0.7}'`,
    `ALTER TABLE users ADD COLUMN ship_x REAL NOT NULL DEFAULT 95`,
    `ALTER TABLE users ADD COLUMN ship_y REAL NOT NULL DEFAULT 2`,
    `ALTER TABLE users ADD COLUMN ship_z REAL NOT NULL DEFAULT 12`,
    `ALTER TABLE users ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'LOCAL'`,
  ];
  for (const stmt of alterStatements) {
    try {
      await db.exec(stmt);
    } catch {
      // Column already exists
    }
  }
}

/**
 * Asset thresholds for dynamic Pilot Level (Lv.1 ~ Lv.10).
 * Level rises when net worth grows and drops when net worth falls!
 */
export const WEALTH_LEVEL_THRESHOLDS = [
  { level: 1, minWorth: 0, titleEn: 'Cadet Drifter', titleKo: '견습 파일럿' },
  { level: 2, minWorth: 6000, titleEn: 'Orbital Courier', titleKo: '궤도 수송원' },
  { level: 3, minWorth: 15000, titleEn: 'Sector Trader', titleKo: '구역 무역상' },
  { level: 4, minWorth: 32000, titleEn: 'Star Navigator', titleKo: '성간 항해사' },
  { level: 5, minWorth: 65000, titleEn: 'Fleet Captain', titleKo: '선단 캡틴' },
  { level: 6, minWorth: 130000, titleEn: 'Void Commodore', titleKo: '보이드 제독' },
  { level: 7, minWorth: 260000, titleEn: 'Nebula Baron', titleKo: '성운 남작' },
  { level: 8, minWorth: 520000, titleEn: 'Galactic Tycoon', titleKo: '은하 거물' },
  { level: 9, minWorth: 1000000, titleEn: 'Astral Archon', titleKo: '아스트랄 집정관' },
  { level: 10, minWorth: 2200000, titleEn: 'Chronos Sovereign', titleKo: '크로노스 지배자' },
];

export function computeLevelFromNetWorth(netWorth: number): number {
  let lv = 1;
  for (const t of WEALTH_LEVEL_THRESHOLDS) {
    if (netWorth >= t.minWorth) lv = t.level;
  }
  return lv;
}

export async function recalculateUserWealthAndLevel(userId: string): Promise<{
  netWorth: number;
  pilotLevel: number;
  prevLevel: number;
}> {
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return { netWorth: 0, pilotLevel: 1, prevLevel: 1 };

  const prevLevel = Number(user.pilot_level || 1);
  const cargo: Record<string, number> = JSON.parse(user.cargo_json || '{}');
  const resources = await db.query<any>('SELECT id, base_price FROM resources');
  const resPriceMap = new Map<string, number>(resources.map((r) => [r.id, Number(r.base_price || 50)]));

  let cargoVal = 0;
  for (const [rId, qty] of Object.entries(cargo)) {
    cargoVal += (resPriceMap.get(rId) || 80) * Number(qty || 0);
  }

  const shipTierBonus = Math.max(0, (Number(user.ship_tier || 1) - 1) * 8000);
  const netWorth = Math.max(0, Math.round(Number(user.credits || 0) + cargoVal + shipTierBonus));
  const pilotLevel = computeLevelFromNetWorth(netWorth);

  await db.run(
    'UPDATE users SET net_worth = ?, pilot_level = ?, last_seen_at = ? WHERE id = ?',
    [netWorth, pilotLevel, Date.now(), userId]
  );

  return { netWorth, pilotLevel, prevLevel };
}

export function formatUserRecord(user: any) {
  if (!user) return null;
  let parsedSettings = {
    lang: 'en',
    bgmEnabled: true,
    sfxEnabled: true,
    bgmVolume: 0.45,
    sfxVolume: 0.7,
  };
  try {
    parsedSettings = { ...parsedSettings, ...JSON.parse(user.settings_json || '{}') };
  } catch {
    // ignore
  }

  return {
    ...user,
    pilot_level: Number(user.pilot_level || computeLevelFromNetWorth(Number(user.net_worth || user.credits || 0))),
    net_worth: Number(user.net_worth || user.credits || 0),
    warp_tickets: Number(user.warp_tickets || 0),
    ai_agent_uses: Number(user.ai_agent_uses || 0),
    cargo: JSON.parse(user.cargo_json || '{}'),
    crew: JSON.parse(user.crew_json || '[]'),
    inventory: JSON.parse(user.inventory_json || '{}'),
    unlockedMaps: JSON.parse(user.unlocked_maps_json || '{}'),
    settings: parsedSettings,
    emergencyMapUsed: Number(user.emergency_map_used || 0),
    emergencyMapLimit: 3,
    flightSpeedBonus: Number(user.flight_speed_bonus || 1.0),
    isSuperAdmin:
      (user.email || '').toLowerCase() === ENV.SUPERUSER_EMAIL.toLowerCase() ||
      user.role === 'SUPERADMIN',
  };
}

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
    await ensureColumnsExist(dbInstance);
    return dbInstance;
  }

  // Default: Initial SQLite database via Bun's native bun:sqlite
  const { Database } = await import('bun:sqlite');
  const { mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  mkdirSync(dirname(ENV.SQLITE_DB_PATH), { recursive: true });
  const sqlite = new Database(ENV.SQLITE_DB_PATH, { create: true });
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

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
  await ensureColumnsExist(dbInstance);
  return dbInstance;
}
