import { Hono } from 'hono';
import { ENV } from '../config/env';
import { getDb } from '../db/adapter';
import { checkAndExpandGalaxy } from '../services/galaxy';

export const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email || '']);

  if (!user || user.password_hash !== password) {
    return c.json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' }, 401);
  }

  return c.json({
    user: {
      ...user,
      cargo: JSON.parse(user.cargo_json || '{}'),
      crew: JSON.parse(user.crew_json || '[]'),
      isSuperAdmin: user.email.toLowerCase() === ENV.SUPERUSER_EMAIL.toLowerCase() || user.role === 'SUPERADMIN',
    },
  });
});

authRoutes.post('/register', async (c) => {
  const { email, password, pilotName, shipName } = await c.req.json();
  if (!email || !password) {
    return c.json({ error: '이메일과 비밀번호를 입력해주세요.' }, 400);
  }

  const db = await getDb();
  const existing = await db.get<any>('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  if (existing) {
    return c.json({ error: '이미 등록된 파일럿 이메일입니다.' }, 409);
  }

  const isSuper = email.toLowerCase() === ENV.SUPERUSER_EMAIL.toLowerCase();
  const userId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO users (
      id, email, password_hash, pilot_name, role, credits, current_planet_id,
      ship_name, ship_tier, hull, max_hull, fuel, max_fuel, cargo_capacity,
      mining_laser_level, warp_drive_level, shield_level, cargo_json, crew_json,
      reputation, total_trades, total_mined, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'planet_1', ?, 1, 100, 100, 100, 100, 60, 1, 1, 1, '{}', '[]', 100, 0, 0, ?)`,
    [
      userId,
      email,
      password,
      pilotName || email.split('@')[0],
      isSuper ? 'SUPERADMIN' : 'PILOT',
      ENV.STARTING_CREDITS,
      shipName || 'Astra Pioneer MK-I',
      now,
    ]
  );

  // Trigger automatic planet expansion as user count grows
  const expansion = await checkAndExpandGalaxy(0);
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

  return c.json({
    user: {
      ...user,
      cargo: JSON.parse(user.cargo_json || '{}'),
      crew: JSON.parse(user.crew_json || '[]'),
      isSuperAdmin: isSuper,
    },
    expansion,
  });
});
