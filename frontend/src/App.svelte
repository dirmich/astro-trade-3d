<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameStore, fetchUniverse, addGameLog, API_BASE, SUPERUSER_EMAIL } from './lib/stores/gameStore';
  import { SpaceEngine3D } from './lib/three/SpaceScene';

  let viewportEl: HTMLElement;
  let engine: SpaceEngine3D | null = null;
  let emailInput = SUPERUSER_EMAIL;
  let passwordInput = 'AstroAdmin!2026#';

  $: state = $gameStore;
  $: currentPlanet = state.planets.find((p) => p.id === state.user?.current_planet_id) || state.planets[0];
  $: currentMarkets = state.markets.filter((m) => m.planet_id === currentPlanet?.id);

  onMount(async () => {
    engine = new SpaceEngine3D(viewportEl, (planetId) => {
      handleWarp(planetId);
    });
    await fetchUniverse();
    engine.syncPlanets($gameStore.planets);
  });

  onDestroy(() => {
    engine?.destroy();
  });

  async function handleLogin() {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput, password: passwordInput }),
    });
    const data = await res.json();
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user, activeModal: null }));
      addGameLog(`${data.user.pilot_name} 파일럿 접속 완료 (${data.user.ship_name})`);
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
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      const target = state.planets.find((p) => p.id === targetPlanetId);
      if (target && engine) engine.warpToPlanet(target);
      addGameLog(data.message);
      await fetchUniverse();
    }
  }
</script>

<div class="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100">
  <!-- 3D Space WebGL Canvas -->
  <div bind:this={viewportEl} class="absolute inset-0 z-0"></div>

  <!-- Top HUD Bar -->
  <header class="relative z-10 flex items-center justify-between px-6 py-3 bg-slate-900/80 backdrop-blur-md border-b border-cyan-500/30">
    <div class="flex items-center gap-4">
      <h1 class="font-['Orbitron'] text-xl font-bold text-cyan-400 tracking-wider">ASTROTRADE 3D</h1>
      {#if currentPlanet}
        <span class="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
          🪐 {currentPlanet.name_ko} ({currentPlanet.name}) · {currentPlanet.sector}
        </span>
      {/if}
    </div>

    <div class="flex items-center gap-4 text-sm">
      {#if state.user}
        <span class="text-amber-400 font-bold">💰 {state.user.credits.toLocaleString()} CR</span>
        <span class="text-emerald-400">🛡️ 선체 {state.user.hull}/{state.user.max_hull}</span>
        <span class="text-sky-400">⚡ 연료 {state.user.fuel}/{state.user.max_fuel}</span>
        {#if state.user.isSuperAdmin}
          <button
            on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'ADMIN' }))}
            class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs"
          >
            👑 ADMIN 관리 ({SUPERUSER_EMAIL})
          </button>
        {/if}
      {:else}
        <button
          on:click={handleLogin}
          class="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs"
        >
          슈퍼유저 접속 ({SUPERUSER_EMAIL})
        </button>
      {/if}
    </div>
  </header>
</div>
