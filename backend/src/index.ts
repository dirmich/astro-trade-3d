/**
 * AstroTrade 3D — Bun.sh + Hono.js Backend Entrypoint
 * Uses shared root `../.env` and supports SQLite (initial default) and PostgreSQL.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ENV } from './config/env';
import { seedDatabaseIfNeeded } from './db/seed';
import { authRoutes } from './routes/auth';
import { gameRoutes } from './routes/game';
import { adminRoutes } from './routes/admin';
import { runMarketTick } from './services/economy';

const app = new Hono();

app.use('*', cors());

app.get('/api/health', (c) =>
  c.json({
    status: 'ok',
    app: ENV.APP_NAME,
    version: ENV.APP_VERSION,
    dbClient: ENV.DB_CLIENT,
    superuser: ENV.SUPERUSER_EMAIL,
  })
);

app.route('/api/auth', authRoutes);
app.route('/api/game', gameRoutes);
app.route('/api/admin', adminRoutes);

// Initialize seed data (30 planets, 12 resources, superuser oldtv.cf@gmail.com)
await seedDatabaseIfNeeded();

// Periodic Market Tick
setInterval(() => {
  runMarketTick().catch((err) => console.error('Market tick error:', err));
}, ENV.MARKET_TICK_INTERVAL_SECONDS * 1000);

console.log(`🚀 [AstroTrade 3D Backend] Running on http://${ENV.BACKEND_HOST}:${ENV.BACKEND_PORT}`);
console.log(`👑 [Superuser Ready] ${ENV.SUPERUSER_EMAIL} / Initial Password: ${ENV.SUPERUSER_INITIAL_PASSWORD}`);

export default {
  port: ENV.BACKEND_PORT,
  hostname: ENV.BACKEND_HOST,
  fetch: app.fetch,
};
