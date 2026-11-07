<script lang="ts">
  import { gameStore, fetchUniverse, addGameLog, API_BASE, SUPERUSER_EMAIL } from '../stores/gameStore';

  $: state = $gameStore;
  let newPlanetName = 'Persephone Prime';
  let newPlanetNameKo = '페르세포네 프라임';
  let newPlanetBiome = 'CRYSTAL';
  let simUserCount = 4;

  async function handleSimulateUsers() {
    const res = await fetch(`${API_BASE}/admin/simulate-users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail: SUPERUSER_EMAIL, count: simUserCount }),
    });
    const data = await res.json();
    addGameLog(`[ADMIN] ${data.message}`);
    await fetchUniverse();
  }

  async function handleAddPlanet() {
    const res = await fetch(`${API_BASE}/admin/planets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminEmail: SUPERUSER_EMAIL,
        name: newPlanetName,
        nameKo: newPlanetNameKo,
        biome: newPlanetBiome,
        hasRings: true,
      }),
    });
    const data = await res.json();
    addGameLog(`[ADMIN] ${data.message}`);
    await fetchUniverse();
  }
</script>

<div class="p-6 bg-slate-900/95 border border-rose-500/50 rounded-2xl max-w-3xl w-full space-y-4">
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-bold text-rose-400">👑 슈퍼유저 통합 관리 콘솔 ({SUPERUSER_EMAIL})</h2>
    <span class="text-xs px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-500/40">
      현재 행성: {state.planets.length}개 / 등록 유저: {state.totalUsers}명
    </span>
  </div>

  <div class="grid grid-cols-2 gap-4">
    <div class="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
      <h3 class="font-bold text-sm text-cyan-300">유저 증가 시뮬레이션 & 자동 행성 추가</h3>
      <p class="text-xs text-slate-400">사용자 수가 늘어날수록 그리스/로마 신화 및 위성 이름의 신규 행성이 자동 생성됩니다.</p>
      <button on:click={handleSimulateUsers} class="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold">
        + {simUserCount}명 신규 유저 유입 & 자동 행성 확장 실행
      </button>
    </div>

    <div class="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
      <h3 class="font-bold text-sm text-amber-300">신규 행성 수동 창조</h3>
      <input bind:value={newPlanetName} class="w-full px-2 py-1 rounded bg-slate-900 text-xs border border-slate-700" placeholder="영문 행성명" />
      <input bind:value={newPlanetNameKo} class="w-full px-2 py-1 rounded bg-slate-900 text-xs border border-slate-700" placeholder="한글 행성명" />
      <button on:click={handleAddPlanet} class="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold">
        신규 행성 즉시 추가
      </button>
    </div>
  </div>
</div>
