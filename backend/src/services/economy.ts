/**
 * Dynamic Supply-Demand Pricing & Market Execution Service
 * Principle: Planets with abundant stock have strictly lower prices; scarce stock drives prices up.
 */
import { getDb } from '../db/adapter';

export function calculateDynamicPrices(
  basePrice: number,
  stock: number,
  baseStock: number = 500,
  specialtyMultiplier: number = 1.0,
  taxRate: number = 0.03,
  eventMultiplier: number = 1.0
): { buyPrice: number; sellPrice: number } {
  const safeStock = Math.max(10, stock);
  const supplyRatio = Math.pow(baseStock / (safeStock + 40), 0.68);
  const rawMultiplier = Math.min(4.5, Math.max(0.24, supplyRatio * specialtyMultiplier * eventMultiplier));
  const midPrice = basePrice * rawMultiplier;

  const buyPrice = Math.max(5, Math.round(midPrice * (1 + taxRate)));
  const sellPrice = Math.max(3, Math.min(buyPrice - 1, Math.round(midPrice * (1 - taxRate * 0.8))));

  return { buyPrice, sellPrice };
}

export async function runMarketTick(): Promise<void> {
  const db = await getDb();
  const markets = await db.query<{
    planet_id: string;
    resource_id: string;
    stock: number;
    base_stock: number;
    production_rate: number;
    specialty_multiplier: number;
    base_price: number;
    tax_rate: number;
  }>(`
    SELECT pm.*, r.base_price, p.tax_rate
    FROM planet_markets pm
    JOIN resources r ON r.id = pm.resource_id
    JOIN planets p ON p.id = pm.planet_id
  `);

  await db.exec('BEGIN TRANSACTION');
  try {
    for (const m of markets) {
      // Natural drift toward equilibrium + production
      const drift = m.production_rate > 20 ? Math.floor(Math.random() * 18) + 4 : Math.floor(Math.random() * 11) - 5;
      const newStock = Math.max(15, Math.min(3500, m.stock + drift));
      const { buyPrice, sellPrice } = calculateDynamicPrices(
        m.base_price,
        newStock,
        m.base_stock,
        m.specialty_multiplier,
        m.tax_rate
      );

      await db.run(
        `UPDATE planet_markets SET stock = ?, buy_price = ?, sell_price = ? WHERE planet_id = ? AND resource_id = ?`,
        [newStock, buyPrice, sellPrice, m.planet_id, m.resource_id]
      );
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}
