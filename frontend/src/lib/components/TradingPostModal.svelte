<script lang="ts">
  import { gameStore, fetchUniverse, addGameLog, API_BASE } from '../stores/gameStore';
  import { currentLang, localName, t } from '../i18n';

  $: state = $gameStore;
  $: currentPlanet = state.planets.find((p) => p.id === state.user?.current_planet_id) || state.planets[0];
  $: markets = state.markets.filter((m) => m.planet_id === currentPlanet?.id);

  let statusMsg = '';
  let errorMsg = '';

  function closeModal() {
    gameStore.update((s) => ({ ...s, activeModal: null }));
  }

  async function executeTrade(resourceId: string, type: 'BUY' | 'SELL', quantity: number) {
    statusMsg = '';
    errorMsg = '';
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
    if (!res.ok || data.error) {
      errorMsg = data.error || 'Trade failed';
      return;
    }
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      await fetchUniverse();
      statusMsg = `${type} x${quantity}`;
      addGameLog(`🏛️ [Trade] ${type} x${quantity}`);
    }
  }
</script>

<div class="p-6 bg-slate-900/95 border border-cyan-500/45 rounded-2xl max-w-4xl w-full shadow-2xl space-y-4">
  <!-- Header with Prominent Close Button -->
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
    <div>
      <h2 class="text-xl font-bold text-cyan-300">
        🏛️ {localName(currentPlanet, $currentLang)} — {$t.tradeTitleSuffix}
      </h2>
      <p class="text-xs text-slate-400 mt-0.5">{currentPlanet?.specialty_desc || ''}</p>
    </div>

    <div class="flex items-center gap-3">
      {#if state.user}
        <span class="px-3 py-1.5 rounded-xl bg-slate-800 border border-amber-500/40 text-xs font-bold text-amber-400">
          💰 {state.user.credits.toLocaleString()} CR
        </span>
      {/if}
      <button
        type="button"
        on:click={closeModal}
        class="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow"
      >
        {$t.closeBtn}
      </button>
    </div>
  </div>

  {#if statusMsg}
    <div class="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-xs text-emerald-200">
      ✅ {statusMsg}
    </div>
  {/if}
  {#if errorMsg}
    <div class="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs text-rose-200">
      ⚠️ {errorMsg}
    </div>
  {/if}

  <div class="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
    {#each markets as m}
      {@const res = state.resources.find((r) => r.id === m.resource_id)}
      {#if res}
        {@const ownedQty = state.user?.cargo?.[res.id] || 0}
        <div class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-800/80 border border-slate-700">
          <div>
            <div class="font-semibold text-sm text-white">
              {localName(res, $currentLang)} <span class="text-xs text-slate-400">({res.code})</span>
              {#if ownedQty > 0}
                <span class="ml-2 px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[11px] font-bold">
                  {$t.hudCargo}: {ownedQty}
                </span>
              {/if}
            </div>
            <div class="text-xs text-slate-400">
              {$t.tradeStockLabel}: <strong class="text-cyan-300">{m.stock}</strong> ({$t.basePriceLabel}: {res.base_price} CR)
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2.5">
            <span class="text-xs text-emerald-400 font-semibold">{$t.tradeBuyPriceLabel}: {m.buy_price} CR</span>
            <span class="text-xs text-amber-400 font-semibold">{$t.tradeSellPriceLabel}: {m.sell_price} CR</span>
            <button
              type="button"
              on:click={() => executeTrade(res.id, 'BUY', 5)}
              class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
            >
              {$t.tradeBuy5Btn}
            </button>
            <button
              type="button"
              on:click={() => executeTrade(res.id, 'SELL', 5)}
              class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
            >
              {$t.tradeSell5Btn}
            </button>
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Bottom Close Button -->
  <div class="flex justify-end pt-2 border-t border-slate-800">
    <button
      type="button"
      on:click={closeModal}
      class="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600"
    >
      {$t.closeBtn}
    </button>
  </div>
</div>
