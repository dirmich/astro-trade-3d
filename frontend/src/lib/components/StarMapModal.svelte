<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    gameStore,
    addGameLog,
    getSectorMapStatus,
    formatDuration,
    API_BASE,
  } from '../stores/gameStore';
  import { currentLang, localName, t } from '../i18n';

  const dispatch = createEventDispatcher<{
    warp: string;
    manualFly: string;
    aiFly: string;
  }>();

  $: state = $gameStore;
  $: currentPlanet = state.planets.find((p) => p.id === state.user?.current_planet_id) || state.planets[0];
  $: targetPlanet =
    state.planets.find((p) => p.id === state.selectedTargetPlanetId) ||
    state.planets.find((p) => p.id !== currentPlanet?.id) ||
    state.planets[0];

  function toRadarCoord(val: number): number {
    // Map world coordinates (-1400..1400) to SVG 0..240
    return Math.max(12, Math.min(228, 120 + (val / 1450) * 108));
  }

  function estimateFlightSec(distKm: number, isAi: boolean): number {
    const spd = (isAi ? 42 : 34) * Number(state.user?.flightSpeedBonus || 1);
    return Math.max(2, Math.ceil(distKm / spd));
  }

  let selectedSector = '';
  let nowMs = Date.now();
  let timer: any;
  let errorMsg = '';
  let statusMsg = '';

  function closeModal() {
    gameStore.update((s) => ({ ...s, activeModal: null }));
  }

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
      errorMsg = 'Please sign in first.';
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
      errorMsg = data.error || 'Emergency map purchase failed';
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
      <h2 class="text-xl font-bold text-cyan-300">{$t.mapModalTitle}</h2>
      <p class="text-xs text-slate-400 mt-0.5">{$t.mapModalSubtitle}</p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      {#if state.user}
        <span class="px-3 py-1.5 rounded-xl bg-slate-800 border border-rose-500/40 text-xs text-rose-300 font-semibold">
          🚨 {$t.shopEmergencyQuota}: {emergencyRemaining}/3
        </span>
      {/if}
      <button
        type="button"
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
        class="px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold"
      >
        {$t.mapGoToShopBtn}
      </button>
      <button
        type="button"
        on:click={closeModal}
        class="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow"
      >
        {$t.closeBtn}
      </button>
    </div>
  </div>

  <!-- Sector Tabs -->
  <div class="flex flex-wrap gap-2">
    {#each allSectors as sec}
      {@const st = getSectorMapStatus(state.user?.unlockedMaps, sec, nowMs)}
      <button
        type="button"
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
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs">
      <div class="flex items-center gap-2 text-emerald-300 font-semibold">
        <span>🛰️ [{selectedSector}] {$t.mapSectorActiveBanner}</span>
        <span class="text-slate-400">|</span>
        <span>{$t.mapDetectedPlanets}: {sectorPlanets.length}</span>
      </div>
      <div class="font-mono font-bold text-emerald-400">
        ⏱️ {$t.remainingTimeLabel}: {formatDuration(mapStatus.remainingSec)}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <!-- Left: Interactive 2D Space Navigation Map Radar (SVG) -->
      <div class="lg:col-span-5 p-3 rounded-2xl bg-slate-950/95 border border-cyan-500/40 flex flex-col items-center justify-between">
        <div class="w-full flex items-center justify-between text-xs mb-1">
          <span class="font-bold text-cyan-300">{$t.spaceMapHudTitle}</span>
          {#if targetPlanet}
            <span class="text-amber-300 font-bold truncate">
              {$t.mapTargetLabel}: {localName(targetPlanet, $currentLang)}
            </span>
          {/if}
        </div>

        <svg viewBox="0 0 240 240" class="w-full max-w-[260px] aspect-square rounded-xl bg-slate-950 border border-slate-800">
          <!-- Radar Grid Rings -->
          <circle cx="120" cy="120" r="35" fill="none" stroke="#1e293b" stroke-dasharray="3 3" />
          <circle cx="120" cy="120" r="70" fill="none" stroke="#1e293b" stroke-dasharray="3 3" />
          <circle cx="120" cy="120" r="105" fill="none" stroke="#1e293b" stroke-dasharray="3 3" />
          <line x1="120" y1="5" x2="120" y2="235" stroke="#0f172a" />
          <line x1="5" y1="120" x2="235" y2="120" stroke="#0f172a" />

          <!-- Central Sun -->
          <circle cx="120" cy="120" r="5" fill="#fbbf24" />

          <!-- Route Line from Ship to Selected Target Planet -->
          {#if targetPlanet}
            {@const sx = toRadarCoord(state.flightTelemetry?.x || 0)}
            {@const sy = toRadarCoord(state.flightTelemetry?.z || 0)}
            {@const tx = toRadarCoord(targetPlanet.x)}
            {@const ty = toRadarCoord(targetPlanet.z)}
            <line
              x1={sx}
              y1={sy}
              x2={tx}
              y2={ty}
              stroke="#22d3ee"
              stroke-width="1.8"
              stroke-dasharray="4 3"
            />
          {/if}

          <!-- Mapped Planets -->
          {#each state.planets as mp (mp.id)}
            {@const secUnlocked = getSectorMapStatus(state.user?.unlockedMaps, mp.sector, nowMs).active}
            {#if secUnlocked}
              {@const px = toRadarCoord(mp.x)}
              {@const py = toRadarCoord(mp.z)}
              {@const isSel = mp.id === targetPlanet?.id}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <g
                class="cursor-pointer"
                on:click={() => {
                  selectedSector = mp.sector;
                  gameStore.update((s) => ({ ...s, selectedTargetPlanetId: mp.id }));
                }}
              >
                {#if isSel}
                  <circle cx={px} cy={py} r="10" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="2 2" />
                {/if}
                <circle cx={px} cy={py} r={isSel ? 5.5 : 4} fill={mp.color_primary} stroke="#ffffff" stroke-width="0.8" />
                <text x={px + 6} y={py + 3} fill={isSel ? '#fde68a' : '#cbd5e1'} font-size="7.5" font-weight="bold">
                  {isSel ? '🎯 ' : ''}{localName(mp, $currentLang)}
                </text>
              </g>
            {/if}
          {/each}

          <!-- Player Spaceship Position -->
          {#if state.flightTelemetry}
            {@const sx = toRadarCoord(state.flightTelemetry.x)}
            {@const sy = toRadarCoord(state.flightTelemetry.z)}
            <g transform="translate({sx}, {sy})">
              <circle r="4.5" fill="#10b981" stroke="#ffffff" stroke-width="1.2" />
              <text x="-12" y="-7" fill="#6ee7b7" font-size="7.5" font-weight="bold">{$t.mapShipLabel}</text>
            </g>
          {/if}
        </svg>

        <div class="w-full text-[11px] text-center text-cyan-300 mt-1.5">
          {$t.mapSteerHint}
        </div>
      </div>

      <!-- Right: Sector Planet Cards with Distance & Travel Time -->
      <div class="lg:col-span-7 grid grid-cols-1 gap-3 max-h-[48vh] overflow-y-auto pr-1">
        {#each sectorPlanets as p (p.id)}
          {@const isCurrent = p.id === currentPlanet?.id}
          {@const isTarget = p.id === targetPlanet?.id}
          {@const dx = Math.round(p.x - (state.flightTelemetry?.x || 0))}
          {@const dy = Math.round(p.y - (state.flightTelemetry?.y || 0))}
          {@const dz = Math.round(p.z - (state.flightTelemetry?.z || 0))}
          {@const dist = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz))}
          {@const estManualSec = estimateFlightSec(dist, false)}
          {@const estAiSec = estimateFlightSec(dist, true)}

          <div
            class="p-3.5 rounded-2xl border transition flex flex-col justify-between {isTarget
              ? 'bg-amber-950/35 border-amber-400'
              : isCurrent
              ? 'bg-cyan-950/50 border-cyan-400'
              : 'bg-slate-800/80 border-slate-700 hover:border-cyan-500/50'}"
          >
            <div>
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  on:click={() => gameStore.update((s) => ({ ...s, selectedTargetPlanetId: p.id }))}
                  class="flex items-center gap-2 text-left"
                >
                  <span class="w-3.5 h-3.5 rounded-full inline-block" style="background:{p.color_primary}"></span>
                  <h3 class="font-bold text-sm text-white">
                    {isTarget ? '🎯 ' : ''}{localName(p, $currentLang)} <span class="text-xs text-slate-400">({p.name})</span>
                  </h3>
                </button>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-amber-300 border border-amber-500/30">
                  {$t.mapDangerLevel}{p.danger_level} · {p.biome}
                </span>
              </div>

              <p class="text-xs text-slate-300 mt-1.5">{p.specialty_desc}</p>

              <div class="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                <span>{$t.mapCoordsLabel}: ({p.x}, {p.y}, {p.z})</span>
                <span class="text-cyan-300 font-bold">{$t.mapDistFromShip}: {dist} km</span>
                <span class="text-emerald-300 font-bold">
                  ⏱️ {$t.estTravelTimeLabel}: ~{estManualSec}{$t.secUnit} (AI ~{estAiSec}{$t.secUnit})
                </span>
              </div>
            </div>

            <div class="mt-3 pt-2.5 border-t border-slate-700/70 flex flex-wrap items-center justify-end gap-2">
              {#if isCurrent && state.flightMode === 'ORBIT'}
                <span class="px-2.5 py-1 rounded-lg bg-cyan-900/60 text-cyan-300 text-xs font-bold">
                  {$t.mapCurrentOrbitBadge}
                </span>
              {/if}
              <button
                type="button"
                on:click={() => dispatch('manualFly', p.id)}
                class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                {$t.mapManualFlyBtn} (~{estManualSec}{$t.secUnit})
              </button>
              <button
                type="button"
                on:click={() => dispatch('aiFly', p.id)}
                class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
              >
                🤖 {$t.flyAiBtn} ({state.user?.ai_agent_uses || 0}) (~{estAiSec}{$t.secUnit})
              </button>
              <button
                type="button"
                on:click={() => dispatch('warp', p.id)}
                class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                {$t.mapInstantWarpBtn}
              </button>
            </div>
          </div>
        {/each}
      </div>
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
          🔒 [{selectedSector}] {$t.mapLockedTitleSuffix}
        </h3>
        <p class="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
          {$t.mapLockedDesc1} <strong>{sectorPlanets.length}</strong> {$t.mapLockedDesc2}
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          type="button"
          on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
          class="px-4 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold shadow"
        >
          {$t.mapBuyAtShopBtn} ({(sectorMapSpec?.base_price || 1000).toLocaleString()} CR)
        </button>

        <button
          type="button"
          on:click={() => buyEmergencyMapForSector(selectedSector)}
          disabled={emergencyRemaining <= 0}
          class="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold shadow-lg border border-rose-400"
        >
          {$t.mapEmergencyBuyBtn} ({emergencyPrice.toLocaleString()} CR · {emergencyRemaining}/3)
        </button>
      </div>
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
