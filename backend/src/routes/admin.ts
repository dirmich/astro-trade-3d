import { Hono } from 'hono';
import { ENV } from '../config/env';
import { getDb } from '../db/adapter';
import { BIOME_COLORS, INITIAL_RESOURCES } from '../db/seed';
import { calculateDynamicPrices, runMarketTick } from '../services/economy';
import { checkAndExpandGalaxy } from '../services/galaxy';

export const adminRoutes = new Hono();

async function verifySuperAdmin(email?: string): Promise<boolean> {
  if (!email) return false;
  if (email.toLowerCase() === ENV.SUPERUSER_EMAIL.toLowerCase()) return true;
  const db = await getDb();
  const u = await db.get<any>('SELECT role FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  return u?.role === 'SUPERADMIN';
}

// 1. Add Custom or Auto-Expanded Planet
adminRoutes.post('/planets', async (c) => {
  const body = await c.req.json();
  if (!(await verifySuperAdmin(body.adminEmail))) {
    return c.json({ error: '슈퍼유저(oldtv.cf@gmail.com) 권한이 필요합니다.' }, 403);
  }

  if (body.autoExpandCount) {
    const result = await checkAndExpandGalaxy(Number(body.autoExpandCount));
    return c.json({ message: `자동 행성 확장 완료: ${result.addedPlanets.join(', ')}`, ...result });
  }

  const db = await getDb();
  const planets = await db.query<any>('SELECT id FROM planets');
  const idx = planets.length;
  const planetId = `planet_${idx + 1}`;
  const angle = idx * 0.7;
  const dist = 100 + idx * 26;
  const x = Number((Math.cos(angle) * dist).toFixed(2));
  const z = Number((Math.sin(angle) * dist).toFixed(2));
  const y = Number((((idx % 7) - 3) * 14).toFixed(2));
  const biome = body.biome || 'TERRAN';
  const palette = BIOME_COLORS[biome] || BIOME_COLORS.TERRAN;
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO planets (
      id, name, name_ko, origin_category, biome, sector,
      x, y, z, radius, color_primary, color_secondary, atmosphere_color,
      has_rings, tax_rate, danger_level, has_trading_post, has_repair_shop, has_tavern,
      specialty_desc, is_auto_expanded, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 5.4, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?, 0, ?)`,
    [
      planetId,
      body.name,
      body.nameKo || body.name,
      body.originCategory || 'GREEK_MYTH',
      biome,
      body.sector || 'Admin-Sector',
      x,
      y,
      z,
      palette.primary,
      palette.secondary,
      palette.atmo,
      body.hasRings ? 1 : 0,
      Number(body.taxRate ?? 0.025),
      Number(body.dangerLevel ?? 2),
      body.specialtyDesc || '슈퍼유저 관리자에 의해 직접 창조된 전략 성간 거점 행성.',
      now,
    ]
  );

  for (const r of INITIAL_RESOURCES) {
    const isAbundant = (body.abundantCodes || ['FE_TI', 'HE3']).includes(r.code);
    const stock = isAbundant ? 1500 : 420;
    const mult = isAbundant ? 0.52 : 1.0;
    const { buyPrice, sellPrice } = calculateDynamicPrices(r.base_price, stock, 500, mult, 0.025);
    await db.run(
      `INSERT INTO planet_markets (planet_id, resource_id, stock, base_stock, production_rate, specialty_multiplier, buy_price, sell_price)
       VALUES (?, ?, ?, 500, ?, ?, ?, ?)`,
      [planetId, r.id, stock, isAbundant ? 35 : 12, mult, buyPrice, sellPrice]
    );
  }

  return c.json({ message: `신규 행성 '${body.nameKo || body.name}' 생성이 완료되었습니다.`, planetId });
});

// 2. Update Planet Settings or Market Stock/Price
adminRoutes.patch('/market', async (c) => {
  const { adminEmail, planetId, resourceId, stock, specialtyMultiplier, basePrice } = await c.req.json();
  if (!(await verifySuperAdmin(adminEmail))) {
    return c.json({ error: '슈퍼유저 권한이 필요합니다.' }, 403);
  }

  const db = await getDb();
  if (basePrice !== undefined && resourceId) {
    await db.run('UPDATE resources SET base_price = ? WHERE id = ?', [Number(basePrice), resourceId]);
  }

  if (planetId && resourceId) {
    const res = await db.get<any>('SELECT * FROM resources WHERE id = ?', [resourceId]);
    const planet = await db.get<any>('SELECT * FROM planets WHERE id = ?', [planetId]);
    const m = await db.get<any>('SELECT * FROM planet_markets WHERE planet_id = ? AND resource_id = ?', [planetId, resourceId]);
    if (res && planet && m) {
      const nextStock = stock !== undefined ? Number(stock) : m.stock;
      const nextMult = specialtyMultiplier !== undefined ? Number(specialtyMultiplier) : m.specialty_multiplier;
      const { buyPrice, sellPrice } = calculateDynamicPrices(res.base_price, nextStock, m.base_stock, nextMult, planet.tax_rate);
      await db.run(
        `UPDATE planet_markets SET stock = ?, specialty_multiplier = ?, buy_price = ?, sell_price = ?
         WHERE planet_id = ? AND resource_id = ?`,
        [nextStock, nextMult, buyPrice, sellPrice, planetId, resourceId]
      );
    }
  } else {
    await runMarketTick();
  }

  return c.json({ message: '행성 자원 재고 및 시세가 즉시 반영되었습니다.' });
});

// 3. Simulate User Influx to Trigger Auto Planet Creation
adminRoutes.post('/simulate-users', async (c) => {
  const { adminEmail, count = 4 } = await c.req.json();
  if (!(await verifySuperAdmin(adminEmail))) {
    return c.json({ error: '슈퍼유저 권한이 필요합니다.' }, 403);
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const callSigns = ['Valkyrie', 'Orion', 'Pegasus', 'Andromeda', 'Centauri', 'Hyperion', 'Cassini', 'Voyager', 'Galileo', 'Kepler'];

  for (let i = 0; i < count; i++) {
    const uid = `sim_user_${Date.now()}_${i}`;
    const callSign = `${callSigns[i % callSigns.length]}-${Math.floor(Math.random() * 900 + 100)}`;
    await db.run(
      `INSERT INTO users (
        id, email, password_hash, pilot_name, role, credits, current_planet_id,
        ship_name, ship_tier, hull, max_hull, fuel, max_fuel, cargo_capacity,
        mining_laser_level, warp_drive_level, shield_level, cargo_json, crew_json,
        reputation, total_trades, total_mined, created_at
      ) VALUES (?, ?, 'sim_pass', ?, 'PILOT', ?, 'planet_1', ?, 1, 100, 100, 100, 100, 60, 1, 1, 1, '{}', '[]', 100, 5, 12, ?)`,
      [uid, `${uid}@astro.space`, `Pilot ${callSign}`, 25000 + i * 8500, `StarRunner ${callSign}`, now]
    );
  }

  const expansion = await checkAndExpandGalaxy(0);
  return c.json({
    message: `신규 파일럿 ${count}명 유입 완료! 자동 생성된 행성: ${expansion.addedPlanets.length > 0 ? expansion.addedPlanets.join(', ') : '임계치 대기 중'}`,
    expansion,
  });
});

// 4. Trigger Galaxy-Wide Event
adminRoutes.post('/events', async (c) => {
  const { adminEmail, planetId, resourceId, eventType, title, description, priceMultiplier = 2.0, stockDelta = -350 } = await c.req.json();
  if (!(await verifySuperAdmin(adminEmail))) {
    return c.json({ error: '슈퍼유저 권한이 필요합니다.' }, 403);
  }

  const db = await getDb();
  const eventId = `evt_${Date.now()}`;
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO galaxy_events (id, planet_id, event_type, title, description, resource_id, price_multiplier, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [eventId, planetId, eventType || 'MARKET_SHOCK', title, description, resourceId || null, priceMultiplier, now]
  );

  if (planetId && resourceId) {
    const m = await db.get<any>('SELECT * FROM planet_markets WHERE planet_id = ? AND resource_id = ?', [planetId, resourceId]);
    const r = await db.get<any>('SELECT * FROM resources WHERE id = ?', [resourceId]);
    const p = await db.get<any>('SELECT * FROM planets WHERE id = ?', [planetId]);
    if (m && r && p) {
      const nextStock = Math.max(15, m.stock + Number(stockDelta));
      const { buyPrice, sellPrice } = calculateDynamicPrices(r.base_price, nextStock, m.base_stock, m.specialty_multiplier, p.tax_rate, Number(priceMultiplier));
      await db.run(
        `UPDATE planet_markets SET stock = ?, buy_price = ?, sell_price = ? WHERE planet_id = ? AND resource_id = ?`,
        [nextStock, buyPrice, sellPrice, planetId, resourceId]
      );
    }
  }

  return c.json({ message: `은하 이벤트 '${title}' 발령 완료!`, eventId });
});
