/**
 * Repair Shop, Shipyard Upgrades, and Space Tavern Events Service
 */
import { getDb } from '../db/adapter';
import { calculateDynamicPrices } from './economy';

export const SHIP_TIERS = [
  { tier: 1, name: 'Aegis Scout MK-I', cargo: 60, maxHull: 100, maxFuel: 100, cost: 0 },
  { tier: 2, name: 'Hermes Freighter MK-II', cargo: 140, maxHull: 180, maxFuel: 160, cost: 35000 },
  { tier: 3, name: 'Olympus Corvette MK-III', cargo: 260, maxHull: 280, maxFuel: 240, cost: 95000 },
  { tier: 4, name: 'Titan Dreadnought MK-IV', cargo: 450, maxHull: 420, maxFuel: 350, cost: 240000 },
  { tier: 5, name: 'Chronos Leviathan MK-V', cargo: 800, maxHull: 650, maxFuel: 500, cost: 600000 },
];

export async function triggerTavernEvent(
  userId: string,
  actionType: 'RUMOR' | 'GAMBLE' | 'HIRE_CREW' | 'RANDOM_DRINK',
  wager: number = 1000
): Promise<{ message: string; deltaCredits: number; rumorPlanetId?: string }> {
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) throw new Error('User not found');

  if (actionType === 'RUMOR') {
    const cost = 600;
    if (user.credits < cost) throw new Error('정보원에게 지불할 크레딧(600 CR)이 부족합니다.');
    const planets = await db.query<any>('SELECT id, name, name_ko FROM planets');
    const resources = await db.query<any>('SELECT id, name_ko, base_price FROM resources');
    const targetPlanet = planets[Math.floor(Math.random() * planets.length)];
    const targetRes = resources[Math.floor(Math.random() * resources.length)];
    const isShortage = Math.random() > 0.45;

    const newStock = isShortage ? 20 : 1850;
    const mult = isShortage ? 2.1 : 0.45;
    const { buyPrice, sellPrice } = calculateDynamicPrices(targetRes.base_price, newStock, 500, mult, 0.03);

    await db.run(
      `UPDATE planet_markets SET stock = ?, specialty_multiplier = ?, buy_price = ?, sell_price = ?
       WHERE planet_id = ? AND resource_id = ?`,
      [newStock, mult, buyPrice, sellPrice, targetPlanet.id, targetRes.id]
    );
    await db.run('UPDATE users SET credits = credits - ? WHERE id = ?', [cost, userId]);

    const msg = isShortage
      ? `[주점 극비 루머] ${targetPlanet.name_ko}(${targetPlanet.name})에서 '${targetRes.name_ko}' 품귀 사태 발생! 매도가가 ${sellPrice.toLocaleString()} CR까지 폭등했습니다!`
      : `[주점 특급 루머] ${targetPlanet.name_ko}(${targetPlanet.name})에서 '${targetRes.name_ko}' 대량 광맥 터짐! 매수가가 ${buyPrice.toLocaleString()} CR로 폭락했습니다!`;

    return { message: msg, deltaCredits: -cost, rumorPlanetId: targetPlanet.id };
  }

  if (actionType === 'GAMBLE') {
    const safeWager = Math.max(200, Math.min(user.credits, wager));
    if (user.credits < safeWager) throw new Error('베팅할 크레딧이 부족합니다.');
    const roll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
    let delta = -safeWager;
    let msg = `[퀀텀 다이스] 주사위 합 ${roll}! 아쉽게도 ${safeWager.toLocaleString()} CR을 잃었습니다.`;

    if (roll === 12) {
      delta = safeWager * 3;
      msg = `[퀀텀 다이스 잭팟!] 주사위 합 12 (더블 식스)! ${delta.toLocaleString()} CR을 획득했습니다!`;
    } else if (roll >= 8) {
      delta = safeWager;
      msg = `[퀀텀 다이스 승리!] 주사위 합 ${roll}! +${delta.toLocaleString()} CR 수익을 올렸습니다!`;
    }

    await db.run('UPDATE users SET credits = credits + ? WHERE id = ?', [delta, userId]);
    return { message: msg, deltaCredits: delta };
  }

  if (actionType === 'HIRE_CREW') {
    const cost = 3500;
    if (user.credits < cost) throw new Error('베테랑 항해사/엔지니어 영입 비용(3,500 CR)이 부족합니다.');
    const crewList = JSON.parse(user.crew_json || '[]');
    const pool = ['항해사 카산드라 (워프 연료 -15%)', '수석 엔지니어 헤파이스토스 (채굴량 +25%)', '무역 브로커 머큐리 (매도가 +8%)', '전술관 아레스 (해적 방어 +35%)'];
    const hired = pool[crewList.length % pool.length];
    crewList.push(hired);
    await db.run('UPDATE users SET credits = credits - ?, crew_json = ? WHERE id = ?', [cost, JSON.stringify(crewList), userId]);
    return { message: `[선원 영입] '${hired}'가 함선에 합류했습니다!`, deltaCredits: -cost };
  }

  // RANDOM_DRINK: Space Tavern random encounter
  const drinkCost = 250;
  const roll = Math.random();
  if (roll < 0.35) {
    const reward = 2400;
    await db.run('UPDATE users SET credits = credits + ? WHERE id = ?', [reward - drinkCost, userId]);
    return {
      message: `[술집 이벤트] 은퇴한 광부 노인이 술값에 보답하며 고대 소행성 좌표 칩(+${reward.toLocaleString()} CR 가치)을 건넸습니다!`,
      deltaCredits: reward - drinkCost,
    };
  } else if (roll < 0.7) {
    await db.run('UPDATE users SET hull = max_hull, fuel = max_fuel, credits = credits - ? WHERE id = ?', [drinkCost, userId]);
    return {
      message: `[술집 이벤트] 정비소 기술자들과 의기투합하여 무료로 선체 완전 수리 및 연료 완충 서비스를 받았습니다!`,
      deltaCredits: -drinkCost,
    };
  } else {
    const loss = 500;
    await db.run('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?', [loss, userId]);
    return {
      message: `[술집 해프닝] 외계 밀수꾼들과 시비가 붙어 테이블 파손 배상금 500 CR을 지불했습니다.`,
      deltaCredits: -loss,
    };
  }
}
