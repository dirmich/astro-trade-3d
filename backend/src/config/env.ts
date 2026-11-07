import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Shared Root `.env` Loader for Backend (`./backend/src/config/env.ts`)
 * Reads `../.env` from project root and parses [COMMON], [BACKEND], and [FRONTEND] sections.
 */
function loadRootEnv(): Record<string, string> {
  const candidates = [
    resolve(process.cwd(), '../.env'),
    resolve(process.cwd(), '.env'),
  ];
  const envMap: Record<string, string> = {};

  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, 'utf-8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        envMap[key] = val;
      }
      break;
    }
  }
  return { ...envMap, ...(process.env as Record<string, string>) };
}

const rawEnv = loadRootEnv();

export const ENV = {
  APP_NAME: rawEnv.APP_NAME || 'AstroTrade 3D',
  APP_VERSION: rawEnv.APP_VERSION || '1.0.0',
  APP_ENV: rawEnv.APP_ENV || 'development',

  BACKEND_HOST: rawEnv.BACKEND_HOST || '0.0.0.0',
  BACKEND_PORT: Number(rawEnv.BACKEND_PORT || 4000),
  DB_CLIENT: (rawEnv.DB_CLIENT || 'sqlite') as 'sqlite' | 'postgres',
  SQLITE_DB_PATH: rawEnv.SQLITE_DB_PATH || './backend/data/astrotrade.sqlite',
  POSTGRES_URL: rawEnv.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/astrotrade',
  JWT_SECRET: rawEnv.JWT_SECRET || 'astrotrade-3d-orbital-quantum-jwt-secret-key-2026',

  SUPERUSER_EMAIL: rawEnv.SUPERUSER_EMAIL || 'oldtv.cf@gmail.com',
  SUPERUSER_INITIAL_PASSWORD: rawEnv.SUPERUSER_INITIAL_PASSWORD || 'AstroAdmin!2026#',

  INITIAL_PLANET_COUNT: Number(rawEnv.INITIAL_PLANET_COUNT || 30),
  PLANET_EXPANSION_USERS_PER_PLANET: Number(rawEnv.PLANET_EXPANSION_USERS_PER_PLANET || 2),
  MARKET_TICK_INTERVAL_SECONDS: Number(rawEnv.MARKET_TICK_INTERVAL_SECONDS || 30),
  STARTING_CREDITS: Number(rawEnv.STARTING_CREDITS || 3500),
};
