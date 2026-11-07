/**
 * Auto-Scaling Galaxy Service
 * Automatically spawns new planets named after Greek/Roman mythology and Solar System moons
 * as the number of registered users grows.
 */
import { ENV } from '../config/env';
import { getDb } from '../db/adapter';
import { BIOME_COLORS, EXPANSION_PLANET_POOL, INITIAL_RESOURCES } from '../db/seed';
import { calculateDynamicPrices } from './economy';

export async function checkAndExpandGalaxy(forceAddCount: number = 0): Promise<{
  addedPlanets: string[];
  totalUsers: number;
  totalPlanets: number;
}> {
  const db = await getDb();
  const usersCountRow = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users');
  const planetsRows = await db.query<{ id: string; name: string }>('SELECT id, name FROM planets');

  const totalUsers = Number(usersCountRow?.cnt || 1);
  const currentPlanetCount = planetsRows.length;
  const existingNames = new Set(planetsRows.map((p) => p.name));

  // Target planets = INITIAL_PLANET_COUNT (30) + floor(max(0, totalUsers - 1) / PLANET_EXPANSION_USERS_PER_PLANET)
  const desiredByUserCount =
    ENV.INITIAL_PLANET_COUNT +
    Math.floor(Math.max(0, totalUsers - 1) / Math.max(1, ENV.PLANET_EXPANSION_USERS_PER_PLANET));

  const targetCount = forceAddCount > 0 ? currentPlanetCount + forceAddCount : Math.max(currentPlanetCount, desiredByUserCount);
  const toCreate = targetCount - currentPlanetCount;
  const addedPlanets: string[] = [];

  if (toCreate <= 0) {
    return { addedPlanets, totalUsers, totalPlanets: currentPlanetCount };
  }

  const now = new Date().toISOString();

  for (let n = 0; n < toCreate; n++) {
    const idx = currentPlanetCount + n;
    let template = EXPANSION_PLANET_POOL.find((cand) => !existingNames.has(cand.name));

    if (!template) {
      // Procedural mythological/moon nomenclature when pool is exhausted
      const mythPrefixes = ['Hyperion', 'kronos', 'Orpheus', 'Nyx', 'Selene', 'Eos', 'Boreas', 'Zephyrus', 'Vesta', 'Bacchus', 'Caliban', 'Sycorax', 'Prospero', 'Setebos', 'Galatea', 'Despina'];
      const romanNumerals = ['IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'Omega', 'Prime', 'Major'];
      const generatedName = `${mythPrefixes[idx % mythPrefixes.length]} ${romanNumerals[Math.floor(idx / mythPrefixes.length) % romanNumerals.length]}-${idx + 1}`;
      const biomes = ['TERRAN', 'ICE', 'VOLCANIC', 'GAS_MOON', 'DESERT', 'OCEAN', 'JUNGLE', 'CRYSTAL'] as const;
      const chosenBiome = biomes[idx % biomes.length];
      const r1 = INITIAL_RESOURCES[idx % INITIAL_RESOURCES.length].code;
      const r2 = INITIAL_RESOURCES[(idx + 3) % INITIAL_RESOURCES.length].code;
      const s1 = INITIAL_RESOURCES[(idx + 7) % INITIAL_RESOURCES.length].code;

      template = {
        name: generatedName,
        name_ko: `${generatedName} 개척성`,
        origin_category: 'GREEK_MYTH',
        biome: chosenBiome,
        sector: `Outer-Rim-${Math.ceil((idx - 29) / 5)}`,
        abundant_codes: [r1, r2],
        scarce_codes: [s1],
        has_rings: idx % 3 === 0,
        danger_level: (idx % 5) + 1,
        specialty_desc: `사용자 수 증가로 자동 탐색·개척된 심우주 신화/위성 궤도 행성 (${r1}, ${r2} 풍부).`,
      };
    }

    existingNames.add(template.name);
    const planetId = `planet_${idx + 1}`;
    const angle = idx * 0.68;
    const dist = 95 + idx * 27;
    const x = Number((Math.cos(angle) * dist).toFixed(2));
    const z = Number((Math.sin(angle) * dist).toFixed(2));
    const y = Number((((idx % 9) - 4) * 15).toFixed(2));
    const radius = Number((4.5 + (idx % 5) * 1.2).toFixed(2));
    const palette = BIOME_COLORS[template.biome] || BIOME_COLORS.TERRAN;
    const taxRate = Number((0.02 + template.danger_level * 0.005).toFixed(3));

    await db.run(
      `INSERT INTO planets (
        id, name, name_ko, origin_category, biome, sector,
        x, y, z, radius, color_primary, color_secondary, atmosphere_color,
        has_rings, tax_rate, danger_level, has_trading_post, has_repair_shop, has_tavern,
        specialty_desc, is_auto_expanded, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?, 1, ?)`,
      [
        planetId, template.name, template.name_ko, template.origin_category, template.biome, template.sector,
        x, y, z, radius, palette.primary, palette.secondary, palette.atmo,
        template.has_rings ? 1 : 0, taxRate, template.danger_level, template.specialty_desc, now,
      ]
    );

    for (const r of INITIAL_RESOURCES) {
      const isAbundant = template.abundant_codes.includes(r.code);
      const isScarce = template.scarce_codes.includes(r.code);
      const baseStock = 500;
      const stock = isAbundant ? 1400 : isScarce ? 45 : 460;
      const specialtyMult = isAbundant ? 0.56 : isScarce ? 1.7 : 1.0;
      const prodRate = isAbundant ? 32 : isScarce ? 3 : 12;
      const { buyPrice, sellPrice } = calculateDynamicPrices(r.base_price, stock, baseStock, specialtyMult, taxRate);

      await db.run(
        `INSERT INTO planet_markets (
          planet_id, resource_id, stock, base_stock, production_rate, specialty_multiplier, buy_price, sell_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [planetId, r.id, stock, baseStock, prodRate, specialtyMult, buyPrice, sellPrice]
      );
    }

    addedPlanets.push(`${template.name} (${template.name_ko})`);
  }

  return {
    addedPlanets,
    totalUsers,
    totalPlanets: currentPlanetCount + addedPlanets.length,
  };
}
