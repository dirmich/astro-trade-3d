<script lang="ts">
  import { onMount } from 'svelte';
  import { gameStore, fetchFriendsList, addGameLog, API_BASE } from '../stores/gameStore';
  import { t } from '../i18n';

  $: state = $gameStore;
  let statusMsg = '';

  onMount(() => {
    if (state.user?.id) {
      fetchFriendsList(state.user.id);
    }
  });

  async function sendFriendRequest(targetId: string, autoAccept: boolean = false) {
    if (!state.user) return;
    const res = await fetch(`${API_BASE}/game/friends/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterId: state.user.id,
        addresseeId: targetId,
        autoAccept,
      }),
    });
    const data = await res.json();
    statusMsg = data.message || data.error || '';
    addGameLog(statusMsg);
    await fetchFriendsList(state.user.id);
  }

  async function respondFriendRequest(friendshipId: string, action: 'ACCEPT' | 'REJECT') {
    if (!state.user) return;
    const res = await fetch(`${API_BASE}/game/friends/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId, action }),
    });
    const data = await res.json();
    statusMsg = data.message || '';
    addGameLog(statusMsg);
    await fetchFriendsList(state.user.id);
  }

  function getPlanetName(pid: string) {
    const p = state.planets.find((pl) => pl.id === pid);
    return p ? `${p.name_ko} (${p.sector})` : 'Deep Space';
  }
</script>

<div class="p-6 bg-slate-900/95 border border-emerald-500/50 rounded-2xl max-w-4xl w-full shadow-2xl space-y-4">
  <div class="flex items-center justify-between border-b border-slate-800 pb-3">
    <div>
      <h2 class="text-xl font-bold text-emerald-300">🤝 멀티유저 친구 목록 & 친구 요청·수락 관제</h2>
      <p class="text-xs text-slate-400 mt-0.5">
        친구 요청 및 수락을 통해 친구로 등록되면 실시간 접속 상태(🟢 ONLINE)와 현재 행성이 표시되며, 고레벨 우주해적을 함께 협동 공격할 수 있습니다.
      </p>
    </div>
    <button
      on:click={() => gameStore.update((s) => ({ ...s, activeModal: null }))}
      class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
    >
      {$t.closeBtn}
    </button>
  </div>

  {#if statusMsg}
    <div class="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-xs text-emerald-200">
      {statusMsg}
    </div>
  {/if}

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
    <!-- Left Column: Registered Friends (Online Status Visible!) + Incoming Requests -->
    <div class="space-y-3">
      <h3 class="text-sm font-bold text-emerald-300">
        🟢 등록된 친구 리스트 ({state.friends.length}명)
      </h3>

      {#each state.friends as fr (fr.id)}
        <div class="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/40 flex items-center justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold {fr.isOnline ? 'text-emerald-400' : 'text-slate-500'}">
                {fr.isOnline ? '🟢 접속중(ONLINE)' : '⚫ 오프라인'}
              </span>
              <span class="font-bold text-sm text-white">{fr.pilot_name}</span>
              <span class="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px] font-bold">
                Lv.{fr.pilot_level}
              </span>
            </div>
            <div class="text-[11px] text-slate-400 mt-1">
              위치: <strong class="text-cyan-300">{getPlanetName(fr.current_planet_id)}</strong> · 함선: {fr.ship_name}
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <button
              on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'COMBAT' }))}
              class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold"
            >
              🏴‍☠️ 해적 협동공격
            </button>
            <button
              on:click={() => respondFriendRequest(fr.friendshipId, 'REJECT')}
              class="px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px]"
            >
              친구 해제
            </button>
          </div>
        </div>
      {:else}
        <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
          아직 등록된 친구가 없습니다. 우측 목록에서 파일럿에게 친구 요청을 보내거나 수락해보세요!
        </div>
      {/each}

      {#if state.incomingRequests.length > 0}
        <h3 class="text-sm font-bold text-amber-300 pt-2">
          📩 받은 친구 요청 ({state.incomingRequests.length}건)
        </h3>
        {#each state.incomingRequests as req}
          <div class="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between">
            <div>
              <div class="font-bold text-xs text-white">{req.pilot_name} (Lv.{req.pilot_level})</div>
              <div class="text-[11px] text-slate-400">{req.ship_name}</div>
            </div>
            <div class="flex gap-1.5">
              <button
                on:click={() => respondFriendRequest(req.friendshipId, 'ACCEPT')}
                class="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold"
              >
                수락
              </button>
              <button
                on:click={() => respondFriendRequest(req.friendshipId, 'REJECT')}
                class="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                거절
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Right Column: Discover Active Pilots & Send Friend Request -->
    <div class="space-y-3">
      <h3 class="text-sm font-bold text-cyan-300">
        🛰️ 은하계 파일럿 탐색 & 친구 요청 ({state.discoverPilots.length}명)
      </h3>

      {#each state.discoverPilots as p (p.id)}
        <div class="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] {p.isOnline ? 'text-emerald-400' : 'text-slate-500'}">
                {p.isOnline ? '🟢' : '⚫'}
              </span>
              <span class="font-bold text-xs text-white">{p.pilot_name}</span>
              <span class="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px] font-bold">
                Lv.{p.pilot_level}
              </span>
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5">
              자산: {(p.net_worth || p.credits).toLocaleString()} CR · {getPlanetName(p.current_planet_id)}
            </div>
          </div>

          <div class="flex gap-1.5">
            <button
              on:click={() => sendFriendRequest(p.id, false)}
              class="px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-bold"
            >
              📩 친구 요청
            </button>
            <button
              on:click={() => sendFriendRequest(p.id, true)}
              class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold"
              title="상대 파일럿이 즉시 수락하여 친구 목록에 등록됩니다"
            >
              🤝 요청+즉시수락
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
