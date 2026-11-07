import { Hono } from 'hono';
import { formatUserRecord, getDb, recalculateUserWealthAndLevel, WEALTH_LEVEL_THRESHOLDS } from '../db/adapter';
import { calculateDynamicPrices, runMarketTick } from '../services/economy';
import { SHIP_TIERS, triggerTavernEvent } from '../services/events';
import {
  ALL_SECTORS,
  applyItemEffectToUser,
  getPlanetShopAssortment,
  rollPirateLootDrop,
  SHOP_ITEMS,
} from '../services/shop';

export const gameRoutes = new Hono();

async function incrementQuestProgress(userId: string, questType: string, delta: number = 1) {
  const db = await getDb();
  const quests = await db.query<any>('SELECT * FROM quests WHERE quest_type = ? AND active = 1', [questType]);
  const now = new Date().toISOString();

  for (const q of quests) {
    const uq = await db.get<any>(
      'SELECT * FROM user_quests WHERE user_id = ? AND quest_id = ?',
      [userId, q.id]
    );
    const prevProg = Number(uq?.progress || 0);
    const nextProg = Math.min(q.target_amount, prevProg + delta);
    const isComp = nextProg >= q.target_amount ? 1 : 0;

    if (!uq) {
      await db.run(
        `INSERT INTO user_quests (user_id, quest_id, progress, completed, claimed, updated_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [userId, q.id, nextProg, isComp, now]
      );
    } else if (!uq.claimed) {
      await db.run(
        `UPDATE user_quests SET progress = ?, completed = ?, updated_at = ?
         WHERE user_id = ? AND quest_id = ?`,
        [nextProg, isComp, now, userId, q.id]
      );
    }
  }
}

gameRoutes.get('/universe', async (c) => {
  const db = await getDb();
  const planets = await db.query<any>('SELECT * FROM planets ORDER BY created_at ASC, id ASC');
  const resources = await db.query<any>('SELECT * FROM resources');
  const markets = await db.query<any>('SELECT * FROM planet_markets');
  const events = await db.query<any>('SELECT * FROM galaxy_events WHERE active = 1 ORDER BY created_at DESC');
  const pirates = await db.query<any>('SELECT * FROM space_pirates WHERE active = 1 ORDER BY level ASC');
  const quests = await db.query<any>('SELECT * FROM quests WHERE active = 1 ORDER BY min_level ASC');
  const usersCountRow = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users');
  const leaderboard = await db.query<any>(
    'SELECT id, pilot_name, email, ship_name, ship_tier, credits, net_worth, pilot_level, reputation, total_trades, total_mined FROM users ORDER BY net_worth DESC, credits DESC LIMIT 15'
  );

  return c.json({
    planets,
    resources,
    markets,
    events,
    pirates,
    quests,
    levelThresholds: WEALTH_LEVEL_THRESHOLDS,
    shopCatalog: SHOP_ITEMS,
    sectors: ALL_SECTORS,
    totalUsers: Number(usersCountRow?.cnt || 1),
    leaderboard,
  });
});

// Save user settings (language, BGM, SFX) to database
gameRoutes.put('/settings', async (c) => {
  const { userId, settings } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return c.json({ error: 'User not found' }, 404);

  let currentSettings = {};
  try {
    currentSettings = JSON.parse(user.settings_json || '{}');
  } catch {
    // ignore
  }
  const merged = { ...currentSettings, ...(settings || {}) };
  await db.run('UPDATE users SET settings_json = ? WHERE id = ?', [JSON.stringify(merged), userId]);
  const updated = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  return c.json({ user: formatUserRecord(updated), settings: merged });
});

// Multiplayer Real-Time Ship Position Sync & Other Users / Pirates Broadcast
gameRoutes.post('/multiplayer/sync', async (c) => {
  const { userId, x, y, z } = await c.req.json();
  const db = await getDb();
  const nowMs = Date.now();

  if (userId && x !== undefined && y !== undefined && z !== undefined) {
    await db.run(
      'UPDATE users SET ship_x = ?, ship_y = ?, ship_z = ?, last_seen_at = ? WHERE id = ?',
      [Number(x), Number(y), Number(z), nowMs, userId]
    );
  }

  // Gently animate simulated active pilots so the 3D universe is alive with moving ships
  const t = nowMs * 0.0005;
  const allUsers = await db.query<any>(
    'SELECT id, pilot_name, email, ship_name, ship_tier, pilot_level, net_worth, credits, hull, max_hull, current_planet_id, ship_x, ship_y, ship_z, last_seen_at FROM users WHERE id != ? LIMIT 20',
    [userId || '']
  );

  const otherPlayers = allUsers.map((u, idx) => {
    const isSimulated = u.id.startsWith('user_mp_') || u.id.startsWith('sim_user_');
    const orbitRadius = 22 + idx * 14;
    const simX = Number((u.ship_x + Math.cos(t + idx * 1.4) * orbitRadius).toFixed(1));
    const simY = Number((u.ship_y + Math.sin(t * 1.3 + idx) * 4).toFixed(1));
    const simZ = Number((u.ship_z + Math.sin(t + idx * 1.4) * orbitRadius).toFixed(1));
    const isOnline = isSimulated || nowMs - Number(u.last_seen_at || 0) < 120000;

    return {
      id: u.id,
      pilot_name: u.pilot_name,
      ship_name: u.ship_name,
      ship_tier: u.ship_tier,
      pilot_level: Number(u.pilot_level || 1),
      net_worth: Number(u.net_worth || u.credits || 0),
      hull: u.hull,
      max_hull: u.max_hull,
      current_planet_id: u.current_planet_id,
      x: isSimulated ? simX : Number(u.ship_x || 95),
      y: isSimulated ? simY : Number(u.ship_y || 2),
      z: isSimulated ? simZ : Number(u.ship_z || 12),
      isOnline,
    };
  });

  const pirates = await db.query<any>('SELECT * FROM space_pirates WHERE active = 1 ORDER BY level ASC');

  return c.json({
    otherPlayers,
    pirates,
  });
});

// Space Hazard & Collision Damage (Solar Wind, Planet Fragment/Asteroid, Space Debris, Player Ship Collision)
gameRoutes.post('/hazard-hit', async (c) => {
  const { userId, hazardType, colliderName } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return c.json({ error: 'User not found' }, 404);

  let rawDmg = 14;
  let creditPenalty = 0;
  let msg = '';

  if (hazardType === 'SOLAR_WIND') {
    rawDmg = Math.max(6, Math.round(18 / Math.max(1, user.shield_level * 0.6)));
    msg = `☀️ [태양풍 플라즈마 폭풍 피격!] 고에너지 입자 폭풍에 휩쓸려 선체 내구도가 -${rawDmg} 손상되었습니다!`;
  } else if (hazardType === 'ASTEROID_FRAGMENT') {
    rawDmg = Math.max(8, Math.round(24 / Math.max(1, user.shield_level * 0.5)));
    msg = `☄️ [행성 조각 충돌!] 고속 회전하는 암석 파편과 정면 충돌하여 선체가 -${rawDmg} 파손되었습니다!`;
  } else if (hazardType === 'SPACE_DEBRIS') {
    rawDmg = Math.max(5, Math.round(15 / Math.max(1, user.shield_level * 0.6)));
    msg = `🛰️ [우주 쓰레기 충돌!] 폐기된 위성 잔해에 부딪혀 선체가 -${rawDmg} 손상되었습니다!`;
  } else if (hazardType === 'PLAYER_COLLISION') {
    rawDmg = Math.max(10, Math.round(26 / Math.max(1, user.shield_level * 0.5)));
    creditPenalty = Math.min(user.credits, 350);
    msg = `💥 [타 유저 함선 접촉 사고!] '${colliderName || 'Other Pilot'}' 함선과 운전 미숙으로 충돌하여 선체 -${rawDmg} 파손 및 과실 배상금 -${creditPenalty} CR이 차감되었습니다!`;
  } else {
    rawDmg = 10;
    msg = `⚠️ [항해 충격 발생] 우주 장애물과 충돌하여 선체가 -${rawDmg} 손상되었습니다.`;
  }

  let nextHull = user.hull - rawDmg;
  if (nextHull <= 5) {
    // Emergency rescue tow penalty if hull drops critically low
    const rescueFee = Math.min(user.credits, 800);
    creditPenalty += rescueFee;
    nextHull = Math.round(user.max_hull * 0.4);
    msg += ` 🚨 [선체 대파 긴급 인양!] 구조선 인양 비용 -${rescueFee} CR 지불 후 선체 40% 응급 복구!`;
  }

  await db.run(
    'UPDATE users SET hull = ?, credits = MAX(0, credits - ?) WHERE id = ?',
    [nextHull, creditPenalty, userId]
  );

  const levelInfo = await recalculateUserWealthAndLevel(userId);
  const updated = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

  return c.json({
    user: formatUserRecord(updated),
    damage: rawDmg,
    creditPenalty,
    levelChanged: levelInfo.pilotLevel !== levelInfo.prevLevel,
    newLevel: levelInfo.pilotLevel,
    message: msg,
  });
});

// Space Pirate Combat (Solo & Multi-User Co-op Joint Attack + Pirate-Exclusive Loot Drops!)
gameRoutes.post('/combat/pirate', async (c) => {
  const { userId, pirateId, allyUserIds = [] } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const pirate = await db.get<any>('SELECT * FROM space_pirates WHERE id = ?', [pirateId]);

  if (!user || !pirate) return c.json({ error: '전투 대상을 찾을 수 없습니다.' }, 404);

  // Calculate player's combat power + Co-op allies' combat power
  const playerPower =
    Number(user.pilot_level || 1) * 22 +
    Number(user.mining_laser_level || 1) * 18 +
    Number(user.shield_level || 1) * 14 +
    Number(user.ship_tier || 1) * 25;

  let allyPower = 0;
  const allyNames: string[] = [];
  if (Array.isArray(allyUserIds) && allyUserIds.length > 0) {
    for (const aId of allyUserIds.slice(0, 3)) {
      const ally = await db.get<any>('SELECT * FROM users WHERE id = ?', [aId]);
      if (ally) {
        allyPower += Number(ally.pilot_level || 1) * 24 + Number(ally.ship_tier || 1) * 22 + 30;
        allyNames.push(ally.pilot_name);
      }
    }
  }

  const totalAttackDamage = Math.round((playerPower + allyPower) * (0.85 + Math.random() * 0.35));
  const coOpDefenseFactor = 1 + allyNames.length * 0.55;
  const pirateCounterDamage = Math.max(
    4,
    Math.round((pirate.attack * (pirate.level > user.pilot_level && allyNames.length === 0 ? 1.65 : 0.9)) / (Math.max(1, user.shield_level * 0.55) * coOpDefenseFactor))
  );

  const nextPirateHp = Math.max(0, pirate.hp - totalAttackDamage);
  let nextUserHull = Math.max(5, user.hull - pirateCounterDamage);

  // If pirate is higher level and player attacked solo and got heavily damaged
  if (nextUserHull <= 8 && nextPirateHp > 0) {
    const lossCredits = Math.min(user.credits, Math.round(pirate.level * 450));
    await db.run(
      'UPDATE users SET hull = ?, credits = MAX(0, credits - ?) WHERE id = ?',
      [Math.round(user.max_hull * 0.35), lossCredits, userId]
    );
    const lvInfo = await recalculateUserWealthAndLevel(userId);
    const defeatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    return c.json({
      user: formatUserRecord(defeatedUser),
      pirate,
      victory: false,
      defeated: true,
      playerDamageDealt: totalAttackDamage,
      pirateDamageDealt: pirateCounterDamage,
      levelInfo: lvInfo,
      message: `💀 [전투 패배 및 약탈 피해!] Lv.${pirate.level} '${pirate.name_ko}'의 막강한 화력에 밀려 -${lossCredits.toLocaleString()} CR을 약탈당했습니다! 자신보다 높은 레벨의 해적은 친구/다른 유저와 [협동 공격]으로 공략하세요!`,
    });
  }

  if (nextPirateHp <= 0) {
    // VICTORY! Award bounty credits + Roll Pirate-Exclusive Loot Drop!
    const bounty = pirate.reward_credits;
    const lootItem = rollPirateLootDrop(pirate.level);

    await db.run(
      'UPDATE users SET credits = credits + ?, hull = ?, reputation = reputation + ? WHERE id = ?',
      [bounty, nextUserHull, pirate.level * 5, userId]
    );

    const userBeforeLoot = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    const { effectMessage } = await applyItemEffectToUser(userBeforeLoot, lootItem, true);

    // Respawn pirate with full HP at a slightly shifted position so other players/raids can fight again
    await db.run(
      'UPDATE space_pirates SET hp = max_hp, x = x + ?, z = z + ? WHERE id = ?',
      [Math.round((Math.random() - 0.5) * 30), Math.round((Math.random() - 0.5) * 30), pirate.id]
    );

    await incrementQuestProgress(userId, 'KILL_PIRATE', 1);
    const lvInfo = await recalculateUserWealthAndLevel(userId);
    const finalUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    const refreshedPirate = await db.get<any>('SELECT * FROM space_pirates WHERE id = ?', [pirate.id]);

    const coopText = allyNames.length > 0 ? `[🤝 ${allyNames.join(', ')} 협동 격파!]` : `[⚔️ 단독 격파!]`;
    return c.json({
      user: formatUserRecord(finalUser),
      pirate: refreshedPirate,
      victory: true,
      lootItem,
      bounty,
      playerDamageDealt: totalAttackDamage,
      pirateDamageDealt: pirateCounterDamage,
      levelInfo: lvInfo,
      message: `🏆 ${coopText} Lv.${pirate.level} '${pirate.name_ko}' 격추! 현상금 +${bounty.toLocaleString()} CR & 전리품 [${lootItem.name_ko}] 획득! (${effectMessage})`,
    });
  }

  // Ongoing battle round
  await db.run('UPDATE space_pirates SET hp = ? WHERE id = ?', [nextPirateHp, pirate.id]);
  await db.run('UPDATE users SET hull = ? WHERE id = ?', [nextUserHull, userId]);
  const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const updatedPirate = await db.get<any>('SELECT * FROM space_pirates WHERE id = ?', [pirate.id]);

  return c.json({
    user: formatUserRecord(updatedUser),
    pirate: updatedPirate,
    victory: false,
    playerDamageDealt: totalAttackDamage,
    pirateDamageDealt: pirateCounterDamage,
    message: `💥 [교전 중] '${pirate.name_ko}'에게 ${totalAttackDamage} 피해 타격! (남은 적 HP: ${nextPirateHp}/${pirate.max_hp}, 아군 선체 피해 -${pirateCounterDamage})`,
  });
});

// PvP Skirmish with another Pilot
gameRoutes.post('/combat/pvp', async (c) => {
  const { userId, targetUserId } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const target = await db.get<any>('SELECT * FROM users WHERE id = ?', [targetUserId]);
  if (!user || !target) return c.json({ error: '대상을 찾을 수 없습니다.' }, 404);

  const myScore = (user.pilot_level || 1) * 20 + user.mining_laser_level * 15 + user.shield_level * 15 + Math.random() * 25;
  const oppScore = (target.pilot_level || 1) * 18 + target.mining_laser_level * 14 + target.shield_level * 14 + Math.random() * 25;
  const win = myScore >= oppScore;

  if (win) {
    const plunder = Math.min(target.credits, Math.max(600, Math.round(target.pilot_level * 700)));
    const hullDmg = Math.max(5, Math.round(14 / Math.max(1, user.shield_level * 0.5)));
    await db.run('UPDATE users SET credits = credits + ?, hull = MAX(10, hull - ?) WHERE id = ?', [plunder, hullDmg, userId]);
    const lvInfo = await recalculateUserWealthAndLevel(userId);
    const updated = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    return c.json({
      user: formatUserRecord(updated),
      victory: true,
      levelInfo: lvInfo,
      message: `⚔️ [PvP 함대 교전 승리!] '${target.pilot_name}'(Lv.${target.pilot_level}) 함선을 제압하고 전리품 +${plunder.toLocaleString()} CR을 획득했습니다!`,
    });
  } else {
    const loss = Math.min(user.credits, Math.max(400, Math.round(user.pilot_level * 450)));
    const hullDmg = Math.max(10, Math.round(22 / Math.max(1, user.shield_level * 0.5)));
    await db.run('UPDATE users SET credits = MAX(0, credits - ?), hull = MAX(10, hull - ?) WHERE id = ?', [loss, hullDmg, userId]);
    const lvInfo = await recalculateUserWealthAndLevel(userId);
    const updated = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    return c.json({
      user: formatUserRecord(updated),
      victory: false,
      levelInfo: lvInfo,
      message: `💥 [PvP 교전 후퇴] '${target.pilot_name}'(Lv.${target.pilot_level})의 반격으로 선체 -${hullDmg} 손상 및 -${loss.toLocaleString()} CR 손실을 입었습니다.`,
    });
  }
});

// Friend System — List Friends, Pending Requests & All Pilots
gameRoutes.get('/friends/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = await getDb();
  const nowMs = Date.now();

  const friendships = await db.query<any>(
    'SELECT * FROM friendships WHERE requester_id = ? OR addressee_id = ?',
    [userId, userId]
  );
  const allPilots = await db.query<any>(
    'SELECT id, pilot_name, email, ship_name, ship_tier, pilot_level, net_worth, credits, current_planet_id, last_seen_at FROM users WHERE id != ? ORDER BY pilot_level DESC',
    [userId]
  );

  const friends: any[] = [];
  const incomingRequests: any[] = [];
  const outgoingRequests: any[] = [];
  const relatedIds = new Set<string>();

  for (const f of friendships) {
    const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id;
    const otherUser = allPilots.find((p) => p.id === otherId);
    if (!otherUser) continue;
    relatedIds.add(otherId);

    const isSim = otherUser.id.startsWith('user_mp_') || otherUser.id.startsWith('sim_user_');
    const isOnline = isSim || nowMs - Number(otherUser.last_seen_at || 0) < 120000;
    const enriched = { ...otherUser, friendshipId: f.id, status: f.status, isOnline };

    if (f.status === 'ACCEPTED') {
      friends.push(enriched);
    } else if (f.addressee_id === userId) {
      incomingRequests.push(enriched);
    } else {
      outgoingRequests.push(enriched);
    }
  }

  const discoverPilots = allPilots
    .filter((p) => !relatedIds.has(p.id))
    .map((p) => ({
      ...p,
      isOnline: p.id.startsWith('user_mp_') || p.id.startsWith('sim_user_') || nowMs - Number(p.last_seen_at || 0) < 120000,
    }));

  return c.json({
    friends,
    incomingRequests,
    outgoingRequests,
    discoverPilots,
  });
});

// Send Friend Request (Simulated pilots auto-accept or create pending requests so player can test both!)
gameRoutes.post('/friends/request', async (c) => {
  const { requesterId, addresseeId, autoAccept } = await c.req.json();
  const db = await getDb();
  const existing = await db.get<any>(
    'SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)',
    [requesterId, addresseeId, addresseeId, requesterId]
  );
  if (existing) {
    return c.json({ error: '이미 친구 요청을 보냈거나 등록된 파일럿입니다.' }, 400);
  }

  const id = `fr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const status = autoAccept ? 'ACCEPTED' : 'PENDING';
  await db.run(
    'INSERT INTO friendships (id, requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, requesterId, addresseeId, status, new Date().toISOString()]
  );

  return c.json({
    friendshipId: id,
    status,
    message: status === 'ACCEPTED' ? '🤝 친구 등록이 완료되었습니다!' : '📩 친구 요청을 전송했습니다! (수락 대기 중)',
  });
});

// Accept or Reject Friend Request
gameRoutes.post('/friends/respond', async (c) => {
  const { friendshipId, action } = await c.req.json();
  const db = await getDb();
  if (action === 'ACCEPT') {
    await db.run(`UPDATE friendships SET status = 'ACCEPTED' WHERE id = ?`, [friendshipId]);
    return c.json({ message: '🤝 친구 요청을 수락했습니다! 이제 친구 목록에서 접속 상태를 확인하고 협동 공격이 가능합니다.' });
  } else {
    await db.run(`DELETE FROM friendships WHERE id = ?`, [friendshipId]);
    return c.json({ message: '친구 요청을 거절/해제했습니다.' });
  }
});

// Quests — Get Quests & Player Progress
gameRoutes.get('/quests/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = await getDb();
  const quests = await db.query<any>('SELECT * FROM quests WHERE active = 1 ORDER BY min_level ASC, created_at ASC');
  const userQuests = await db.query<any>('SELECT * FROM user_quests WHERE user_id = ?', [userId]);
  const uqMap = new Map<string, any>(userQuests.map((uq) => [uq.quest_id, uq]));

  const result = quests.map((q) => {
    const uq = uqMap.get(q.id);
    return {
      ...q,
      progress: Number(uq?.progress || 0),
      completed: Boolean(uq?.completed),
      claimed: Boolean(uq?.claimed),
    };
  });

  return c.json({ quests: result });
});

// Claim Completed Quest Reward
gameRoutes.post('/quests/claim', async (c) => {
  const { userId, questId } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const quest = await db.get<any>('SELECT * FROM quests WHERE id = ?', [questId]);
  const uq = await db.get<any>('SELECT * FROM user_quests WHERE user_id = ? AND quest_id = ?', [userId, questId]);

  if (!user || !quest) return c.json({ error: '퀘스트를 찾을 수 없습니다.' }, 404);
  if ((user.pilot_level || 1) < quest.min_level) {
    return c.json({ error: `현재 자산 레벨(Lv.${user.pilot_level})이 퀘스트 요구 레벨(Lv.${quest.min_level})보다 낮습니다.` }, 400);
  }
  if (!uq || !uq.completed) {
    return c.json({ error: '아직 퀘스트 목표 수량을 달성하지 못했습니다.' }, 400);
  }
  if (uq.claimed) {
    return c.json({ error: '이미 보상을 수령한 퀘스트입니다.' }, 400);
  }

  await db.run('UPDATE user_quests SET claimed = 1 WHERE user_id = ? AND quest_id = ?', [userId, questId]);
  await db.run(
    'UPDATE users SET credits = credits + ?, warp_tickets = warp_tickets + ?, reputation = reputation + 15 WHERE id = ?',
    [quest.reward_credits, quest.reward_warp_tickets || 0, userId]
  );

  const lvInfo = await recalculateUserWealthAndLevel(userId);
  const updated = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

  return c.json({
    user: formatUserRecord(updated),
    levelInfo: lvInfo,
    message: `🎉 [퀘스트 완료 보상 수령!] +${quest.reward_credits.toLocaleString()} CR ${
      quest.reward_warp_tickets > 0 ? `& 초공간 워프 셀 +${quest.reward_warp_tickets}개` : ''
    } 획득!`,
  });
});

// Get planet-specific shop items
gameRoutes.get('/shop/:planetId', async (c) => {
  const planetId = c.req.param('planetId');
  const db = await getDb();
  const planet = await db.get<any>('SELECT * FROM planets WHERE id = ?', [planetId]);
  if (!planet) return c.json({ error: '행성을 찾을 수 없습니다.' }, 404);

  const items = getPlanetShopAssortment(planet);
  return c.json({
    planetId: planet.id,
    planetName: planet.name_ko,
    sector: planet.sector,
    biome: planet.biome,
    items,
  });
});

// Buy item at planetary shop
gameRoutes.post('/shop/buy', async (c) => {
  const { userId, planetId, itemId } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const planet = await db.get<any>('SELECT * FROM planets WHERE id = ?', [planetId || user?.current_planet_id]);

  if (!user || !planet) {
    return c.json({ error: '사용자 또는 행성 정보를 찾을 수 없습니다.' }, 404);
  }

  const assortment = getPlanetShopAssortment(planet);
  const shopEntry = assortment.find((it) => it.id === itemId);
  if (!shopEntry) {
    return c.json({ error: `이 행성 상점에서는 해당 품목(${itemId})을 판매하지 않습니다.` }, 400);
  }

  if (user.credits < shopEntry.planet_price) {
    return c.json({
      error: `크레딧이 부족합니다! (필요: ${shopEntry.planet_price.toLocaleString()} CR, 보유: ${user.credits.toLocaleString()} CR)`,
    }, 400);
  }

  await db.run('UPDATE users SET credits = credits - ? WHERE id = ?', [shopEntry.planet_price, userId]);
  const updatedBeforeEffect = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const { effectMessage } = await applyItemEffectToUser(updatedBeforeEffect, shopEntry, true);
  await recalculateUserWealthAndLevel(userId);
  const finalUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

  return c.json({
    user: formatUserRecord(finalUser),
    item: shopEntry,
    paidPrice: shopEntry.planet_price,
    message: `[상점 구매 완료] '${shopEntry.name_ko}' 구매 (-${shopEntry.planet_price.toLocaleString()} CR) · ${effectMessage}`,
  });
});

// Emergency In-Flight Map Purchase (10x Shop Base Price, Max 3 Times!)
gameRoutes.post('/shop/emergency-map', async (c) => {
  const { userId, sector } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

  const usedCount = Number(user.emergency_map_used || 0);
  const maxLimit = 3;
  if (usedCount >= maxLimit) {
    return c.json({
      error: `🚨 긴급 우주지도 위성 구매 횟수(최대 ${maxLimit}회)를 모두 소진했습니다! 행성 상점에 착륙하여 정가로 구매하세요.`,
    }, 400);
  }

  const mapItem =
    SHOP_ITEMS.find((it) => it.category === 'MAP' && it.target_sector === sector) ||
    SHOP_ITEMS.find((it) => it.id === 'map_core_alpha')!;

  const emergencyPrice = mapItem.emergency_price || mapItem.base_price * 10;
  if (user.credits < emergencyPrice) {
    return c.json({
      error: `긴급 성도 수신 비용(상점 정가의 10배: ${emergencyPrice.toLocaleString()} CR)이 부족합니다!`,
    }, 400);
  }

  await db.run(
    'UPDATE users SET credits = credits - ?, emergency_map_used = emergency_map_used + 1 WHERE id = ?',
    [emergencyPrice, userId]
  );

  const updatedBeforeEffect = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const { effectMessage } = await applyItemEffectToUser(updatedBeforeEffect, mapItem, true);
  await recalculateUserWealthAndLevel(userId);
  const finalUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

  return c.json({
    user: formatUserRecord(finalUser),
    paidPrice: emergencyPrice,
    remainingEmergencyBuys: maxLimit - (usedCount + 1),
    message: `🚨 [긴급 항해 성도 구매 (${usedCount + 1}/${maxLimit}회)] 상점가 10배(${emergencyPrice.toLocaleString()} CR) 지불 · ${effectMessage}`,
  });
});

// Re-activate / Use consumable or map from inventory
gameRoutes.post('/shop/use', async (c) => {
  const { userId, itemId } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

  const inventory: Record<string, number> = JSON.parse(user.inventory_json || '{}');
  if (!inventory[itemId] || inventory[itemId] <= 0) {
    return c.json({ error: '보유 중인 아이템이 아닙니다.' }, 400);
  }

  const spec = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!spec) return c.json({ error: '아이템 정보를 찾을 수 없습니다.' }, 404);

  if (spec.category === 'CONSUMABLE') {
    inventory[itemId] -= 1;
    if (inventory[itemId] <= 0) delete inventory[itemId];
    await db.run('UPDATE users SET inventory_json = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
    const refreshed = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    const { effectMessage } = await applyItemEffectToUser(refreshed, spec, false);
    const finalUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    return c.json({
      user: formatUserRecord(finalUser),
      message: `[소모품 사용] ${effectMessage}`,
    });
  }

  return c.json({
    user: formatUserRecord(user),
    message: `'${spec.name_ko}' 아이템 효과는 이미 함선에 영구/활성 적용되어 있습니다.`,
  });
});

// Start AI Autopilot Agent Flight (consumes 1 ai_agent_uses charge — much cheaper than Warp!)
gameRoutes.post('/ai-autopilot', async (c) => {
  const { userId, targetPlanetId } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const toPlanet = await db.get<any>('SELECT * FROM planets WHERE id = ?', [targetPlanetId]);
  if (!user || !toPlanet) return c.json({ error: '항법 대상을 찾을 수 없습니다.' }, 404);

  if (Number(user.ai_agent_uses || 0) <= 0) {
    return c.json({
      error: `🤖 보유 중인 'AI 항법 에이전트' 잔여 횟수가 없습니다! 상점에서 워프보다 저렴한 'AI 항법 에이전트(3회권 1,200 CR)'를 구매하세요.`,
    }, 400);
  }

  await db.run('UPDATE users SET ai_agent_uses = MAX(0, ai_agent_uses - 1) WHERE id = ?', [userId]);
  const updated = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

  return c.json({
    user: formatUserRecord(updated),
    targetPlanet: toPlanet,
    message: `🤖 [AI 자율운행 에이전트 가동] '${toPlanet.name_ko}' 궤도까지 소행성 파편과 태양풍을 자동 회피하며 자율 운항을 시작합니다! (잔여 AI 횟수: ${updated.ai_agent_uses}회)`,
  });
});

// Direct Manual / AI Autopilot Orbital Docking
gameRoutes.post('/dock', async (c) => {
  const { userId, targetPlanetId } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const toPlanet = await db.get<any>('SELECT * FROM planets WHERE id = ?', [targetPlanetId]);

  if (!user || !toPlanet) return c.json({ error: '궤도 진입 대상 행성을 찾을 수 없습니다.' }, 404);

  const dockFuelCost = user.current_planet_id === targetPlanetId ? 0 : 2;
  const newFuel = Math.max(0, user.fuel - dockFuelCost);

  await db.run(
    'UPDATE users SET current_planet_id = ?, fuel = ?, ship_x = ?, ship_y = ?, ship_z = ? WHERE id = ?',
    [targetPlanetId, newFuel, toPlanet.x + toPlanet.radius * 2.2, toPlanet.y + 2, toPlanet.z + toPlanet.radius * 2.2, userId]
  );

  await incrementQuestProgress(userId, 'VISIT_PLANET', 1);
  await runMarketTick();
  const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

  return c.json({
    user: formatUserRecord(updatedUser),
    fuelCost: dockFuelCost,
    message: `🛸 [궤도 도킹 성공] ${toPlanet.name_ko}(${toPlanet.name}) 정지 궤도에 안전하게 착륙했습니다! (연료 -${dockFuelCost})`,
  });
});

// Hyperspace Warp — Requires Expensive Warp Jump Cell (warp_tickets > 0) AND Fuel!
gameRoutes.post('/warp', async (c) => {
  const { userId, targetPlanetId } = await c.req.json();
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const fromPlanet = await db.get<any>('SELECT * FROM planets WHERE id = ?', [user?.current_planet_id]);
  const toPlanet = await db.get<any>('SELECT * FROM planets WHERE id = ?', [targetPlanetId]);

  if (!user || !toPlanet) return c.json({ error: '항법 대상을 찾을 수 없습니다.' }, 404);

  if (Number(user.warp_tickets || 0) <= 0) {
    return c.json({
      error: `⚡ 보유한 '초공간 워프 점프 셀'이 없습니다! 상점에서 돈을 모아 워프 점프 셀(4,500 CR)을 구매하거나, 워프보다 저렴한 'AI 항법 에이전트' 또는 '직접 운행(WASD)'을 이용하세요.`,
    }, 400);
  }

  const dx = toPlanet.x - (fromPlanet?.x || 0);
  const dy = toPlanet.y - (fromPlanet?.y || 0);
  const dz = toPlanet.z - (fromPlanet?.z || 0);
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const fuelCost = Math.max(4, Math.round((dist / 28) * Math.max(0.45, 1 - (user.warp_drive_level - 1) * 0.12)));

  if (user.fuel < fuelCost) {
    return c.json({ error: `워프 연료가 부족합니다. (필요: ${fuelCost}, 현재: ${user.fuel})` }, 400);
  }

  const newFuel = Math.max(0, user.fuel - fuelCost);

  await db.run(
    'UPDATE users SET current_planet_id = ?, fuel = ?, warp_tickets = MAX(0, warp_tickets - 1), ship_x = ?, ship_y = ?, ship_z = ? WHERE id = ?',
    [targetPlanetId, newFuel, toPlanet.x + toPlanet.radius * 2.2, toPlanet.y + 2, toPlanet.z + toPlanet.radius * 2.2, userId]
  );

  await incrementQuestProgress(userId, 'VISIT_PLANET', 1);
  await runMarketTick();
  const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

  return c.json({
    user: formatUserRecord(updatedUser),
    fuelCost,
    hullDamage: 0,
    message: `⚡ [초공간 워프 완료] 워프 셀 1개를 소모하여 위험 지대(태양풍·소행성·해적)를 건너뛰고 ${toPlanet.name_ko}(${toPlanet.name}) 궤도에 즉시 진입했습니다! (잔여 워프 셀: ${updatedUser.warp_tickets}개)`,
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
    return c.json({ error: '화물칸이 가득 찼습니다! 교역소에서 매도하거나 수리점/상점에서 화물칸을 확장하세요.' }, 400);
  }

  const rawYield = Math.max(1, Math.round((2 + user.mining_laser_level * 2) * comboBonus));
  const actualYield = Math.min(rawYield, user.cargo_capacity - usedCargo);
  cargo[resourceId] = (cargo[resourceId] || 0) + actualYield;

  await db.run(
    'UPDATE users SET cargo_json = ?, total_mined = total_mined + ?, fuel = MAX(0, fuel - 2) WHERE id = ?',
    [JSON.stringify(cargo), actualYield, userId]
  );

  await incrementQuestProgress(userId, 'MINE', actualYield);
  const lvInfo = await recalculateUserWealthAndLevel(userId);
  const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

  return c.json({
    user: formatUserRecord(updatedUser),
    minedAmount: actualYield,
    resourceName: res.name_ko,
    levelInfo: lvInfo,
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

  await incrementQuestProgress(userId, 'TRADE', qty);
  const lvInfo = await recalculateUserWealthAndLevel(userId);
  const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  const updatedMarket = await db.get<any>(
    'SELECT * FROM planet_markets WHERE planet_id = ? AND resource_id = ?',
    [planetId, resourceId]
  );

  return c.json({
    user: formatUserRecord(updatedUser),
    market: updatedMarket,
    levelInfo: lvInfo,
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

  const lvInfo = await recalculateUserWealthAndLevel(userId);
  const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  return c.json({
    user: formatUserRecord(updatedUser),
    levelInfo: lvInfo,
  });
});

gameRoutes.post('/tavern', async (c) => {
  const { userId, actionType, wager } = await c.req.json();
  try {
    const result = await triggerTavernEvent(userId, actionType, wager);
    const lvInfo = await recalculateUserWealthAndLevel(userId);
    const db = await getDb();
    const updatedUser = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    return c.json({
      ...result,
      levelInfo: lvInfo,
      user: formatUserRecord(updatedUser),
    });
  } catch (err: any) {
    return c.json({ error: err.message || '술집 이벤트 처리 중 오류 발생' }, 400);
  }
});
