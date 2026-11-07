import { Hono } from 'hono';
import { ENV } from '../config/env';
import { formatUserRecord, getDb, recalculateUserWealthAndLevel } from '../db/adapter';
import { checkAndExpandGalaxy } from '../services/galaxy';

export const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email || '']);

  if (!user || user.password_hash !== password) {
    return c.json({ error: 'Invalid email or password / 이메일 또는 비밀번호가 일치하지 않습니다.' }, 401);
  }

  await recalculateUserWealthAndLevel(user.id);
  const refreshed = await db.get<any>('SELECT * FROM users WHERE id = ?', [user.id]);

  return c.json({
    user: formatUserRecord(refreshed),
  });
});

// Google SSO Login / Auto-Provisioning Endpoint
authRoutes.post('/google-sso', async (c) => {
  const { email, name, googleSub } = await c.req.json();
  const safeEmail = (email || '').trim().toLowerCase();
  if (!safeEmail) {
    return c.json({ error: 'Google account email is required.' }, 400);
  }

  const db = await getDb();
  let user = await db.get<any>('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [safeEmail]);
  const isSuper = safeEmail === ENV.SUPERUSER_EMAIL.toLowerCase();

  if (!user) {
    const userId = `user_google_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();
    const startCredits = isSuper ? 50000 : ENV.STARTING_CREDITS;
    await db.run(
      `INSERT INTO users (
        id, email, password_hash, pilot_name, role, credits, net_worth, pilot_level, current_planet_id,
        ship_name, ship_tier, hull, max_hull, fuel, max_fuel, cargo_capacity,
        mining_laser_level, warp_drive_level, shield_level, warp_tickets, ai_agent_uses,
        cargo_json, crew_json, inventory_json, unlocked_maps_json,
        emergency_map_used, flight_speed_bonus, last_seen_at, auth_provider,
        reputation, total_trades, total_mined, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'planet_1', ?, 1, 100, 100, 100, 100, 60, 1, 1, 1, ?, 1, '{}', '[]', '{}', '{}', 0, 1.0, ?, 'GOOGLE_SSO', 100, 0, 0, ?)`,
      [
        userId,
        safeEmail,
        `google_sso_${googleSub || Date.now()}`,
        name || safeEmail.split('@')[0],
        isSuper ? 'SUPERADMIN' : 'PILOT',
        startCredits,
        startCredits,
        isSuper ? 'Olympus Sovereign X-99' : 'Astra Pioneer MK-I',
        isSuper ? 2 : 0,
        Date.now(),
        now,
      ]
    );
    await checkAndExpandGalaxy(0);
    user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  }

  await recalculateUserWealthAndLevel(user.id);
  const refreshed = await db.get<any>('SELECT * FROM users WHERE id = ?', [user.id]);

  return c.json({
    user: formatUserRecord(refreshed),
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
      id, email, password_hash, pilot_name, role, credits, net_worth, pilot_level, current_planet_id,
      ship_name, ship_tier, hull, max_hull, fuel, max_fuel, cargo_capacity,
      mining_laser_level, warp_drive_level, shield_level, warp_tickets, ai_agent_uses,
      cargo_json, crew_json, inventory_json, unlocked_maps_json,
      emergency_map_used, flight_speed_bonus, last_seen_at, auth_provider,
      reputation, total_trades, total_mined, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'planet_1', ?, 1, 100, 100, 100, 100, 60, 1, 1, 1, 0, 1, '{}', '[]', '{}', '{}', 0, 1.0, ?, 'LOCAL', 100, 0, 0, ?)`,
    [
      userId,
      email,
      password,
      pilotName || email.split('@')[0],
      isSuper ? 'SUPERADMIN' : 'PILOT',
      ENV.STARTING_CREDITS,
      ENV.STARTING_CREDITS,
      shipName || 'Astra Pioneer MK-I',
      Date.now(),
      now,
    ]
  );

  const expansion = await checkAndExpandGalaxy(0);
  await recalculateUserWealthAndLevel(userId);
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

  return c.json({
    user: formatUserRecord(user),
    expansion,
  });
});
