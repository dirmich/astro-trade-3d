<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import {
    gameStore,
    fetchUniverse,
    fetchPlanetShop,
    fetchFriendsList,
    fetchUserQuests,
    syncMultiplayerState,
    saveUserSettingsToDb,
    addGameLog,
    getSectorMapStatus,
    formatDuration,
    getItemLevelStyle,
    API_BASE,
  } from './lib/stores/gameStore';
  import { SpaceEngine3D } from './lib/three/SpaceScene';
  import { currentLang, getSupportedLocales, localName, t } from './lib/i18n';
  import { soundEngine } from './lib/audio/SoundEngine';

  import LandingPage from './lib/components/LandingPage.svelte';
  import TradingPostModal from './lib/components/TradingPostModal.svelte';
  import RepairShopModal from './lib/components/RepairShopModal.svelte';
  import TavernModal from './lib/components/TavernModal.svelte';
  import AdminModal from './lib/components/AdminModal.svelte';
  import ShopModal from './lib/components/ShopModal.svelte';
  import StarMapModal from './lib/components/StarMapModal.svelte';
  import CombatModal from './lib/components/CombatModal.svelte';
  import FriendsModal from './lib/components/FriendsModal.svelte';
  import QuestModal from './lib/components/QuestModal.svelte';

  let viewportEl: HTMLElement;
  let engine: SpaceEngine3D | null = null;
  let nowMs = Date.now();
  let clockTimer: any;
  let mpSyncTimer: any;
  let bgmEnabled = true;

  const locales = getSupportedLocales();

  $: state = $gameStore;
  $: currentPlanet =
    state.planets.find((p) => p.id === state.user?.current_planet_id) || state.planets[0];
  $: targetPlanet =
    state.planets.find((p) => p.id === state.selectedTargetPlanetId) ||
    state.planets.find((p) => p.id !== currentPlanet?.id) ||
    state.planets[0];
  $: currentMarkets = state.markets.filter((m) => m.planet_id === currentPlanet?.id);

  $: activeSectorForHud =
    state.flightMode !== 'ORBIT'
      ? state.flightTelemetry.nearestPlanetSector || currentPlanet?.sector || 'Core-Alpha'
      : targetPlanet?.sector || currentPlanet?.sector || 'Core-Alpha';

  $: hudSectorMapStatus = getSectorMapStatus(state.user?.unlockedMaps, activeSectorForHud, nowMs);
  $: hudSectorMapSpec =
    state.shopCatalog.find((it) => it.category === 'MAP' && it.target_sector === activeSectorForHud) ||
    state.shopCatalog.find((it) => it.id === 'map_core_alpha');
  $: emergencyPriceHud = hudSectorMapSpec
    ? hudSectorMapSpec.emergency_price || hudSectorMapSpec.base_price * 10
    : 8000;
  $: emergencyRemainingHud = Math.max(0, 3 - Number(state.user?.emergencyMapUsed || 0));

  $: hasAnyUnlockedMap =
    hudSectorMapStatus.active ||
    Object.values(state.user?.unlockedMaps || {}).some((exp) => Number(exp) > nowMs) ||
    Object.entries(state.user?.inventory || {}).some(
      ([id, cnt]) => id.startsWith('map_') && Number(cnt) > 0
    );

  $: targetDistanceKm = targetPlanet
    ? Math.round(
        Math.sqrt(
          Math.pow(targetPlanet.x - (state.flightTelemetry?.x || 0), 2) +
            Math.pow(targetPlanet.y - (state.flightTelemetry?.y || 0), 2) +
            Math.pow(targetPlanet.z - (state.flightTelemetry?.z || 0), 2)
        )
      )
    : 0;

  $: estManualSec = Math.max(
    2,
    Math.ceil(targetDistanceKm / (34 * Number(state.user?.flightSpeedBonus || 1)))
  );
  $: estAiSec = Math.max(
    2,
    Math.ceil(targetDistanceKm / (42 * Number(state.user?.flightSpeedBonus || 1)))
  );

  function toRadarCoord(val: number): number {
    return Math.max(10, Math.min(190, 100 + (val / 1450) * 88));
  }

  function handleDestinationChange(planetId: string) {
    gameStore.update((s) => ({ ...s, selectedTargetPlanetId: planetId }));
    if (engine) engine.setTargetPlanet(planetId);
  }

  function handlePrimaryLaunch() {
    const destId = targetPlanet?.id || state.planets[1]?.id || state.planets[0]?.id;
    if (!destId) return;
    if ((state.user?.ai_agent_uses || 0) > 0) {
      startAiAutopilotFlight(destId);
    } else {
      startManualFlightTo(destId);
    }
  }

  $: if (engine && state.user?.flightSpeedBonus) {
    engine.setSpeedMultiplier(Number(state.user.flightSpeedBonus));
  }

  $: if (engine && state.planets.length > 0) {
    engine.syncPlanets(state.planets);
  }

  $: if (engine && (state.otherPlayers.length > 0 || state.pirates.length > 0)) {
    engine.syncMultiplayerEntities(state.otherPlayers, state.pirates);
  }

  onMount(async () => {
    soundEngine.setOnTrackChange((trackName) => {
      gameStore.update((s) => ({ ...s, currentBgmName: trackName }));
    });

    clockTimer = setInterval(() => {
      nowMs = Date.now();
    }, 1000);

    engine = new SpaceEngine3D(
      viewportEl,
      (planetId) => {
        gameStore.update((s) => ({ ...s, selectedTargetPlanetId: planetId }));
        const clicked = $gameStore.planets.find((p) => p.id === planetId);
        if (clicked) {
          addGameLog(`🎯 [Target Locked] ${clicked.name_ko} (${clicked.sector})`);
        }
      },
      (telemetry) => {
        gameStore.update((s) => ({
          ...s,
          flightTelemetry: telemetry,
          flightMode: engine ? engine.getFlightMode() : s.flightMode,
        }));
      },
      {
        onHazardCollision: (hazardType, colliderName) => {
          handleHazardCollision(hazardType, colliderName);
        },
        onPirateEncounter: (_pirateId) => {
          soundEngine.playSfx('ALARM');
          gameStore.update((s) => ({ ...s, activeModal: 'COMBAT' }));
          addGameLog(`🏴‍☠️ [해적 조우 경보!] 우주해적 함대와 조우했습니다! 단독 또는 협동 공격을 개시하세요!`);
        },
        onAiAutopilotArrive: (planetId) => {
          soundEngine.playSfx('AI_AGENT');
          handleManualDock(planetId);
        },
      }
    );

    await fetchUniverse();
    await syncMultiplayerState();

    if ($gameStore.planets.length > 0 && engine) {
      engine.syncPlanets($gameStore.planets);
      engine.warpToPlanet($gameStore.planets[0]);
    }

    mpSyncTimer = setInterval(() => {
      const u = $gameStore.user;
      const tel = $gameStore.flightTelemetry;
      syncMultiplayerState(u?.id, tel.x, tel.y, tel.z);
    }, 3000);
  });

  onDestroy(() => {
    clearInterval(clockTimer);
    clearInterval(mpSyncTimer);
    engine?.destroy();
  });

  function applyLoggedInUser(user: any) {
    if (user.settings?.lang) {
      currentLang.set(user.settings.lang);
    }
    bgmEnabled = user.settings?.bgmEnabled ?? true;
    soundEngine.applySettings(user.settings || {});
    soundEngine.startRandomSpaceBgm();

    gameStore.update((s) => ({ ...s, user, activeModal: null }));
    const curP = $gameStore.planets.find((p) => p.id === user.current_planet_id);
    if (curP && engine) {
      engine.warpToPlanet(curP);
      fetchPlanetShop(curP.id);
    }
    fetchFriendsList(user.id);
    fetchUserQuests(user.id);
    syncMultiplayerState(user.id);
    addGameLog(`🚀 ${user.pilot_name} (Lv.${user.pilot_level}) connected aboard ${user.ship_name}`);
  }

  async function handleGoogleLogin(detail: { email: string; name: string }) {
    const res = await fetch(`${API_BASE}/auth/google-sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detail),
    });
    const data = await res.json();
    if (data.user) {
      applyLoggedInUser(data.user);
    }
  }

  async function handlePasswordLogin(detail: { email: string; password: string }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detail),
    });
    const data = await res.json();
    if (data.user) {
      applyLoggedInUser(data.user);
    } else if (data.error) {
      alert(data.error);
    }
  }

  async function handleRegisterPilot(detail: {
    email: string;
    password: string;
    pilotName: string;
    shipName: string;
  }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detail),
    });
    const data = await res.json();
    if (data.user) {
      applyLoggedInUser(data.user);
    } else if (data.error) {
      alert(data.error);
    }
  }

  async function handleHazardCollision(hazardType: string, colliderName: string) {
    if (!state.user) return;
    soundEngine.playSfx('COLLISION');
    const res = await fetch(`${API_BASE}/game/hazard-hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.user.id,
        hazardType,
        colliderName,
      }),
    });
    const data = await res.json();
    if (data.user) {
      const prevLv = state.user.pilot_level;
      gameStore.update((s) => ({ ...s, user: data.user }));
      addGameLog(data.message);
      if (data.user.pilot_level < prevLv) {
        addGameLog(`📉 [자산 감소 레벨 하락!] 총 자산 감소로 파일럿 레벨이 Lv.${prevLv} → Lv.${data.user.pilot_level}로 강등되었습니다!`);
      }
    }
  }

  async function handleWarp(targetPlanetId: string) {
    if (!state.user) return;
    const res = await fetch(`${API_BASE}/game/warp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.user.id, targetPlanetId }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      soundEngine.playSfx('ALARM');
      addGameLog(`❌ ${data.error}`);
      return;
    }
    if (data.user) {
      soundEngine.playSfx('WARP');
      gameStore.update((s) => ({
        ...s,
        user: data.user,
        flightMode: 'ORBIT',
        selectedTargetPlanetId: targetPlanetId,
        activeModal: null,
      }));
      const target = state.planets.find((p) => p.id === targetPlanetId);
      if (target && engine) {
        engine.warpToPlanet(target);
        fetchPlanetShop(target.id);
      }
      addGameLog(data.message);
      await fetchUniverse();
    }
  }

  async function startAiAutopilotFlight(targetPlanetId?: string) {
    if (!state.user || !engine) return;
    const pid = targetPlanetId || state.selectedTargetPlanetId || state.planets[1]?.id;
    const target = state.planets.find((p) => p.id === pid);
    if (!target) return;

    const res = await fetch(`${API_BASE}/game/ai-autopilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.user.id, targetPlanetId: target.id }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      soundEngine.playSfx('ALARM');
      addGameLog(`❌ ${data.error}`);
      return;
    }

    soundEngine.playSfx('AI_AGENT');
    if (data.user) {
      gameStore.update((s) => ({
        ...s,
        user: data.user,
        flightMode: 'AI_AUTOPILOT',
        selectedTargetPlanetId: target.id,
        activeModal: null,
      }));
      engine.startAiAutopilotTo(target);
      addGameLog(data.message);
    }
  }

  function startManualFlightTo(targetPlanetId?: string) {
    if (!engine) return;
    const pid = targetPlanetId || state.selectedTargetPlanetId || state.planets[1]?.id;
    const target = state.planets.find((p) => p.id === pid);
    engine.setFlightMode('MANUAL');
    if (target) {
      engine.alignShipToPlanet(target);
      gameStore.update((s) => ({
        ...s,
        flightMode: 'MANUAL',
        selectedTargetPlanetId: target.id,
        activeModal: null,
      }));
      addGameLog(
        `🛸 [직접 운행 시작] '${target.name_ko}' 방향으로 출발합니다! 소행성 파편·우주쓰레기·태양풍·타 유저 함선과의 충돌을 주의하세요!`
      );
    }
  }

  async function handleManualDock(planetIdToDock?: string) {
    if (!state.user) return;
    const pid = planetIdToDock || state.flightTelemetry.nearestPlanetId || currentPlanet?.id;
    if (!pid) return;

    const res = await fetch(`${API_BASE}/game/dock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.user.id, targetPlanetId: pid }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      addGameLog(`❌ ${data.error}`);
      return;
    }
    if (data.user) {
      const dockedPlanet = state.planets.find((p) => p.id === pid);
      if (dockedPlanet && engine) {
        engine.warpToPlanet(dockedPlanet);
        fetchPlanetShop(dockedPlanet.id);
      }
      gameStore.update((s) => ({
        ...s,
        user: data.user,
        flightMode: 'ORBIT',
      }));
      addGameLog(data.message);
      await fetchUniverse();
      await fetchUserQuests(state.user.id);
    }
  }

  async function handleEmergencyMapBuy(sector: string) {
    if (!state.user) return;
    const res = await fetch(`${API_BASE}/game/shop/emergency-map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.user.id, sector }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      addGameLog(`❌ ${data.error}`);
      return;
    }
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      addGameLog(data.message);
    }
  }

  async function handleMineOrbital() {
    if (!state.user || !currentPlanet) return;
    const sortedMarkets = [...currentMarkets].sort((a, b) => b.stock - a.stock);
    const targetResId = sortedMarkets[0]?.resource_id || state.resources[0]?.id;
    if (!targetResId) return;

    soundEngine.playSfx('LASER');
    if (engine) engine.fireMiningLaser(currentPlanet);

    const res = await fetch(`${API_BASE}/game/mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.user.id,
        resourceId: targetResId,
        comboBonus: 1.25,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      addGameLog(`❌ ${data.error}`);
      return;
    }
    if (data.user) {
      const prevLv = state.user.pilot_level;
      gameStore.update((s) => ({ ...s, user: data.user }));
      addGameLog(`⛏️ [궤도 채굴] ${data.resourceName} +${data.minedAmount} 채집 완료!`);
      if (data.user.pilot_level > prevLv) {
        soundEngine.playSfx('VICTORY');
        addGameLog(`🎉 [자산 증가 레벨 승급!] 파일럿 레벨이 Lv.${prevLv} → Lv.${data.user.pilot_level}로 상승했습니다!`);
      }
      await fetchUserQuests(state.user.id);
    }
  }

  function changeLanguage(code: string) {
    currentLang.set(code);
    if (state.user?.id) {
      saveUserSettingsToDb(state.user.id, { lang: code });
    }
  }

  function toggleBgm() {
    bgmEnabled = !bgmEnabled;
    if (state.user?.id) {
      saveUserSettingsToDb(state.user.id, { bgmEnabled });
    } else {
      soundEngine.applySettings({ bgmEnabled });
    }
  }

  function holdControl(code: string, active: boolean) {
    engine?.setControlInput(code, active);
  }

  function closeActiveModal() {
    gameStore.update((s) => ({ ...s, activeModal: null }));
  }
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === 'Escape' && state.activeModal) {
      closeActiveModal();
    }
  }}
/>

<div class="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
  <!-- 3D Space WebGL Canvas -->
  <div bind:this={viewportEl} class="absolute inset-0 z-0"></div>

  <!-- Show Landing Page when not logged in -->
  {#if !state.user}
    <LandingPage
      on:googleLogin={(e) => handleGoogleLogin(e.detail)}
      on:passwordLogin={(e) => handlePasswordLogin(e.detail)}
      on:registerPilot={(e) => handleRegisterPilot(e.detail)}
    />
  {/if}

  <!-- Top HUD Bar -->
  <header
    class="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900/90 backdrop-blur-md border-b border-cyan-500/30"
  >
    <div class="flex flex-wrap items-center gap-2">
      <h1 class="font-['Orbitron'] text-base md:text-lg font-bold text-cyan-400 tracking-wider">
        {$t.appTitle}
      </h1>

      {#if currentPlanet}
        <span
          class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-500/40"
        >
          🪐 {localName(currentPlanet, $currentLang)} · {currentPlanet.sector}
        </span>
      {/if}

      <button
        type="button"
        on:click={() => {
          if (state.flightMode !== 'ORBIT') {
            handleManualDock(currentPlanet?.id);
          } else {
            startManualFlightTo();
          }
        }}
        class="px-2.5 py-0.5 rounded-full text-xs font-bold border transition {state.flightMode === 'MANUAL'
          ? 'bg-emerald-600 text-white border-emerald-300 animate-pulse'
          : state.flightMode === 'AI_AUTOPILOT'
          ? 'bg-sky-600 text-white border-sky-300 animate-pulse'
          : 'bg-slate-800 text-emerald-300 border-emerald-500/40'}"
      >
        {state.flightMode === 'MANUAL'
          ? $t.modeManual
          : state.flightMode === 'AI_AUTOPILOT'
          ? $t.modeAiPilot
          : $t.modeOrbit}
      </button>

      <!-- BGM Player & Language Switcher (Persisted to DB) -->
      <div class="hidden xl:flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-[11px]">
        <button type="button" on:click={toggleBgm} class="text-cyan-300 font-bold hover:text-white">
          {bgmEnabled ? '🔊' : '🔇'} {state.currentBgmName}
        </button>
        <button
          type="button"
          on:click={() => soundEngine.nextRandomTrack()}
          class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 ml-1"
          title="Play another random Space BGM track"
        >
          ⏭️
        </button>
      </div>

      <div class="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800">
        {#each locales as loc}
          <button
            type="button"
            on:click={() => changeLanguage(loc.code)}
            class="px-1.5 py-0.5 rounded text-[10px] font-bold {$currentLang === loc.code
              ? 'bg-cyan-600 text-white'
              : 'text-slate-400 hover:text-white'}"
          >
            {loc.code.toUpperCase()}
          </button>
        {/each}
      </div>
    </div>

    <!-- Right Stats: Dynamic Wealth Level + Credits + Hull + Fuel + Warp Cells + AI Uses + Admin Menu -->
    {#if state.user}
      <div class="flex flex-wrap items-center gap-2.5 text-xs">
        <span
          class="px-2.5 py-0.5 rounded-lg bg-amber-950 text-amber-300 border border-amber-400/60 font-extrabold"
          title="Asset-based Pilot Level (Rises and drops with your Net Worth!)"
        >
          🎖️ {$t.hudLevel}{state.user.pilot_level} ({$t.hudNetWorth}: {(state.user.net_worth || state.user.credits).toLocaleString()} CR)
        </span>

        <span class="text-amber-400 font-bold">💰 {state.user.credits.toLocaleString()} CR</span>
        <span class="text-emerald-400">🛡️ {state.user.hull}/{state.user.max_hull}</span>
        <span class="text-sky-400">⚡ {state.user.fuel}/{state.user.max_fuel}</span>

        <span
          class="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40 font-bold"
          title="Purchased Warp Jump Cells"
        >
          🌀 {$t.hudWarpCells}: {state.user.warp_tickets || 0}
        </span>

        <span
          class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold"
          title="Remaining AI Autopilot Agent Uses"
        >
          🤖 {$t.hudAiAgent}: {state.user.ai_agent_uses || 0} {$t.usesUnit}
        </span>

        <!-- Superadmin Menu (Only shown for Superadmin!) -->
        {#if state.user.isSuperAdmin}
          <button
            type="button"
            on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'ADMIN' }))}
            class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow"
          >
            {$t.btnAdmin}
          </button>
        {/if}

        <button
          type="button"
          on:click={() => gameStore.update((s) => ({ ...s, user: null, activeModal: null }))}
          class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
        >
          {$t.btnLogout}
        </button>
      </div>
    {/if}
  </header>

  <!-- Left HUD: Navigation & Sector Map Control + Manual / AI Agent / Warp Selector -->
  <aside
    class="absolute top-14 left-3 z-10 w-80 bg-slate-900/85 backdrop-blur-md border border-cyan-500/35 rounded-2xl p-3 space-y-2.5 shadow-xl max-h-[calc(100vh-10.5rem)] flex flex-col"
  >
    <div class="flex items-center justify-between border-b border-slate-800 pb-2">
      <div>
        <h2 class="text-xs font-bold text-cyan-300 uppercase tracking-wider">{$t.navHeader}</h2>
        <div class="text-[10px] text-slate-400">
          🟢 {$t.hudOnlinePilots}: {state.otherPlayers.length + 1} · 🏴‍☠️ {$t.hudPirates}: {state.pirates.length}
        </div>
      </div>
      <button
        type="button"
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'MAP' }))}
        class="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold"
      >
        {$t.btnStarMap}
      </button>
    </div>

    <!-- Emergency Map Purchase Warning Banner when Current/Target Sector Map is Missing -->
    {#if !hudSectorMapStatus.active}
      <div class="p-2.5 rounded-xl bg-rose-950/85 border border-rose-500/60 space-y-1.5">
        <div class="flex items-center justify-between text-[11px] font-bold text-rose-300">
          <span>🚨 [{activeSectorForHud}] {$t.mapLockedAlert}</span>
          <span>{emergencyRemainingHud}/3 {$t.leftUnit}</span>
        </div>
        <div class="flex gap-1.5">
          <button
            type="button"
            on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
            class="flex-1 py-1 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[10px] font-bold"
          >
            {$t.shopShortBtn} ({(hudSectorMapSpec?.base_price || 800).toLocaleString()} CR)
          </button>
          <button
            type="button"
            on:click={() => handleEmergencyMapBuy(activeSectorForHud)}
            disabled={emergencyRemainingHud <= 0}
            class="flex-1 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white text-[10px] font-bold"
          >
            🚨 10x ({emergencyPriceHud.toLocaleString()} CR)
          </button>
        </div>
      </div>
    {:else}
      <div class="px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-between text-[11px]">
        <span class="text-emerald-300 font-semibold">🟢 [{activeSectorForHud}] {$t.mapActiveLabel}</span>
        <span class="font-mono text-emerald-400 font-bold">{formatDuration(hudSectorMapStatus.remainingSec)}</span>
      </div>
    {/if}

    <!-- Planet List with Manual Flight / AI Autopilot / Paid Warp Buttons -->
    <div class="space-y-1.5 overflow-y-auto pr-1 flex-1">
      {#each state.planets as p (p.id)}
        {@const pSectorStatus = getSectorMapStatus(state.user?.unlockedMaps, p.sector, nowMs)}
        {@const isCurrent = p.id === currentPlanet?.id}
        {@const isTarget = p.id === state.selectedTargetPlanetId}

        <div
          class="p-2.5 rounded-xl border transition {isTarget
            ? 'bg-cyan-950/70 border-cyan-400'
            : isCurrent
            ? 'bg-slate-800/90 border-emerald-500/50'
            : 'bg-slate-900/75 border-slate-800 hover:border-slate-700'}"
        >
          <div class="flex items-center justify-between">
            <button
              type="button"
              on:click={() => {
                gameStore.update((s) => ({ ...s, selectedTargetPlanetId: p.id }));
                if (engine) engine.setTargetPlanet(p.id);
              }}
              class="text-left flex items-center gap-1.5 truncate"
            >
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:{p.color_primary}"></span>
              <span class="font-bold text-xs text-white truncate">{localName(p, $currentLang)}</span>
              <span class="text-[10px] text-slate-400">({p.sector})</span>
            </button>

            {#if isCurrent && state.flightMode === 'ORBIT'}
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold">{$t.dockedBadge}</span>
            {:else if !pSectorStatus.active}
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300">{$t.lockedBadge}</span>
            {:else}
              <span class="text-[10px] text-cyan-300">Lv.{p.danger_level}</span>
            {/if}
          </div>

          <div class="mt-2 grid grid-cols-3 gap-1">
            <button
              type="button"
              on:click={() => startManualFlightTo(p.id)}
              class="py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[10px] font-bold"
            >
              {$t.flyManualBtn}
            </button>
            <button
              type="button"
              on:click={() => startAiAutopilotFlight(p.id)}
              class="py-1 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-[10px] font-bold"
            >
              {$t.flyAiBtn} ({state.user?.ai_agent_uses || 0})
            </button>
            <button
              type="button"
              on:click={() => handleWarp(p.id)}
              class="py-1 rounded-lg bg-purple-600/90 hover:bg-purple-500 text-white text-[10px] font-bold"
            >
              {$t.flyWarpBtn} ({state.user?.warp_tickets || 0})
            </button>
          </div>
        </div>
      {/each}
    </div>
  </aside>

  <!-- Right HUD: Prominent Launch (출항) Control + Live 2D Space Navigation Map Radar + Owned Items & Logs -->
  <aside
    class="flex flex-col absolute top-14 right-3 z-10 w-80 md:w-88 bg-slate-900/90 backdrop-blur-md border border-cyan-500/45 rounded-2xl p-3 space-y-2.5 shadow-2xl max-h-[calc(100vh-10.5rem)] overflow-y-auto"
  >
    <!-- 1. Prominent Right-Side Launch (출항: 수동운행 / AI 자동운행) Control Panel -->
    <div class="p-3 rounded-2xl bg-gradient-to-br from-slate-950 via-cyan-950/60 to-emerald-950/50 border-2 border-emerald-400/60 shadow-lg space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-extrabold text-emerald-300 tracking-wide">
          {$t.launchMenuTitle}
        </span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-500/40">
          🤖 AI: {state.user?.ai_agent_uses || 0}{$t.usesUnit}
        </span>
      </div>

      <!-- Destination Planet Selector -->
      <div class="space-y-1">
        <label for="hud-dest-select" class="block text-[11px] font-bold text-cyan-200">
          {$t.selectDestLabel}
        </label>
        <select
          id="hud-dest-select"
          value={targetPlanet?.id || ''}
          on:change={(e) => handleDestinationChange(e.currentTarget.value)}
          class="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-cyan-500/50 text-xs font-bold text-white"
        >
          {#each state.planets as p (p.id)}
            {@const dx = Math.round(p.x - (state.flightTelemetry?.x || 0))}
            {@const dy = Math.round(p.y - (state.flightTelemetry?.y || 0))}
            {@const dz = Math.round(p.z - (state.flightTelemetry?.z || 0))}
            {@const dKm = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz))}
            <option value={p.id}>
              🎯 {localName(p, $currentLang)} ({p.sector}) — {dKm}km
            </option>
          {/each}
        </select>
      </div>

      <!-- Distance & Distance-Proportional Travel Time Display -->
      {#if targetPlanet}
        <div class="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] font-mono">
          <span class="text-cyan-300 font-bold">
            📏 {$t.distLabel}: {targetDistanceKm} km
          </span>
          <span class="text-amber-300 font-bold">
            ⏱️ {$t.estTravelTimeLabel}: ~{(state.user?.ai_agent_uses || 0) > 0 ? estAiSec : estManualSec}{$t.secUnit}
          </span>
        </div>
      {/if}

      <!-- Live Flight Status when Flying (Manual or AI Autopilot) -->
      {#if state.flightMode !== 'ORBIT'}
        <div class="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-400/60 space-y-1.5">
          <div class="flex items-center justify-between text-xs font-extrabold text-emerald-300">
            <span class="animate-pulse">
              {state.flightMode === 'AI_AUTOPILOT' ? $t.modeAiPilot : $t.modeManual}
            </span>
            <span class="font-mono text-amber-300">
              ⏱️ {$t.etaRemainingLabel}: {state.flightTelemetry.etaSeconds || estManualSec}{$t.secUnit}
            </span>
          </div>
          <div class="flex items-center justify-between text-[11px] font-mono text-slate-200">
            <span>{$t.spdLabel}: {state.flightTelemetry.speed} km/s</span>
            <span>🎯 {targetPlanet ? localName(targetPlanet, $currentLang) : state.flightTelemetry.nearestPlanetName} ({state.flightTelemetry.targetDistance}km)</span>
          </div>
          <button
            type="button"
            on:click={() =>
              handleManualDock(
                state.flightTelemetry.canDock
                  ? state.flightTelemetry.nearestPlanetId || currentPlanet?.id
                  : currentPlanet?.id
              )}
            class="w-full py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow"
          >
            {state.flightTelemetry.canDock
              ? `${$t.dockNowBtn} [${state.flightTelemetry.nearestPlanetName}]`
              : $t.modeOrbit}
          </button>
        </div>
      {/if}

      <!-- Large Prominent Launch Action Buttons -->
      <div class="grid grid-cols-1 gap-1.5">
        {#if (state.user?.ai_agent_uses || 0) > 0}
          <button
            type="button"
            on:click={() => startAiAutopilotFlight(targetPlanet?.id)}
            class="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg border border-white/30 transition transform active:scale-95"
          >
            {$t.startAiFlightBtn} ({state.user?.ai_agent_uses}{$t.usesUnit} · ~{estAiSec}{$t.secUnit})
          </button>
        {/if}

        <button
          type="button"
          on:click={() => startManualFlightTo(targetPlanet?.id)}
          class="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg border border-emerald-300/40 transition transform active:scale-95"
        >
          {$t.startManualFlightBtn} (~{estManualSec}{$t.secUnit})
        </button>
      </div>
    </div>

    <!-- 2. Live 2D Visual Space Navigation Map Radar (Displayed when player owns a Space Map) -->
    <div class="p-2.5 rounded-2xl bg-slate-950/95 border border-cyan-500/40 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-cyan-300">{$t.spaceMapHudTitle}</span>
        <button
          type="button"
          on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'MAP' }))}
          class="text-[10px] font-bold text-cyan-400 hover:underline"
        >
          {$t.btnStarMap}
        </button>
      </div>

      {#if hasAnyUnlockedMap}
        <div class="relative flex flex-col items-center">
          <svg
            viewBox="0 0 200 200"
            class="w-full max-w-[220px] aspect-square rounded-xl bg-slate-950 border border-slate-800 shadow-inner"
          >
            <!-- Sector Radar Grid Circles -->
            <circle cx="100" cy="100" r="30" fill="none" stroke="#1e293b" stroke-dasharray="2 2" />
            <circle cx="100" cy="100" r="60" fill="none" stroke="#1e293b" stroke-dasharray="2 2" />
            <circle cx="100" cy="100" r="88" fill="none" stroke="#1e293b" stroke-dasharray="2 2" />
            <line x1="100" y1="4" x2="100" y2="196" stroke="#0f172a" />
            <line x1="4" y1="100" x2="196" y2="100" stroke="#0f172a" />

            <!-- Central Sun -->
            <circle cx="100" cy="100" r="4" fill="#fbbf24" />

            <!-- Dashed Navigation Guide Line from Player Ship to Destination Planet -->
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
                stroke-width="1.6"
                stroke-dasharray="4 2"
              />
            {/if}

            <!-- Planets on Space Map (Click to select destination) -->
            {#each state.planets as mp (mp.id)}
              {@const secActive =
                getSectorMapStatus(state.user?.unlockedMaps, mp.sector, nowMs).active ||
                Boolean(state.user?.inventory?.['map_all_galaxy'])}
              {#if secActive || mp.id === currentPlanet?.id || mp.id === targetPlanet?.id}
                {@const px = toRadarCoord(mp.x)}
                {@const py = toRadarCoord(mp.z)}
                {@const isDest = mp.id === targetPlanet?.id}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <g
                  class="cursor-pointer"
                  on:click={() => handleDestinationChange(mp.id)}
                >
                  {#if isDest}
                    <circle
                      cx={px}
                      cy={py}
                      r="8.5"
                      fill="none"
                      stroke="#f59e0b"
                      stroke-width="1.4"
                      stroke-dasharray="2 2"
                    />
                  {/if}
                  <circle
                    cx={px}
                    cy={py}
                    r={isDest ? 4.5 : 3.2}
                    fill={mp.color_primary}
                    stroke="#ffffff"
                    stroke-width="0.7"
                  />
                  <text
                    x={px + 5}
                    y={py + 2.5}
                    fill={isDest ? '#fde68a' : '#94a3b8'}
                    font-size="6.8"
                    font-weight="bold"
                  >
                    {isDest ? '🎯' : ''}{localName(mp, $currentLang)}
                  </text>
                </g>
              {/if}
            {/each}

            <!-- Player Spaceship Marker & Heading Vector -->
            {#if state.flightTelemetry}
              {@const sx = toRadarCoord(state.flightTelemetry.x)}
              {@const sy = toRadarCoord(state.flightTelemetry.z)}
              <g transform="translate({sx}, {sy})">
                <circle r="4" fill="#10b981" stroke="#ffffff" stroke-width="1.1" />
                <text x="-10" y="-6" fill="#6ee7b7" font-size="6.8" font-weight="bold">
                  {$t.mapShipLabel}
                </text>
              </g>
            {/if}
          </svg>
          <div class="text-[10px] text-cyan-300 text-center mt-1 font-medium">
            {$t.mapSteerHint}
          </div>
        </div>
      {:else}
        <div class="p-3 rounded-xl bg-rose-950/60 border border-dashed border-rose-500/50 text-center space-y-1.5">
          <div class="text-xs font-bold text-rose-300">{$t.mapNotOwnedTitle}</div>
          <p class="text-[10px] text-slate-300 leading-relaxed">{$t.mapNotOwnedDesc}</p>
          <button
            type="button"
            on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
            class="w-full py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-bold"
          >
            {$t.buyMapNowBtn} ({(hudSectorMapSpec?.base_price || 800).toLocaleString()} CR)
          </button>
        </div>
      {/if}
    </div>

    <!-- 3. Owned Items Quick Bar -->
    <div class="border-t border-slate-800 pt-2">
      <div class="flex items-center justify-between mb-1.5">
        <h3 class="text-xs font-bold text-fuchsia-300">{$t.ownedItemsHeader}</h3>
        <button
          type="button"
          on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
          class="text-[11px] text-cyan-300 hover:underline"
        >
          {$t.shopLink}
        </button>
      </div>

      <div class="grid grid-cols-4 gap-1.5">
        {#each Object.entries(state.user?.inventory || {}).slice(0, 8) as [itemId, count]}
          {@const spec = state.shopCatalog.find((s) => s.id === itemId)}
          {#if spec && Number(count) > 0}
            {@const lvStyle = getItemLevelStyle(spec.level)}
            <button
              type="button"
              on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
              title="{localName(spec, $currentLang)} ({lvStyle.label}) - {spec.effect_summary}"
              class="relative aspect-square rounded-xl overflow-hidden bg-slate-950 p-0.5 {lvStyle.borderClass}"
            >
              <img src={spec.image_url} alt={localName(spec, $currentLang)} class="w-full h-full object-cover rounded-lg" />
              <span
                class="absolute bottom-0.5 right-0.5 px-1 rounded bg-slate-950/90 text-[9px] font-bold {lvStyle.textClass}"
              >
                x{count}
              </span>
            </button>
          {/if}
        {:else}
          <div class="col-span-4 py-1.5 text-center text-[10px] text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800">
            {$t.emptyInventoryHint}
          </div>
        {/each}
      </div>
    </div>

    <!-- 4. Real-time Game Log Feed -->
    <div class="border-t border-slate-800 pt-2">
      <div class="text-xs font-bold text-cyan-300 mb-1">{$t.gameLogHeader}</div>
      <div class="space-y-1 overflow-y-auto text-[11px] text-slate-300 font-mono pr-1 max-h-28">
        {#each state.logs as log}
          <div class="py-1 px-2 rounded bg-slate-950/70 border-l-2 border-cyan-500">{log}</div>
        {:else}
          <div class="text-slate-500 text-xs">{$t.waitingTelemetry}</div>
        {/each}
      </div>
    </div>
  </aside>

  <!-- Center-Bottom Direct Piloting Flight Cockpit & Facility Action Bar -->
  <footer class="absolute bottom-3 inset-x-3 z-10 flex flex-col items-center gap-2 pointer-events-none">
    <!-- Direct Flight Cockpit Telemetry & Controls -->
    <div
      class="pointer-events-auto flex flex-wrap items-center justify-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-emerald-500/45 shadow-2xl"
    >
      <div class="flex items-center gap-3 text-xs font-mono pr-2 border-r border-slate-700">
        <div>
          <span class="text-slate-400">{$t.posLabel}:</span>
          <strong class="text-cyan-300">
            ({state.flightTelemetry.x}, {state.flightTelemetry.y}, {state.flightTelemetry.z})
          </strong>
        </div>
        <div>
          <span class="text-slate-400">{$t.spdLabel}:</span>
          <strong class="text-emerald-400">{state.flightTelemetry.speed} km/s</strong>
        </div>
        <div>
          <span class="text-slate-400">{$t.nearLabel}:</span>
          <strong class="text-amber-300">
            {state.flightTelemetry.nearestPlanetName} ({state.flightTelemetry.nearestDistance}km)
          </strong>
        </div>
        {#if state.flightMode !== 'ORBIT'}
          <div>
            <span class="text-slate-400">⏱️ {$t.etaRemainingLabel}:</span>
            <strong class="text-emerald-300">{state.flightTelemetry.etaSeconds}{$t.secUnit}</strong>
          </div>
        {/if}
      </div>

      <!-- On-Screen Manual Flight Thruster Controls -->
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          on:mousedown={() => holdControl('KeyA', true)}
          on:mouseup={() => holdControl('KeyA', false)}
          on:mouseleave={() => holdControl('KeyA', false)}
          class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700"
        >
          ◀ A
        </button>
        <button
          type="button"
          on:mousedown={() => holdControl('KeyW', true)}
          on:mouseup={() => holdControl('KeyW', false)}
          on:mouseleave={() => holdControl('KeyW', false)}
          class="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-bold text-white"
        >
          {$t.thrustBtn}
        </button>
        <button
          type="button"
          on:mousedown={() => holdControl('KeyS', true)}
          on:mouseup={() => holdControl('KeyS', false)}
          on:mouseleave={() => holdControl('KeyS', false)}
          class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700"
        >
          ▼ S
        </button>
        <button
          type="button"
          on:mousedown={() => holdControl('KeyD', true)}
          on:mouseup={() => holdControl('KeyD', false)}
          on:mouseleave={() => holdControl('KeyD', false)}
          class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700"
        >
          ▶ D
        </button>
        <button
          type="button"
          on:mousedown={() => holdControl('BOOST', true)}
          on:mouseup={() => holdControl('BOOST', false)}
          on:mouseleave={() => holdControl('BOOST', false)}
          class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white"
        >
          🔥 Shift
        </button>
        {#if targetPlanet}
          <button
            type="button"
            on:click={() => startManualFlightTo(targetPlanet.id)}
            class="px-2.5 py-1 rounded-lg bg-cyan-800 hover:bg-cyan-700 text-xs font-bold text-cyan-200"
          >
            {$t.alignBtn} [{localName(targetPlanet, $currentLang)}]
          </button>
          <button
            type="button"
            on:click={() => startAiAutopilotFlight(targetPlanet.id)}
            class="px-2.5 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-xs font-bold text-white"
          >
            {$t.flyAiBtn} ({state.user?.ai_agent_uses || 0})
          </button>
        {/if}
      </div>

      {#if state.flightMode !== 'ORBIT' && state.flightTelemetry.canDock}
        <button
          type="button"
          on:click={() => handleManualDock(state.flightTelemetry.nearestPlanetId || undefined)}
          class="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg animate-bounce"
        >
          {$t.dockNowBtn} [{state.flightTelemetry.nearestPlanetName}]
        </button>
      {/if}
    </div>

    <!-- Main Planetary Facilities & Multiplayer Action Dock + Large Right-Side LAUNCH Button -->
    <div
      class="pointer-events-auto flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 shadow-2xl"
    >
      <button
        type="button"
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
        class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold text-xs shadow border border-fuchsia-400/50"
      >
        {$t.btnShop}
      </button>

      <button
        type="button"
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'MAP' }))}
        class="px-3.5 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs"
      >
        {$t.btnStarMap}
      </button>

      <button
        type="button"
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'COMBAT' }))}
        class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow border border-rose-400/50"
      >
        {$t.btnCombat}
      </button>

      <button
        type="button"
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'FRIENDS' }))}
        class="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs"
      >
        {$t.btnFriends} ({state.friends.length})
      </button>

      <button
        type="button"
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'QUESTS' }))}
        class="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
      >
        {$t.btnQuests}
      </button>

      <button
        type="button"
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'TRADE' }))}
        class="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
      >
        {$t.btnTrade}
      </button>

      <button
        type="button"
        on:click={handleMineOrbital}
        class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
      >
        {$t.btnMine}
      </button>

      <button
        type="button"
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'REPAIR' }))}
        class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
      >
        {$t.btnRepair}
      </button>

      <button
        type="button"
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'TAVERN' }))}
        class="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
      >
        {$t.btnTavern}
      </button>

      <!-- Large Prominent Right-Side Launch (출항: 수동운행 / AI 자동운행) Button -->
      <button
        type="button"
        on:click={handlePrimaryLaunch}
        class="ml-2 px-5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-slate-950 font-extrabold text-sm shadow-[0_0_25px_rgba(16,185,129,0.65)] border-2 border-white/60 transition transform hover:scale-105 active:scale-95"
      >
        {$t.launchBigBtn}
        {#if targetPlanet}
          <span class="ml-1 text-xs font-mono">
            [{localName(targetPlanet, $currentLang)} · ~{(state.user?.ai_agent_uses || 0) > 0 ? estAiSec : estManualSec}{$t.secUnit}]
          </span>
        {/if}
      </button>
    </div>
  </footer>

  <!-- Modal Overlay Container (Click backdrop or press ESC or click Close button to exit) -->
  {#if state.activeModal}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      on:click|self={closeActiveModal}
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto"
    >
      {#if state.activeModal === 'SHOP'}
        <ShopModal />
      {:else if state.activeModal === 'MAP'}
        <StarMapModal
          on:warp={(e) => handleWarp(e.detail)}
          on:manualFly={(e) => startManualFlightTo(e.detail)}
          on:aiFly={(e) => startAiAutopilotFlight(e.detail)}
        />
      {:else if state.activeModal === 'COMBAT'}
        <CombatModal
          on:fireLaserAtPirate={(e) => {
            if (engine) {
              engine.fireCombatLaserAt(new THREE.Vector3(e.detail.x, e.detail.y, e.detail.z));
            }
          }}
        />
      {:else if state.activeModal === 'FRIENDS'}
        <FriendsModal />
      {:else if state.activeModal === 'QUESTS'}
        <QuestModal />
      {:else if state.activeModal === 'TRADE'}
        <TradingPostModal />
      {:else if state.activeModal === 'REPAIR'}
        <RepairShopModal />
      {:else if state.activeModal === 'TAVERN'}
        <TavernModal />
      {:else if state.activeModal === 'ADMIN'}
        <AdminModal />
      {/if}
    </div>
  {/if}
</div>
