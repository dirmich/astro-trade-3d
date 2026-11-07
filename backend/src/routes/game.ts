import { Hono } from 'hono';
import { getDb } from '../db/adapter';
import { calculateDynamicPrices, runMarketTick } from '../services/economy';
import { SHIP_TIERS, triggerTavernEvent } from '../services/events';

export const gameRoutes = new Hono();

gameRoutes.get('/universe', async (c) => {
  const db = await getDb();
  const planets = await db.query<any>('SELECT * FROM planets ORDER BY created_at ASC, id ASC');
  const resources = await db.query<any>('SELECT * FROM resources');
  const markets = await db.query<any>('SELECT * FROM planet_markets');
  const events = await db.query<any>('SELECT * FROM galaxy_events WHERE active = 1 ORDER BY created_at DESC');
  const usersCountRow = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users');
  const leaderboard = await db.query<any>(
    'SELECT id, pilot_name, email, ship_name, ship_tier, credits, reputation, total_trades, total_mined FROM users ORDER BY credits DESC LIMIT 15'
  );

  return c.json({
    planets,
    resources,
    markets,
    events,
    totalUsers: Number(usersCountRow?.cnt || 1),
    leaderboard,
  });
});

gameRoutes.post('/warp', async (c) => {
  const { userId, targetPlanetId } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const fromPlanet = await db.get<any>('SELECT * FROM planets WHERE id = ?', [user?.current_planet_id]);
  const toPlanet = await db.get<any>('SELECT * FROM planets WHERE id = ?', [targetPlanetId]);

  if (!user || !toPlanet) return c.json({ error: '항법 대상을 찾을 수 없습니다.' }, 404);

  const dx = toPlanet.x - (fromPlanet?.x || 0);
  const dy = toPlanet.y - (fromPlanet?.y || 0);
  const dz = toPlanet.z - (fromPlanet?.z || 0);
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const fuelCost = Math.max(4, Math.round((dist / 28) * Math.max(0.45, 1 - (user.warp_drive_level - 1) * 0.12)));

  if (user.fuel < fuelCost) {
    return c.json({ error: `워프 연료가 부족합니다. (필요: ${fuelCost}, 현재: ${user.fuel})` }, 400);
  }

  let hullDamage = 0;
  let encounterMsg = `${toPlanet.name_ko}(${toPlanet.name}) 궤도에 안전하게 워프 진입했습니다.`;

  if (Math.random() < toPlanet.danger_level * 0.08) {
    hullDamage = Math.max(2, Math.round((toPlanet.danger_level * 5) / Math.max(1, user.shield_level)));
    encounterMsg = `[항로 경보] 워프 출구에서 성간 해적 매복 및 이온 난기류 조우! 실드가 충격을 흡수했으나 선체 내구도가 ${hullDamage} 감소했습니다.`;
  }

  const newHull = Math.max(10, user.hull - hullDamage);
  const newFuel = Math.max(0, user.fuel - fuelCost);

  await db.run(
    'UPDATE users SET current_planet_id = ?, fuel = ?, hull = ? WHERE id = ?',
    [targetPlanetId, newFuel, newHull, userId]
  );

  await runMarketTick();
  const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

  return c.json({
    user: {
      ...updatedUser,
      cargo: JSON.parse(updatedUser.cargo_json || '{}'),
      crew: JSON.parse(updatedUser.crew_json || '[]'),
    },
    fuelCost,
    hullDamage,
    message: encounterMsg,
  });
});

gameRoutes.post('/mine', async (c) => {
  const { userId, resourceId, comboBonus = 1 } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const res = await db.get<any>('SELECT * FROM resources WHERE id = ?', [resourceId]);
  if (!user || !res) return c.json({ error: '채집 대상 자원을 찾을 수 없습니다.' }, 404);

  const cargo: Record<string, number> = JSON.parse(user.cargo_json || '{}');
  const usedCargo = Object.values(cargo).reduce((a, b) => a + b, 0);
  if (usedCargo >= user.cargo_capacity) {
    return c.json({ error: '화물칸이 가득 찼습니다! 교역소에서 매도하거나 수리점에서 화물칸을 확장하세요.' }, 400);
  }

  const rawYield = Math.max(1, Math.round((2 + user.mining_laser_level * 2) * comboBonus));
  const actualYield = Math.min(rawYield, user.cargo_capacity - usedCargo);
  cargo[resourceId] = (cargo[resourceId] || 0) + actualYield;

  await db.run(
    'UPDATE users SET cargo_json = ?, total_mined = total_mined + ?, fuel = MAX(0, fuel - 2) WHERE id = ?',
    [JSON.stringify(cargo), actualYield, userId]
  );

  const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  return c.json({
    user: {
      ...updatedUser,
      cargo: JSON.parse(updatedUser.cargo_json || '{}'),
      crew: JSON.parse(updatedUser.crew_json || '[]'),
    },
    minedAmount: actualYield,
    resourceName: res.name_ko,
  });
});

gameRoutes.post('/trade', async (c) => {
  const { userId, planetId, resourceId, type, quantity } = await c.req.json();
  const qty = Math.max(1, Math.floor(Number(quantity || 1)));
  const db = await getDb();

  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const planet = await db.get<any>('SELECT * FROM planets WHERE id = ?', [planetId]);
  const resource = await db.get<any>('SELECT * FROM resources WHERE id = ?', [resourceId]);
  const market = await db.get<any>(
    'SELECT * FROM planet_markets WHERE planet_id = ? AND resource_id = ?',
    [planetId, resourceId]
  );

  if (!user || !planet || !resource || !market) {
    return c.json({ error: '교역소 데이터를 찾을 수 없습니다.' }, 404);
  }

  const cargo: Record<string, number> = JSON.parse(user.cargo_json || '{}');
  const usedCargo = Object.values(cargo).reduce((a, b) => a + b, 0);

  if (type === 'BUY') {
    if (market.stock < qty) {
      return c.json({ error: `행성 교역소 재고가 부족합니다 (현재 재고: ${market.stock}).` }, 400);
    }
    if (usedCargo + qty > user.cargo_capacity) {
      return c.json({ error: `우주선 화물칸 용량이 부족합니다 (여유 공간: ${user.cargo_capacity - usedCargo}).` }, 400);
    }
    const totalCost = market.buy_price * qty;
    if (user.credits < totalCost) {
      return c.json({ error: `크레딧이 부족합니다 (필요: ${totalCost.toLocaleString()} CR).` }, 400);
    }

    cargo[resourceId] = (cargo[resourceId] || 0) + qty;
    const newStock = Math.max(5, market.stock - qty);
    const { buyPrice, sellPrice } = calculateDynamicPrices(
      resource.base_price,
      newStock,
      market.base_stock,
      market.specialty_multiplier,
      planet.tax_rate
    );

    await db.run(
      'UPDATE users SET credits = credits - ?, cargo_json = ?, total_trades = total_trades + ? WHERE id = ?',
      [totalCost, JSON.stringify(cargo), qty, userId]
    );
    await db.run(
      'UPDATE planet_markets SET stock = ?, buy_price = ?, sell_price = ? WHERE planet_id = ? AND resource_id = ?',
      [newStock, buyPrice, sellPrice, planetId, resourceId]
    );
  } else {
    const currentHeld = cargo[resourceId] || 0;
    if (currentHeld < qty) {
      return c.json({ error: `보유 중인 ${resource.name_ko} 수량이 부족합니다.` }, 400);
    }
    const totalRevenue = market.sell_price * qty;
    cargo[resourceId] = currentHeld - qty;
    if (cargo[resourceId] <= 0) delete cargo[resourceId];

    const newStock = market.stock + qty;
    const { buyPrice, sellPrice } = calculateDynamicPrices(
      resource.base_price,
      newStock,
      market.base_stock,
      market.specialty_multiplier,
      planet.tax_rate
    );

    await db.run(
      'UPDATE users SET credits = credits + ?, cargo_json = ?, total_trades = total_trades + ?, reputation = reputation + 1 WHERE id = ?',
      [totalRevenue, JSON.stringify(cargo), qty, userId]
    );
    await db.run(
      'UPDATE planet_markets SET stock = ?, buy_price = ?, sell_price = ? WHERE planet_id = ? AND resource_id = ?',
      [newStock, buyPrice, sellPrice, planetId, resourceId]
    );
  }

  const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const updatedMarket = await db.get<any>(
    'SELECT * FROM planet_markets WHERE planet_id = ? AND resource_id = ?',
    [planetId, resourceId]
  );

  return c.json({
    user: {
      ...updatedUser,
      cargo: JSON.parse(updatedUser.cargo_json || '{}'),
      crew: JSON.parse(updatedUser.crew_json || '[]'),
    },
    market: updatedMarket,
  });
});

gameRoutes.post('/repair', async (c) => {
  const { userId, action } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

  if (action === 'REPAIR_HULL') {
    const missing = user.max_hull - user.hull;
    const cost = Math.max(0, missing * 15);
    if (user.credits < cost) return c.json({ error: '수리 비용이 부족합니다.' }, 400);
    await db.run('UPDATE users SET hull = max_hull, credits = credits - ? WHERE id = ?', [cost, userId]);
  } else if (action === 'REFUEL') {
    const missing = user.max_fuel - user.fuel;
    const cost = Math.max(0, missing * 8);
    if (user.credits < cost) return c.json({ error: '연료 충전 비용이 부족합니다.' }, 400);
    await db.run('UPDATE users SET fuel = max_fuel, credits = credits - ? WHERE id = ?', [cost, userId]);
  } else if (action === 'UPGRADE_CARGO') {
    const cost = 4500 * Math.ceil(user.cargo_capacity / 50);
    if (user.credits < cost) return c.json({ error: `화물칸 확장 비용(${cost.toLocaleString()} CR)이 부족합니다.` }, 400);
    await db.run('UPDATE users SET cargo_capacity = cargo_capacity + 40, credits = credits - ? WHERE id = ?', [cost, userId]);
  } else if (action === 'UPGRADE_LASER') {
    const cost = 6000 * user.mining_laser_level;
    if (user.credits < cost) return c.json({ error: `채굴 레이저 강화 비용(${cost.toLocaleString()} CR)이 부족합니다.` }, 400);
    await db.run('UPDATE users SET mining_laser_level = mining_laser_level + 1, credits = credits - ? WHERE id = ?', [cost, userId]);
  } else if (action === 'UPGRADE_WARP') {
    const cost = 6500 * user.warp_drive_level;
    if (user.credits < cost) return c.json({ error: `워프 드라이브 강화 비용(${cost.toLocaleString()} CR)이 부족합니다.` }, 400);
    await db.run('UPDATE users SET warp_drive_level = warp_drive_level + 1, credits = credits - ? WHERE id = ?', [cost, userId]);
  } else if (action === 'UPGRADE_SHIP_TIER') {
    const nextTier = SHIP_TIERS.find((t) => t.tier === user.ship_tier + 1);
    if (!nextTier) return c.json({ error: '이미 최종 등급의 기함(Leviathan)을 운용 중입니다.' }, 400);
    if (user.credits < nextTier.cost) return c.json({ error: `함선 건조 비용(${nextTier.cost.toLocaleString()} CR)이 부족합니다.` }, 400);
    await db.run(
      `UPDATE users SET ship_tier = ?, ship_name = ?, cargo_capacity = MAX(cargo_capacity, ?),
       max_hull = ?, hull = ?, max_fuel = ?, fuel = ?, credits = credits - ? WHERE id = ?`,
      [nextTier.tier, nextTier.name, nextTier.cargo, nextTier.maxHull, nextTier.maxHull, nextTier.maxFuel, nextTier.maxFuel, nextTier.cost, userId]
    );
  }

  const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  return c.json({
    user: {
      ...updatedUser,
      cargo: JSON.parse(updatedUser.cargo_json || '{}'),
      crew: JSON.parse(updatedUser.crew_json || '[]'),
    },
  });
});

gameRoutes.post('/tavern', async (c) => {
  const { userId, actionType, wager } = await c.req.json();
  try {
    const result = await triggerTavernEvent(userId, actionType, wager);
    const db = await getDb();
    const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    return c.json({
      ...result,
      user: {
        ...updatedUser,
        cargo: JSON.parse(updatedUser.cargo_json || '{}'),
        crew: JSON.parse(updatedUser.crew_json || '[]'),
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message || '술집 이벤트 처리 중 오류 발생' }, 400);
  }
});
