<script lang="ts">
  import { gameStore, fetchUniverse, addGameLog, API_BASE } from '../stores/gameStore';

  $: state = $gameStore;
  $: currentPlanet = state.planets.find((p) => p.id === state.user?.current_planet_id) || state.planets[0];
  $: markets = state.markets.filter((m) => m.planet_id === currentPlanet?.id);

  async function executeTrade(resourceId: string, type: 'BUY' | 'SELL', quantity: number) {
    if (!state.user || !currentPlanet) return;
    const res = await fetch(`${API_BASE}/game/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.user.id,
        planetId: currentPlanet.id,
        resourceId,
        type,
        quantity,
      }),
    });
    const data = await res.json();
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      await fetchUniverse();
      addGameLog(`[교역 체결] ${type === 'BUY' ? '매수' : '매도'} ${quantity}단위 완료`);
    }
  }
</script>

<div class="p-6 bg-slate-900/95 border border-cyan-500/40 rounded-2xl max-w-4xl w-full">
  <h2 class="text-xl font-bold text-cyan-300 mb-2">🏛️ {currentPlanet?.name_ko} 성간 교역소</h2>
  <p class="text-xs text-slate-400 mb-4">{currentPlanet?.specialty_desc}</p>
  <div class="space-y-2 max-h-96 overflow-y-auto">
    {#each markets as m}
      {@const res = state.resources.find((r) => r.id === m.resource_id)}
      {#if res}
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700">
          <div>
            <div class="font-semibold text-sm text-white">{res.name_ko} <span class="text-xs text-slate-400">({res.code})</span></div>
            <div class="text-xs text-slate-400">행성 재고: <strong class="text-cyan-300">{m.stock}</strong> (기준가 {res.base_price} CR)</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-emerald-400">매수가 {m.buy_price} CR</span>
            <span class="text-xs text-amber-400">매도가 {m.sell_price} CR</span>
            <button on:click={() => executeTrade(res.id, 'BUY', 5)} class="px-3 py-1 rounded bg-emerald-600 text-xs font-bold">+5 매수</button>
            <button on:click={() => executeTrade(res.id, 'SELL', 5)} class="px-3 py-1 rounded bg-amber-600 text-xs font-bold">-5 매도</button>
          </div>
        </div>
      {/if}
    {/each}
  </div>
</div>
