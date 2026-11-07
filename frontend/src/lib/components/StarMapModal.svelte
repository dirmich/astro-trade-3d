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
    return Math.max(12, Math.min(228, 120 + (val / 980) * 105));
  }

  function toRadarXY(x: number, z: number): { x: number; y: number } {
    const dist = Math.sqrt(x * x + z * z);
    if (dist < 1) return { x: 120, y: 120 };
    const norm = 0.22 + 0.78 * Math.min(1, Math.pow(dist / 920, 0.65));
    const angle = Math.atan2(z, x);
    return {
      x: Number((120 + Math.cos(angle) * norm * 104).toFixed(1)),
      y: Number((120 + Math.sin(angle) * norm * 104).toFixed(1)),
    };
  }

  function toSectorLocalXY(p: any, list: any[]): { x: number; y: number } {
    if (!list || list.length <= 1) return { x: 180, y: 60 };
    const xs = list.map((it) => it.x);
    const zs = list.map((it) => it.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const spanX = Math.max(60, maxX - minX);
    const spanZ = Math.max(60, maxZ - minZ);
    return {
      x: Number((40 + ((p.x - minX) / spanX) * 280).toFixed(1)),
      y: Number((22 + ((p.z - minZ) / spanZ) * 76).toFixed(1)),
    };
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

  async function buyNormalMapForSector(sector: string) {
    errorMsg = '';
    statusMsg = '';
    if (!state.user || !currentPlanet) {
      errorMsg = 'Please sign in first.';
      return;
    }
    const mapItem =
      state.shopCatalog.find((it) => it.category === 'MAP' && it.target_sector === sector) ||
      state.shopCatalog.find((it) => it.id === 'map_core_alpha');
    if (!mapItem) return;

    const res = await fetch(`${API_BASE}/game/shop/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.user.id,
        planetId: currentPlanet.id,
        itemId: mapItem.id,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      errorMsg = data.error || 'Map purchase failed';
      addGameLog(`❌ ${errorMsg}`);
      return;
    }
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      statusMsg = data.message;
      addGameLog(data.message);
    }
  }

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

<div class="my-auto p-3.5 sm:p-6 bg-slate-900/95 border border-cyan-500/50 rounded-2xl max-w-5xl w-full shadow-2xl space-y-3 sm:space-y-4">
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

  <!-- Always-Visible 2D Galaxy & Sector Space Navigation Map + Sector Planet List / Map Unlock -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
    <!-- Left: Interactive 2D Space Navigation Map Radar (SVG) — Always Visible! -->
    <div class="lg:col-span-5 p-3.5 rounded-2xl bg-slate-950/95 border border-cyan-500/50 flex flex-col items-center justify-between space-y-2">
      <div class="w-full flex items-center justify-between text-xs">
        <span class="font-bold text-cyan-300">{$t.spaceMapHudTitle}</span>
        {#if targetPlanet}
          <span class="text-amber-300 font-bold truncate">
            {$t.mapTargetLabel}: {localName(targetPlanet, $currentLang)}
          </span>
        {/if}
      </div>

      <svg viewBox="0 0 240 240" class="w-full max-w-[280px] aspect-square rounded-xl bg-slate-950 border border-cyan-500/30 shadow-inner">
        <!-- Radar Grid Rings & Compass Crosshair -->
        <circle cx="120" cy="120" r="35" fill="none" stroke="#1e293b" stroke-dasharray="3 3" />
        <circle cx="120" cy="120" r="70" fill="none" stroke="#1e293b" stroke-dasharray="3 3" />
        <circle cx="120" cy="120" r="105" fill="none" stroke="#1e293b" stroke-dasharray="3 3" />
        <line x1="120" y1="5" x2="120" y2="235" stroke="#0f172a" />
        <line x1="5" y1="120" x2="235" y2="120" stroke="#0f172a" />
        <text x="117" y="13" fill="#475569" font-size="7" font-weight="bold">N</text>
        <text x="117" y="233" fill="#475569" font-size="7" font-weight="bold">S</text>
        <text x="228" y="123" fill="#475569" font-size="7" font-weight="bold">E</text>
        <text x="6" y="123" fill="#475569" font-size="7" font-weight="bold">W</text>

        <!-- Central Sun -->
        <circle cx="120" cy="120" r="6" fill="#fbbf24" />
        <circle cx="120" cy="120" r="10" fill="none" stroke="#f59e0b" stroke-opacity="0.4" />

        <!-- Route Line from Ship to Selected Target Planet -->
        {#if targetPlanet}
          {@const sp = toRadarXY(state.flightTelemetry?.x || 0, state.flightTelemetry?.z || 0)}
          {@const tp = toRadarXY(targetPlanet.x, targetPlanet.z)}
          <line
            x1={sp.x}
            y1={sp.y}
            x2={tp.x}
            y2={tp.y}
            stroke="#22d3ee"
            stroke-width="2"
            stroke-dasharray="4 3"
          />
        {/if}

        <!-- All Planets on the 2D Space Map -->
        {#each state.planets as mp (mp.id)}
          {@const secUnlocked = getSectorMapStatus(state.user?.unlockedMaps, mp.sector, nowMs).active}
          {@const pt = toRadarXY(mp.x, mp.z)}
          {@const px = pt.x}
          {@const py = pt.y}
          {@const isSel = mp.id === targetPlanet?.id}
          {@const isCur = mp.id === currentPlanet?.id}
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
              <circle cx={px} cy={py} r="10.5" fill="none" stroke="#f59e0b" stroke-width="1.6" stroke-dasharray="2 2" />
            {/if}
            {#if secUnlocked || isCur || isSel}
              <circle cx={px} cy={py} r={isSel ? 5.5 : 4} fill={mp.color_primary} stroke="#ffffff" stroke-width="0.9" />
              <text x={px + 6} y={py + 3} fill={isSel ? '#fde68a' : '#cbd5e1'} font-size="7.5" font-weight="bold">
                {isSel ? '🎯 ' : ''}{localName(mp, $currentLang)}
              </text>
            {:else}
              <circle cx={px} cy={py} r="2.8" fill="#475569" stroke="#94a3b8" stroke-width="0.6" />
            {/if}
          </g>
        {/each}

        <!-- Player Spaceship Position & Heading Nose Arrow -->
        {#if state.flightTelemetry}
          {@const sp = toRadarXY(state.flightTelemetry.x, state.flightTelemetry.z)}
          {@const sx = sp.x}
          {@const sy = sp.y}
          {@const hRad = ((state.flightTelemetry.headingDeg || 0) * Math.PI) / 180}
          {@const hx = sx + Math.sin(hRad) * 11}
          {@const hy = sy + Math.cos(hRad) * 11}
          <line x1={sx} y1={sy} x2={hx} y2={hy} stroke="#10b981" stroke-width="2" />
          <g transform="translate({sx}, {sy})">
            <circle r="4.5" fill="#10b981" stroke="#ffffff" stroke-width="1.2" />
            <text x="-14" y="-7" fill="#6ee7b7" font-size="7.5" font-weight="bold">{$t.mapShipLabel}</text>
          </g>
        {/if}
      </svg>

      {#if targetPlanet}
        {@const tdx = Math.round(targetPlanet.x - (state.flightTelemetry?.x || 0))}
        {@const tdy = Math.round(targetPlanet.y - (state.flightTelemetry?.y || 0))}
        {@const tdz = Math.round(targetPlanet.z - (state.flightTelemetry?.z || 0))}
        {@const tDist = Math.round(Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz))}
        {@const tManualSec = estimateFlightSec(tDist, false)}
        {@const tAiSec = estimateFlightSec(tDist, true)}
        <div class="w-full p-2.5 rounded-xl bg-slate-900 border border-cyan-500/40 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-amber-300 truncate">
              🎯 {localName(targetPlanet, $currentLang)} ({targetPlanet.sector})
            </span>
            <span class="font-mono text-cyan-300 font-bold">
              {tDist}km · ~{(state.user?.ai_agent_uses || 0) > 0 ? tAiSec : tManualSec}{$t.secUnit}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              on:click={() => dispatch('manualFly', targetPlanet.id)}
              class="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold"
            >
              {$t.mapManualFlyBtn} (~{tManualSec}{$t.secUnit})
            </button>
            <button
              type="button"
              on:click={() => dispatch('aiFly', targetPlanet.id)}
              class="py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold"
            >
              🤖 {$t.flyAiBtn} ({state.user?.ai_agent_uses || 0}) (~{tAiSec}{$t.secUnit})
            </button>
          </div>
        </div>
      {/if}

      <div class="w-full text-[11px] text-center text-cyan-300">
        {$t.mapSteerHint}
      </div>
    </div>

    <!-- Right: Zoomed-in Sector 2D Star Chart + Active Sector Planet List / Map Purchase -->
    <div class="lg:col-span-7 flex flex-col justify-between space-y-3">
      <!-- Zoomed-in Sector 2D Star Map -->
      <div class="p-3 rounded-2xl bg-slate-950/90 border border-cyan-500/40 space-y-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-cyan-300">[{selectedSector}] {$t.spaceMapHudTitle}</span>
          <span class="text-[11px] font-mono {mapStatus.active ? 'text-emerald-400' : 'text-rose-400'}">
            {mapStatus.active
              ? `🟢 ${$t.remainingTimeLabel}: ${formatDuration(mapStatus.remainingSec)}`
              : `🔒 ${$t.mapLockedTitleSuffix}`}
          </span>
        </div>

        <svg viewBox="0 0 360 120" class="w-full h-28 rounded-xl bg-slate-950 border border-slate-800">
          <!-- Sector Grid -->
          <line x1="0" y1="30" x2="360" y2="30" stroke="#0f172a" />
          <line x1="0" y1="60" x2="360" y2="60" stroke="#0f172a" />
          <line x1="0" y1="90" x2="360" y2="90" stroke="#0f172a" />
          <line x1="90" y1="0" x2="90" y2="120" stroke="#0f172a" />
          <line x1="180" y1="0" x2="180" y2="120" stroke="#0f172a" />
          <line x1="270" y1="0" x2="270" y2="120" stroke="#0f172a" />

          <!-- Trade Route Lines Between Sector Planets -->
          {#each sectorPlanets as sp, idx (sp.id)}
            {#if idx < sectorPlanets.length - 1}
              {@const p1 = toSectorLocalXY(sp, sectorPlanets)}
              {@const p2 = toSectorLocalXY(sectorPlanets[idx + 1], sectorPlanets)}
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={mapStatus.active ? '#38bdf8' : '#475569'}
                stroke-width="1.5"
                stroke-dasharray="4 3"
                opacity="0.7"
              />
            {/if}
          {/each}

          <!-- Sector Planets -->
          {#each sectorPlanets as sp (sp.id)}
            {@const pos = toSectorLocalXY(sp, sectorPlanets)}
            {@const isSel = sp.id === targetPlanet?.id}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <g
              class="cursor-pointer"
              on:click={() => gameStore.update((s) => ({ ...s, selectedTargetPlanetId: sp.id }))}
            >
              {#if isSel}
                <circle cx={pos.x} cy={pos.y} r="12" fill="none" stroke="#f59e0b" stroke-width="1.6" stroke-dasharray="3 2" />
              {/if}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isSel ? 6.5 : 5}
                fill={mapStatus.active || isSel ? sp.color_primary : '#64748b'}
                stroke="#ffffff"
                stroke-width="1"
              />
              <text
                x={pos.x}
                y={pos.y + 16}
                text-anchor="middle"
                fill={isSel ? '#fde68a' : mapStatus.active ? '#e2e8f0' : '#94a3b8'}
                font-size="8.5"
                font-weight="bold"
              >
                {isSel ? '🎯 ' : ''}{localName(sp, $currentLang)}
              </text>
            </g>
          {/each}
        </svg>
      </div>

      {#if mapStatus.active}
        <div class="grid grid-cols-1 gap-2.5 max-h-[34vh] overflow-y-auto pr-1">
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
      {:else}
        <!-- Unmapped Sector Purchase Panel alongside the 2D Space Map -->
        <div class="p-6 rounded-2xl bg-slate-950/90 border-2 border-dashed border-rose-500/50 text-center space-y-4">
          <div class="w-16 h-16 mx-auto rounded-2xl bg-rose-950/60 border border-rose-500/50 flex items-center justify-center">
            {#if sectorMapSpec}
              <img src={sectorMapSpec.image_url} alt={selectedSector} class="w-14 h-14 object-contain opacity-85" />
            {:else}
              <span class="text-2xl">🔒</span>
            {/if}
          </div>

          <div class="space-y-1">
            <h3 class="text-base font-bold text-rose-300">
              🔒 [{selectedSector}] {$t.mapLockedTitleSuffix}
            </h3>
            <p class="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
              {$t.mapLockedDesc1} <strong>{sectorPlanets.length}</strong> {$t.mapLockedDesc2}
            </p>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              on:click={() => buyNormalMapForSector(selectedSector)}
              class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg border border-emerald-400"
            >
              {$t.buyMapNowBtn} [{selectedSector}] ({(sectorMapSpec?.base_price || 1000).toLocaleString()} CR)
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
    </div>
  </div>

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
