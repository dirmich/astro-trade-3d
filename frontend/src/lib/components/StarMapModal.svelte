<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    gameStore,
    addGameLog,
    getSectorMapStatus,
    formatDuration,
    API_BASE,
  } from '../stores/gameStore';

  const dispatch = createEventDispatcher<{
    warp: string;
    manualFly: string;
  }>();

  $: state = $gameStore;
  $: currentPlanet = state.planets.find((p) => p.id === state.user?.current_planet_id) || state.planets[0];

  let selectedSector = '';
  let nowMs = Date.now();
  let timer: any;
  let errorMsg = '';
  let statusMsg = '';

  onMount(() => {
    selectedSector = currentPlanet?.sector || 'Core-Alpha';
    timer = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    clearInterval(timer);
  });

  $: allSectors = Array.from(new Set(state.planets.map((p) => p.sector)));
  $: if (!selectedSector && allSectors.length > 0) {
    selectedSector = currentPlanet?.sector || allSectors[0];
  }

  $: sectorPlanets = state.planets.filter((p) => p.sector === selectedSector);
  $: mapStatus = getSectorMapStatus(state.user?.unlockedMaps, selectedSector, nowMs);
  $: sectorMapSpec =
    state.shopCatalog.find((it) => it.category === 'MAP' && it.target_sector === selectedSector) ||
    state.shopCatalog.find((it) => it.id === 'map_core_alpha');
  $: emergencyPrice = sectorMapSpec ? sectorMapSpec.emergency_price || sectorMapSpec.base_price * 10 : 10000;
  $: emergencyRemaining = Math.max(0, 3 - Number(state.user?.emergencyMapUsed || 0));

  async function buyEmergencyMapForSector(sector: string) {
    errorMsg = '';
    statusMsg = '';
    if (!state.user) {
      errorMsg = '먼저 상단 우측에서 파일럿 로그인을 진행해주세요.';
      return;
    }

    const res = await fetch(`${API_BASE}/game/shop/emergency-map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.user.id,
        sector,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      errorMsg = data.error || '긴급 우주지도 구매 실패';
      addGameLog(`❌ ${errorMsg}`);
      return;
    }

    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      statusMsg = data.message;
      addGameLog(data.message);
    }
  }
</script>

<div class="p-6 bg-slate-900/95 border border-cyan-500/50 rounded-2xl max-w-5xl w-full shadow-2xl space-y-4">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
    <div>
      <h2 class="text-xl font-bold text-cyan-300">🗺️ 성간 구역별 우주지도 & 항법 관제소</h2>
      <p class="text-xs text-slate-400 mt-0.5">
        상점에서 구역별 우주지도를 구매하면 정해진 유효기간 동안 해당 구역의 행성 좌표와 항로가 표시됩니다. 지도 없이 항해 중 급히 구매할 경우 <strong class="text-rose-400">10배 가격(최대 3회)</strong>에 긴급 수신할 수 있습니다.
      </p>
    </div>

    <div class="flex items-center gap-2">
      {#if state.user}
        <span class="px-3 py-1.5 rounded-xl bg-slate-800 border border-rose-500/40 text-xs text-rose-300 font-semibold">
          🚨 긴급 성도 구매 가능: {emergencyRemaining}/3회
        </span>
      {/if}
      <button
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
        class="px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold"
      >
        🛒 행성 상점(정가 구매) 이동
      </button>
      <button
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: null }))}
        class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
      >
        ✕ 닫기
      </button>
    </div>
  </div>

  <!-- Sector Tabs -->
  <div class="flex flex-wrap gap-2">
    {#each allSectors as sec}
      {@const st = getSectorMapStatus(state.user?.unlockedMaps, sec, nowMs)}
      <button
        on:click={() => {
          selectedSector = sec;
          errorMsg = '';
          statusMsg = '';
        }}
        class="px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 {selectedSector === sec
          ? 'bg-cyan-600 text-white border-cyan-300 shadow'
          : st.active
          ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/60'
          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700'}"
      >
        <span>{st.active ? '🟢' : '🔒'}</span>
        <span>{sec}</span>
        {#if st.active}
          <span class="text-[10px] font-mono text-emerald-200">({formatDuration(st.remainingSec)})</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if statusMsg}
    <div class="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs">
      {statusMsg}
    </div>
  {/if}
  {#if errorMsg}
    <div class="p-3 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs">
      {errorMsg}
    </div>
  {/if}

  <!-- Sector Content: Active Map vs Locked Unmapped Sector -->
  {#if mapStatus.active}
    <div class="flex items-center justify-between px-4 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs">
      <div class="flex items-center gap-2 text-emerald-300 font-semibold">
        <span>🛰️ [{selectedSector}] 구역 우주지도 활성화됨</span>
        <span class="text-slate-400">|</span>
        <span>탐지된 행성: {sectorPlanets.length}개</span>
      </div>
      <div class="font-mono font-bold text-emerald-400">
        ⏱️ 지도 유효기간 남음: {formatDuration(mapStatus.remainingSec)}
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[52vh] overflow-y-auto pr-1">
      {#each sectorPlanets as p (p.id)}
        {@const isCurrent = p.id === currentPlanet?.id}
        {@const dx = Math.round(p.x - (state.flightTelemetry?.x || 0))}
        {@const dy = Math.round(p.y - (state.flightTelemetry?.y || 0))}
        {@const dz = Math.round(p.z - (state.flightTelemetry?.z || 0))}
        {@const dist = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz))}

        <div
          class="p-4 rounded-2xl border transition flex flex-col justify-between {isCurrent
            ? 'bg-cyan-950/50 border-cyan-400'
            : 'bg-slate-800/80 border-slate-700 hover:border-cyan-500/50'}"
        >
          <div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 rounded-full inline-block" style="background:{p.color_primary}"></span>
                <h3 class="font-bold text-sm text-white">
                  {p.name_ko} <span class="text-xs text-slate-400">({p.name})</span>
                </h3>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-amber-300 border border-amber-500/30">
                위험도 Lv.{p.danger_level} · {p.biome}
              </span>
            </div>

            <p class="text-xs text-slate-300 mt-2">{p.specialty_desc}</p>

            <div class="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span>좌표: ({p.x}, {p.y}, {p.z})</span>
              <span class="text-cyan-300 font-bold">현재 함선으로부터 거리: {dist} km</span>
            </div>
          </div>

          <div class="mt-3 pt-2.5 border-t border-slate-700/70 flex items-center justify-end gap-2">
            {#if isCurrent && state.flightMode === 'ORBIT'}
              <span class="px-3 py-1.5 rounded-lg bg-cyan-900/60 text-cyan-300 text-xs font-bold">
                📍 현재 정박 궤도
              </span>
            {/if}
            <button
              on:click={() => dispatch('manualFly', p.id)}
              class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
            >
              🛸 직접 운행으로 비행
            </button>
            <button
              on:click={() => dispatch('warp', p.id)}
              class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
            >
              ⚡ 즉시 워프
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Locked / Unmapped Sector View with Emergency 10x Purchase Option -->
    <div class="p-8 rounded-2xl bg-slate-950/90 border-2 border-dashed border-rose-500/50 text-center space-y-4">
      <div class="w-20 h-20 mx-auto rounded-2xl bg-rose-950/60 border border-rose-500/50 flex items-center justify-center">
        {#if sectorMapSpec}
          <img src={sectorMapSpec.image_url} alt={selectedSector} class="w-16 h-16 object-contain opacity-80" />
        {:else}
          <span class="text-3xl">🔒</span>
        {/if}
      </div>

      <div class="space-y-1">
        <h3 class="text-lg font-bold text-rose-300">
          🔒 [{selectedSector}] 구역 우주지도가 없거나 유효기간이 만료되었습니다
        </h3>
        <p class="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
          이 구역에는 <strong>{sectorPlanets.length}개</strong>의 미확인 행성이 존재합니다. 행성 상점에서 정가(<strong>{(sectorMapSpec?.base_price || 1000).toLocaleString()} CR</strong>)로 구매하거나, 지금 우주항해 중 급하게 지도가 필요하다면 <strong class="text-rose-400">10배 할증 가격({emergencyPrice.toLocaleString()} CR)</strong>으로 최대 3회까지 긴급 위성 성도를 구매할 수 있습니다.
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
          class="px-4 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold shadow"
        >
          🛒 행성 상점에서 정가 구매 ({(sectorMapSpec?.base_price || 1000).toLocaleString()} CR)
        </button>

        <button
          on:click={() => buyEmergencyMapForSector(selectedSector)}
          disabled={emergencyRemaining <= 0}
          class="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold shadow-lg border border-rose-400"
        >
          🚨 우주항해 긴급 지도 구매 — 10배 가격 ({emergencyPrice.toLocaleString()} CR · 잔여 {emergencyRemaining}/3회)
        </button>
      </div>
    </div>
  {/if}
</div>
