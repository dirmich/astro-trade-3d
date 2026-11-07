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

  $: state = $gameStore;
  $: currentPlanet = state.planets.find((p) => p.id === state.user?.current_planet_id) || state.planets[0];

  let activeTab: 'ALL' | 'MAP' | 'GEAR' | 'PIRATE_LOOT' | 'INVENTORY' = 'ALL';
  let statusMsg = '';
  let errorMsg = '';
  let nowMs = Date.now();
  let timer: any;

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
      errorMsg = ' 먼저 상단 우측에서 파일럿 로그인을 진행해주세요.';
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
      errorMsg = data.error || '구매 실패';
      addGameLog(`❌ [상점 오류] ${errorMsg}`);
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
      errorMsg = data.error || '사용 실패';
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
      <div class="flex items-center gap-2">
        <h2 class="text-xl font-bold text-fuchsia-300">🛒 {currentPlanet?.name_ko} 성간 만물상점 & 성도 거래소</h2>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/40">
          {currentPlanet?.biome} 특화 상점 · {currentPlanet?.sector}
        </span>
      </div>
      <p class="text-xs text-slate-400 mt-1">
        행성마다 판매하는 구역 우주지도와 희귀 장비·유물이 다릅니다. (항해 중 지도 미보유 상태에서 긴급 구매 시 상점 정가의 <strong class="text-rose-400">10배</strong> 부과, 최대 3회 제한)
      </p>
    </div>

    <div class="flex items-center gap-3">
      {#if state.user}
        <div class="px-3 py-1.5 rounded-xl bg-slate-800 border border-amber-500/40 text-xs">
          보유 크레딧: <strong class="text-amber-400 text-sm">{state.user.credits.toLocaleString()} CR</strong>
        </div>
        <div class="px-3 py-1.5 rounded-xl bg-slate-800 border border-rose-500/40 text-xs">
          긴급 성도 구매권: <strong class="text-rose-400">{3 - (state.user.emergencyMapUsed || 0)}/3회 남음</strong>
        </div>
      {/if}
      <button
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: null }))}
        class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
      >
        ✕ 닫기
      </button>
    </div>
  </div>

  <!-- Level Border Legend & Filter Tabs -->
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex items-center gap-2">
      <button
        on:click={() => (activeTab = 'ALL')}
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'ALL'
          ? 'bg-fuchsia-600 text-white'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
      >
        전체 판매 품목 ({state.planetShopItems.length})
      </button>
      <button
        on:click={() => (activeTab = 'MAP')}
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'MAP'
          ? 'bg-cyan-600 text-white'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
      >
        🗺️ 구역별 우주지도 ({state.planetShopItems.filter((i) => i.category === 'MAP').length})
      </button>
      <button
        on:click={() => (activeTab = 'GEAR')}
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'GEAR'
          ? 'bg-amber-600 text-white'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
      >
        ⚔️ 특수 장비·소모품·유물 ({state.planetShopItems.filter((i) => i.category !== 'MAP').length})
      </button>
      <button
        on:click={() => (activeTab = 'INVENTORY')}
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'INVENTORY'
          ? 'bg-emerald-600 text-white'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
      >
        🎒 내 보유 아이템 ({Object.values(state.user?.inventory || {}).reduce((a: any, b: any) => a + Number(b), 0)})
      </button>
      <button
        on:click={() => (activeTab = 'PIRATE_LOOT')}
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'PIRATE_LOOT'
          ? 'bg-rose-600 text-white'
          : 'bg-slate-800 text-rose-300 border border-rose-500/40 hover:bg-slate-700'}"
      >
        🏴‍☠️ 해적 전리품 (비매품 도감)
      </button>
    </div>

    <!-- Item Level Border Legend -->
    <div class="flex items-center gap-1.5 text-[11px]">
      <span class="text-slate-400 mr-1">등급 테두리:</span>
      <span class="px-1.5 py-0.5 rounded border border-slate-400 text-slate-300">Lv.1 일반</span>
      <span class="px-1.5 py-0.5 rounded border border-emerald-400 text-emerald-300">Lv.2 고급</span>
      <span class="px-1.5 py-0.5 rounded border border-sky-400 text-sky-300">Lv.3 희귀</span>
      <span class="px-1.5 py-0.5 rounded border border-purple-400 text-purple-300">Lv.4 영웅</span>
      <span class="px-1.5 py-0.5 rounded border border-amber-400 text-amber-300">Lv.5 전설</span>
      <span class="px-1.5 py-0.5 rounded border border-rose-500 text-rose-300">Lv.6 신화</span>
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
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[58vh] overflow-y-auto pr-1">
      {#each state.shopCatalog.filter((i) => i.pirate_only) as loot (loot.id)}
        {@const lvStyle = getItemLevelStyle(loot.level)}
        {@const ownedCount = state.user?.inventory?.[loot.id] || 0}
        <div class="flex flex-col justify-between p-3.5 rounded-2xl bg-slate-900/90 {lvStyle.borderClass}">
          <div>
            <div class="flex items-start gap-3">
              <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 shrink-0 {lvStyle.borderClass}">
                <img src={loot.image_url} alt={loot.name_ko} class="w-full h-full object-cover" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold {lvStyle.badgeClass}">{lvStyle.label}</span>
                  <span class="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/50 text-[10px] font-bold">
                    🏴‍☠️ 상점 비매품 (Lv.{loot.min_pirate_level}+ 해적 드랍)
                  </span>
                </div>
                <h3 class="font-bold text-sm mt-1 truncate {lvStyle.textClass}">{loot.name_ko}</h3>
                <div class="text-[11px] text-slate-400 truncate">{loot.name_en}</div>
              </div>
            </div>
            <p class="text-xs text-slate-300 mt-2.5 leading-relaxed">{loot.description}</p>
            <div class="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] text-cyan-300 font-medium">
              ✨ 전리품 효과: {loot.effect_summary}
            </div>
          </div>

          <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-400">내 보유: {ownedCount}개</span>
            <button
              on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'COMBAT' }))}
              class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
            >
              ⚔️ 우주해적 토벌하러 가기
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else if activeTab !== 'INVENTORY'}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[58vh] overflow-y-auto pr-1">
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
                <img src={item.image_url} alt={item.name_ko} class="w-full h-full object-cover" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold {lvStyle.badgeClass}">
                    {lvStyle.label}
                  </span>
                  {#if item.is_specialty}
                    <span class="px-2 py-0.5 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-400/50 text-[10px] font-bold">
                      🌟 행성 특산 {item.discount_pct > 0 ? `-${item.discount_pct}%` : ''}
                    </span>
                  {/if}
                </div>

                <h3 class="font-bold text-sm mt-1 truncate {lvStyle.textClass}">{item.name_ko}</h3>
                <div class="text-[11px] text-slate-400 truncate">{item.name_en}</div>
              </div>
            </div>

            <!-- Description & Effect -->
            <p class="text-xs text-slate-300 mt-2.5 leading-relaxed">{item.description}</p>
            <div class="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] text-cyan-300 font-medium">
              ✨ 효과: {item.effect_summary}
            </div>

            {#if item.category === 'MAP'}
              <div class="mt-2 flex items-center justify-between text-[11px] px-2.5 py-1 rounded bg-slate-800/80">
                {#if mapStatus.active}
                  <span class="text-emerald-400 font-bold">🟢 지도 활성 중</span>
                  <span class="text-emerald-300 font-mono">남은 시간: {formatDuration(mapStatus.remainingSec)}</span>
                {:else}
                  <span class="text-slate-400">🔒 현재 미개방 구역</span>
                  <span class="text-rose-400">항해 긴급가: {(item.emergency_price || item.base_price * 10).toLocaleString()} CR</span>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Bottom Buy Action -->
          <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
            <div>
              <div class="text-amber-400 font-bold text-sm">{item.planet_price.toLocaleString()} CR</div>
              {#if ownedCount > 0}
                <div class="text-[10px] text-emerald-400">보유 수량: {ownedCount}개</div>
              {:else}
                <div class="text-[10px] text-slate-500">기준 정가: {item.base_price.toLocaleString()} CR</div>
              {/if}
            </div>

            <button
              on:click={() => buyItem(item)}
              class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white text-xs font-bold shadow"
            >
              {#if item.category === 'MAP' && mapStatus.active}
                시간 연장 구매
              {:else}
                즉시 구매
              {/if}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Inventory Tab -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[58vh] overflow-y-auto pr-1">
      {#each Object.entries(state.user?.inventory || {}) as [itemId, count]}
        {@const spec = state.shopCatalog.find((s) => s.id === itemId)}
        {#if spec && Number(count) > 0}
          {@const lvStyle = getItemLevelStyle(spec.level)}
          <div class="flex flex-col justify-between p-3.5 rounded-2xl bg-slate-900/90 {lvStyle.borderClass}">
            <div class="flex items-start gap-3">
              <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 shrink-0 {lvStyle.borderClass}">
                <img src={spec.image_url} alt={spec.name_ko} class="w-full h-full object-cover" />
              </div>
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold {lvStyle.badgeClass}">{lvStyle.label}</span>
                  <span class="text-xs font-bold text-emerald-400">보유 x{count}</span>
                </div>
                <h3 class="font-bold text-sm mt-1 {lvStyle.textClass}">{spec.name_ko}</h3>
                <p class="text-xs text-slate-400 mt-1">{spec.effect_summary}</p>
              </div>
            </div>
            {#if spec.category === 'CONSUMABLE'}
              <button
                on:click={() => useOwnedItem(spec.id)}
                class="mt-3 w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                소모품 추가 사용
              </button>
            {:else}
              <div class="mt-3 text-center py-1 rounded-lg bg-slate-800/80 text-[11px] text-cyan-300">
                ⚡ 함선에 영구 장착 / 성도 반영 완료
              </div>
            {/if}
          </div>
        {/if}
      {:else}
        <div class="col-span-3 py-12 text-center text-slate-400 text-sm">
          아직 구매한 아이템이 없습니다. 행성 상점에서 우주지도와 희귀 장비를 구매해보세요!
        </div>
      {/each}
    </div>
  {/if}
</div>
