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
  import { currentLang, getSupportedLocales, t } from './lib/i18n';
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
</script>

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
          🪐 {currentPlanet.name_ko} · {currentPlanet.sector}
        </span>
      {/if}

      <button
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
        <button on:click={toggleBgm} class="text-cyan-300 font-bold hover:text-white">
          {bgmEnabled ? '🔊' : '🔇'} {state.currentBgmName}
        </button>
        <button
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
          🤖 {$t.hudAiAgent}: {state.user.ai_agent_uses || 0}회
        </span>

        <!-- Superadmin Menu (Only shown for Superadmin!) -->
        {#if state.user.isSuperAdmin}
          <button
            on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'ADMIN' }))}
            class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow"
          >
            {$t.btnAdmin}
          </button>
        {/if}

        <button
          on:click={() => gameStore.update((s) => ({ ...s, user: null }))}
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
          🟢 {$t.hudOnlinePilots}: {state.otherPlayers.length + 1} · 🏴‍☠️ Pirates: {state.pirates.length}
        </div>
      </div>
      <button
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
          <span>🚨 [{activeSectorForHud}] Map Locked!</span>
          <span>{emergencyRemainingHud}/3 Left</span>
        </div>
        <div class="flex gap-1.5">
          <button
            on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
            class="flex-1 py-1 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[10px] font-bold"
          >
            🛒 Shop ({(hudSectorMapSpec?.base_price || 800).toLocaleString()} CR)
          </button>
          <button
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
        <span class="text-emerald-300 font-semibold">🟢 [{activeSectorForHud}] Map Active</span>
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
              on:click={() => {
                gameStore.update((s) => ({ ...s, selectedTargetPlanetId: p.id }));
                if (engine) engine.setTargetPlanet(p.id);
              }}
              class="text-left flex items-center gap-1.5 truncate"
            >
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:{p.color_primary}"></span>
              <span class="font-bold text-xs text-white truncate">{p.name_ko}</span>
              <span class="text-[10px] text-slate-400">({p.sector})</span>
            </button>

            {#if isCurrent && state.flightMode === 'ORBIT'}
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold">Docked</span>
            {:else if !pSectorStatus.active}
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300">🔒 Locked</span>
            {:else}
              <span class="text-[10px] text-cyan-300">Lv.{p.danger_level}</span>
            {/if}
          </div>

          <div class="mt-2 grid grid-cols-3 gap-1">
            <button
              on:click={() => startManualFlightTo(p.id)}
              class="py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[10px] font-bold"
              title="Direct manual piloting (Free, watch out for asteroids & pirates!)"
            >
              {$t.flyManualBtn}
            </button>
            <button
              on:click={() => startAiAutopilotFlight(p.id)}
              class="py-1 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-[10px] font-bold"
              title="AI Autopilot Agent (Consumes 1 AI Agent charge - cheaper than Warp!)"
            >
              {$t.flyAiBtn} ({state.user?.ai_agent_uses || 0})
            </button>
            <button
              on:click={() => handleWarp(p.id)}
              class="py-1 rounded-lg bg-purple-600/90 hover:bg-purple-500 text-white text-[10px] font-bold"
              title="Hyperspace Warp (Requires 1 purchased Warp Jump Cell)"
            >
              {$t.flyWarpBtn} ({state.user?.warp_tickets || 0})
            </button>
          </div>
        </div>
      {/each}
    </div>
  </aside>

  <!-- Right HUD: Equipped Items / Pirate Loot Showcase + Nearby Multiplayer Pilots & Logs -->
  <aside
    class="hidden lg:flex flex-col absolute top-14 right-3 z-10 w-80 bg-slate-900/85 backdrop-blur-md border border-cyan-500/35 rounded-2xl p-3 space-y-2.5 shadow-xl max-h-[calc(100vh-10.5rem)]"
  >
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <h3 class="text-xs font-bold text-fuchsia-300">🎒 보유 아이템 & 해적 전리품</h3>
        <button
          on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
          class="text-[11px] text-cyan-300 hover:underline"
        >
          Shop →
        </button>
      </div>

      <div class="grid grid-cols-4 gap-1.5">
        {#each Object.entries(state.user?.inventory || {}).slice(0, 8) as [itemId, count]}
          {@const spec = state.shopCatalog.find((s) => s.id === itemId)}
          {#if spec && Number(count) > 0}
            {@const lvStyle = getItemLevelStyle(spec.level)}
            <button
              on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
              title="{spec.name_ko} ({lvStyle.label}) - {spec.effect_summary}"
              class="relative aspect-square rounded-xl overflow-hidden bg-slate-950 p-0.5 {lvStyle.borderClass}"
            >
              <img src={spec.image_url} alt={spec.name_ko} class="w-full h-full object-cover rounded-lg" />
              <span
                class="absolute bottom-0.5 right-0.5 px-1 rounded bg-slate-950/90 text-[9px] font-bold {lvStyle.textClass}"
              >
                x{count}
              </span>
            </button>
          {/if}
        {:else}
          <div class="col-span-4 py-2 text-center text-[10px] text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800">
            상점 구매 아이템 및 해적 비매품 전리품이 이곳에 표시됩니다.
          </div>
        {/each}
      </div>
    </div>

    <!-- Nearby Multiplayer Users & Active Space Pirates Quick Radar -->
    <div class="border-t border-slate-800 pt-2">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-bold text-emerald-300">🛰️ 주변 항해 유저 & 우주해적</span>
        <button
          on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'COMBAT' }))}
          class="text-[10px] text-rose-400 font-bold hover:underline"
        >
          🏴‍☠️ 교전 관제 →
        </button>
      </div>
      <div class="space-y-1 max-h-28 overflow-y-auto text-[11px]">
        {#each state.otherPlayers.slice(0, 3) as op}
          <div class="flex items-center justify-between px-2 py-1 rounded bg-slate-950/70">
            <span class="text-emerald-300 truncate">🟢 {op.pilot_name} (Lv.{op.pilot_level})</span>
            <span class="text-slate-400 font-mono text-[10px]">({op.x}, {op.z})</span>
          </div>
        {/each}
        {#each state.pirates.slice(0, 2) as pr}
          <button
            on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'COMBAT' }))}
            class="w-full flex items-center justify-between px-2 py-1 rounded bg-rose-950/50 border border-rose-500/30 text-left hover:bg-rose-900/50"
          >
            <span class="text-rose-300 font-bold truncate">🏴‍☠️ {pr.name_ko}</span>
            <span class="text-amber-300 text-[10px]">{pr.reward_credits} CR</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Real-time Game Log Feed -->
    <div class="flex-1 flex flex-col min-h-0 border-t border-slate-800 pt-2">
      <div class="text-xs font-bold text-cyan-300 mb-1">📡 함교 항해·전투 로그</div>
      <div class="space-y-1 overflow-y-auto text-[11px] text-slate-300 font-mono pr-1 max-h-40">
        {#each state.logs as log}
          <div class="py-1 px-2 rounded bg-slate-950/70 border-l-2 border-cyan-500">{log}</div>
        {:else}
          <div class="text-slate-500 text-xs">Waiting for telemetry...</div>
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
          <span class="text-slate-400">POS:</span>
          <strong class="text-cyan-300">
            ({state.flightTelemetry.x}, {state.flightTelemetry.y}, {state.flightTelemetry.z})
          </strong>
        </div>
        <div>
          <span class="text-slate-400">SPD:</span>
          <strong class="text-emerald-400">{state.flightTelemetry.speed} km/s</strong>
        </div>
        <div>
          <span class="text-slate-400">NEAR:</span>
          <strong class="text-amber-300">
            {state.flightTelemetry.nearestPlanetName} ({state.flightTelemetry.nearestDistance}km)
          </strong>
        </div>
      </div>

      <!-- On-Screen Manual Flight Thruster Controls -->
      <div class="flex items-center gap-1.5">
        <button
          on:mousedown={() => holdControl('KeyA', true)}
          on:mouseup={() => holdControl('KeyA', false)}
          on:mouseleave={() => holdControl('KeyA', false)}
          class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700"
        >
          ◀ A
        </button>
        <button
          on:mousedown={() => holdControl('KeyW', true)}
          on:mouseup={() => holdControl('KeyW', false)}
          on:mouseleave={() => holdControl('KeyW', false)}
          class="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-bold text-white"
        >
          ▲ W (Thrust)
        </button>
        <button
          on:mousedown={() => holdControl('KeyS', true)}
          on:mouseup={() => holdControl('KeyS', false)}
          on:mouseleave={() => holdControl('KeyS', false)}
          class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700"
        >
          ▼ S
        </button>
        <button
          on:mousedown={() => holdControl('KeyD', true)}
          on:mouseup={() => holdControl('KeyD', false)}
          on:mouseleave={() => holdControl('KeyD', false)}
          class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700"
        >
          ▶ D
        </button>
        <button
          on:mousedown={() => holdControl('BOOST', true)}
          on:mouseup={() => holdControl('BOOST', false)}
          on:mouseleave={() => holdControl('BOOST', false)}
          class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white"
        >
          🔥 Shift
        </button>
        {#if targetPlanet}
          <button
            on:click={() => startManualFlightTo(targetPlanet.id)}
            class="px-2.5 py-1 rounded-lg bg-cyan-800 hover:bg-cyan-700 text-xs font-bold text-cyan-200"
          >
            🎯 Align [{targetPlanet.name_ko}]
          </button>
          <button
            on:click={() => startAiAutopilotFlight(targetPlanet.id)}
            class="px-2.5 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-xs font-bold text-white"
          >
            🤖 AI Pilot ({state.user?.ai_agent_uses || 0})
          </button>
        {/if}
      </div>

      {#if state.flightMode !== 'ORBIT' && state.flightTelemetry.canDock}
        <button
          on:click={() => handleManualDock(state.flightTelemetry.nearestPlanetId || undefined)}
          class="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg animate-bounce"
        >
          {$t.dockNowBtn} [{state.flightTelemetry.nearestPlanetName}]
        </button>
      {/if}
    </div>

    <!-- Main Planetary Facilities & Multiplayer Action Dock -->
    <div
      class="pointer-events-auto flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 shadow-2xl"
    >
      <button
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'SHOP' }))}
        class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold text-xs shadow border border-fuchsia-400/50"
      >
        {$t.btnShop}
      </button>

      <button
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'MAP' }))}
        class="px-3.5 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs"
      >
        {$t.btnStarMap}
      </button>

      <button
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'COMBAT' }))}
        class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow border border-rose-400/50"
      >
        {$t.btnCombat}
      </button>

      <button
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'FRIENDS' }))}
        class="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs"
      >
        {$t.btnFriends} ({state.friends.length})
      </button>

      <button
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'QUESTS' }))}
        class="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
      >
        {$t.btnQuests}
      </button>

      <button
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'TRADE' }))}
        class="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
      >
        {$t.btnTrade}
      </button>

      <button
        on:click={handleMineOrbital}
        class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
      >
        {$t.btnMine}
      </button>

      <button
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'REPAIR' }))}
        class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
      >
        {$t.btnRepair}
      </button>

      <button
        on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'TAVERN' }))}
        class="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
      >
        {$t.btnTavern}
      </button>
    </div>
  </footer>

  <!-- Modal Overlay Container -->
  {#if state.activeModal}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
    >
      {#if state.activeModal === 'SHOP'}
        <ShopModal />
      {:else if state.activeModal === 'MAP'}
        <StarMapModal
          on:warp={(e) => handleWarp(e.detail)}
          on:manualFly={(e) => startManualFlightTo(e.detail)}
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
        <div class="relative max-w-4xl w-full">
          <button
            on:click={() => gameStore.update((s) => ({ ...s, activeModal: null }))}
            class="absolute top-4 right-4 z-10 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
          >
            {$t.closeBtn}
          </button>
          <TradingPostModal />
        </div>
      {:else if state.activeModal === 'REPAIR'}
        <div class="relative max-w-2xl w-full">
          <button
            on:click={() => gameStore.update((s) => ({ ...s, activeModal: null }))}
            class="absolute top-4 right-4 z-10 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
          >
            {$t.closeBtn}
          </button>
          <RepairShopModal />
        </div>
      {:else if state.activeModal === 'TAVERN'}
        <div class="relative max-w-2xl w-full">
          <button
            on:click={() => gameStore.update((s) => ({ ...s, activeModal: null }))}
            class="absolute top-4 right-4 z-10 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
          >
            {$t.closeBtn}
          </button>
          <TavernModal />
        </div>
      {:else if state.activeModal === 'ADMIN'}
        <div class="relative max-w-4xl w-full">
          <button
            on:click={() => gameStore.update((s) => ({ ...s, activeModal: null }))}
            class="absolute top-4 right-4 z-10 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
          >
            {$t.closeBtn}
          </button>
          <AdminModal />
        </div>
      {/if}
    </div>
  {/if}
</div>
