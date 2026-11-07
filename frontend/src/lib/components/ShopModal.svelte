<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    gameStore,
    fetchPlanetShop,
    addGameLog,
    getItemLevelStyle,
    getSectorMapStatus,
    formatDuration,
    API_BASE,
  } from '../stores/gameStore';
  import { currentLang, localName, t } from '../i18n';

  $: state = $gameStore;
  $: currentPlanet = state.planets.find((p) => p.id === state.user?.current_planet_id) || state.planets[0];

  let activeTab: 'ALL' | 'MAP' | 'GEAR' | 'PIRATE_LOOT' | 'INVENTORY' = 'ALL';
  let statusMsg = '';
  let errorMsg = '';
  let nowMs = Date.now();
  let timer: any;

  function closeModal() {
    gameStore.update((s) => ({ ...s, activeModal: null }));
  }

  onMount(() => {
    if (currentPlanet?.id) {
      fetchPlanetShop(currentPlanet.id);
    }
    timer = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    clearInterval(timer);
  });

  $: if (currentPlanet?.id) {
    fetchPlanetShop(currentPlanet.id);
  }

  $: filteredItems = state.planetShopItems.filter((item) => {
    if (activeTab === 'MAP') return item.category === 'MAP';
    if (activeTab === 'GEAR') return item.category !== 'MAP';
    return true;
  });

  async function buyItem(item: any) {
    statusMsg = '';
    errorMsg = '';
    if (!state.user || !currentPlanet) {
      errorMsg = 'Please sign in first.';
      return;
    }

    const res = await fetch(`${API_BASE}/game/shop/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.user.id,
        planetId: currentPlanet.id,
        itemId: item.id,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      errorMsg = data.error || 'Purchase failed';
      addGameLog(`❌ [Shop] ${errorMsg}`);
      return;
    }

    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      statusMsg = data.message;
      addGameLog(data.message);
    }
  }

  async function useOwnedItem(itemId: string) {
    statusMsg = '';
    errorMsg = '';
    if (!state.user) return;

    const res = await fetch(`${API_BASE}/game/shop/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.user.id, itemId }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      errorMsg = data.error || 'Action failed';
      return;
    }
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      statusMsg = data.message;
      addGameLog(data.message);
    }
  }
</script>

<div class="p-6 bg-slate-900/95 border border-fuchsia-500/45 rounded-2xl max-w-5xl w-full shadow-2xl space-y-4">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
    <div>
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-xl font-bold text-fuchsia-300">
          🛒 {localName(currentPlanet, $currentLang)} — {$t.shopTitleSuffix}
        </h2>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/40">
          {currentPlanet?.biome} {$t.shopBiomeBadgeSuffix} · {currentPlanet?.sector}
        </span>
      </div>
      <p class="text-xs text-slate-400 mt-1">{$t.shopSubtitle}</p>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      {#if state.user}
        <div class="px-3 py-1.5 rounded-xl bg-slate-800 border border-amber-500/40 text-xs">
          {$t.hudCredits}: <strong class="text-amber-400 text-sm">{state.user.credits.toLocaleString()} CR</strong>
        </div>
        <div class="px-3 py-1.5 rounded-xl bg-slate-800 border border-rose-500/40 text-xs">
          {$t.shopEmergencyQuota}: <strong class="text-rose-400">{3 - (state.user.emergencyMapUsed || 0)}/3</strong>
        </div>
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

  <!-- Level Border Legend & Filter Tabs -->
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        on:click={() => (activeTab = 'ALL')}
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'ALL'
          ? 'bg-fuchsia-600 text-white'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
      >
        {$t.shopTabAll} ({state.planetShopItems.length})
      </button>
      <button
        type="button"
        on:click={() => (activeTab = 'MAP')}
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'MAP'
          ? 'bg-cyan-600 text-white'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
      >
        {$t.shopTabMap} ({state.planetShopItems.filter((i) => i.category === 'MAP').length})
      </button>
      <button
        type="button"
        on:click={() => (activeTab = 'GEAR')}
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'GEAR'
          ? 'bg-amber-600 text-white'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
      >
        {$t.shopTabGear} ({state.planetShopItems.filter((i) => i.category !== 'MAP').length})
      </button>
      <button
        type="button"
        on:click={() => (activeTab = 'INVENTORY')}
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'INVENTORY'
          ? 'bg-emerald-600 text-white'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
      >
        {$t.shopTabInventory} ({Object.values(state.user?.inventory || {}).reduce((a: any, b: any) => a + Number(b), 0)})
      </button>
      <button
        type="button"
        on:click={() => (activeTab = 'PIRATE_LOOT')}
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'PIRATE_LOOT'
          ? 'bg-rose-600 text-white'
          : 'bg-slate-800 text-rose-300 border border-rose-500/40 hover:bg-slate-700'}"
      >
        {$t.shopTabPirateLoot}
      </button>
    </div>

    <!-- Item Level Border Legend -->
    <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span class="text-slate-400 mr-1">{$t.rarityBorderLabel}</span>
      <span class="px-1.5 py-0.5 rounded border border-slate-400 text-slate-300">{$t.rarityLv1}</span>
      <span class="px-1.5 py-0.5 rounded border border-emerald-400 text-emerald-300">{$t.rarityLv2}</span>
      <span class="px-1.5 py-0.5 rounded border border-sky-400 text-sky-300">{$t.rarityLv3}</span>
      <span class="px-1.5 py-0.5 rounded border border-purple-400 text-purple-300">{$t.rarityLv4}</span>
      <span class="px-1.5 py-0.5 rounded border border-amber-400 text-amber-300">{$t.rarityLv5}</span>
      <span class="px-1.5 py-0.5 rounded border border-rose-500 text-rose-300">{$t.rarityLv6}</span>
    </div>
  </div>

  {#if statusMsg}
    <div class="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-medium">
      ✅ {statusMsg}
    </div>
  {/if}
  {#if errorMsg}
    <div class="p-3 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-medium">
      ⚠️ {errorMsg}
    </div>
  {/if}

  <!-- Shop Items Grid vs Pirate Loot vs Inventory Grid -->
  {#if activeTab === 'PIRATE_LOOT'}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[54vh] overflow-y-auto pr-1">
      {#each state.shopCatalog.filter((i) => i.pirate_only) as loot (loot.id)}
        {@const lvStyle = getItemLevelStyle(loot.level)}
        {@const ownedCount = state.user?.inventory?.[loot.id] || 0}
        <div class="flex flex-col justify-between p-3.5 rounded-2xl bg-slate-900/90 {lvStyle.borderClass}">
          <div>
            <div class="flex items-start gap-3">
              <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 shrink-0 {lvStyle.borderClass}">
                <img src={loot.image_url} alt={localName(loot, $currentLang)} class="w-full h-full object-cover" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold {lvStyle.badgeClass}">{lvStyle.label}</span>
                  <span class="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/50 text-[10px] font-bold">
                    {$t.pirateDropBadge} (Lv.{loot.min_pirate_level}+)
                  </span>
                </div>
                <h3 class="font-bold text-sm mt-1 truncate {lvStyle.textClass}">{localName(loot, $currentLang)}</h3>
                <div class="text-[11px] text-slate-400 truncate">{loot.name_en}</div>
              </div>
            </div>
            <p class="text-xs text-slate-300 mt-2.5 leading-relaxed">{loot.description}</p>
            <div class="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] text-cyan-300 font-medium">
              {$t.lootEffectLabel}: {loot.effect_summary}
            </div>
          </div>

          <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-400">{$t.ownedCountLabel}: x{ownedCount}</span>
            <button
              type="button"
              on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'COMBAT' }))}
              class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
            >
              {$t.goHuntPiratesBtn}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else if activeTab !== 'INVENTORY'}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[54vh] overflow-y-auto pr-1">
      {#each filteredItems as item (item.id)}
        {@const lvStyle = getItemLevelStyle(item.level)}
        {@const mapStatus =
          item.category === 'MAP'
            ? getSectorMapStatus(state.user?.unlockedMaps, item.target_sector, nowMs)
            : { active: false, remainingSec: 0 }}
        {@const ownedCount = state.user?.inventory?.[item.id] || 0}

        <div class="flex flex-col justify-between p-3.5 rounded-2xl bg-slate-900/90 transition {lvStyle.borderClass}">
          <div>
            <!-- Top Row: Image + Title + Level Badge -->
            <div class="flex items-start gap-3">
              <div class="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-950 shrink-0 {lvStyle.borderClass}">
                <img src={item.image_url} alt={localName(item, $currentLang)} class="w-full h-full object-cover" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold {lvStyle.badgeClass}">
                    {lvStyle.label}
                  </span>
                  {#if item.is_specialty}
                    <span class="px-2 py-0.5 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-400/50 text-[10px] font-bold">
                      {$t.planetSpecialtyBadge} {item.discount_pct > 0 ? `-${item.discount_pct}%` : ''}
                    </span>
                  {/if}
                </div>

                <h3 class="font-bold text-sm mt-1 truncate {lvStyle.textClass}">{localName(item, $currentLang)}</h3>
                <div class="text-[11px] text-slate-400 truncate">{item.name_en}</div>
              </div>
            </div>

            <!-- Description & Effect -->
            <p class="text-xs text-slate-300 mt-2.5 leading-relaxed">{item.description}</p>
            <div class="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] text-cyan-300 font-medium">
              {$t.lootEffectLabel}: {item.effect_summary}
            </div>

            {#if item.category === 'MAP'}
              <div class="mt-2 flex items-center justify-between text-[11px] px-2.5 py-1 rounded bg-slate-800/80">
                {#if mapStatus.active}
                  <span class="text-emerald-400 font-bold">{$t.mapActiveStatus}</span>
                  <span class="text-emerald-300 font-mono">{$t.remainingTimeLabel}: {formatDuration(mapStatus.remainingSec)}</span>
                {:else}
                  <span class="text-slate-400">{$t.mapLockedStatus}</span>
                  <span class="text-rose-400">{$t.emergencyPriceLabel}: {(item.emergency_price || item.base_price * 10).toLocaleString()} CR</span>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Bottom Buy Action -->
          <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
            <div>
              <div class="text-amber-400 font-bold text-sm">{item.planet_price.toLocaleString()} CR</div>
              {#if ownedCount > 0}
                <div class="text-[10px] text-emerald-400">{$t.ownedCountLabel}: x{ownedCount}</div>
              {:else}
                <div class="text-[10px] text-slate-500">{$t.basePriceLabel}: {item.base_price.toLocaleString()} CR</div>
              {/if}
            </div>

            <button
              type="button"
              on:click={() => buyItem(item)}
              class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white text-xs font-bold shadow"
            >
              {#if item.category === 'MAP' && mapStatus.active}
                {$t.extendTimeBtn}
              {:else}
                {$t.buyNowBtn}
              {/if}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Inventory Tab -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[54vh] overflow-y-auto pr-1">
      {#each Object.entries(state.user?.inventory || {}) as [itemId, count]}
        {@const spec = state.shopCatalog.find((s) => s.id === itemId)}
        {#if spec && Number(count) > 0}
          {@const lvStyle = getItemLevelStyle(spec.level)}
          <div class="flex flex-col justify-between p-3.5 rounded-2xl bg-slate-900/90 {lvStyle.borderClass}">
            <div class="flex items-start gap-3">
              <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 shrink-0 {lvStyle.borderClass}">
                <img src={spec.image_url} alt={localName(spec, $currentLang)} class="w-full h-full object-cover" />
              </div>
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold {lvStyle.badgeClass}">{lvStyle.label}</span>
                  <span class="text-xs font-bold text-emerald-400">x{count}</span>
                </div>
                <h3 class="font-bold text-sm mt-1 {lvStyle.textClass}">{localName(spec, $currentLang)}</h3>
                <p class="text-xs text-slate-400 mt-1">{spec.effect_summary}</p>
              </div>
            </div>
            {#if spec.category === 'CONSUMABLE'}
              <button
                type="button"
                on:click={() => useOwnedItem(spec.id)}
                class="mt-3 w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                {$t.useConsumableBtn}
              </button>
            {:else}
              <div class="mt-3 text-center py-1 rounded-lg bg-slate-800/80 text-[11px] text-cyan-300">
                {$t.equippedPermanentBadge}
              </div>
            {/if}
          </div>
        {/if}
      {:else}
        <div class="col-span-3 py-12 text-center text-slate-400 text-sm">
          {$t.emptyShopInventoryMsg}
        </div>
      {/each}
    </div>
  {/if}

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
