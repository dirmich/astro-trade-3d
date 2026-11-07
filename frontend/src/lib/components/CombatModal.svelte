<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    gameStore,
    addGameLog,
    fetchFriendsList,
    syncMultiplayerState,
    getItemLevelStyle,
    API_BASE,
  } from '../stores/gameStore';
  import { soundEngine } from '../audio/SoundEngine';
  import { t } from '../i18n';

  const dispatch = createEventDispatcher<{
    fireLaserAtPirate: { x: number; y: number; z: number };
  }>();

  $: state = $gameStore;
  let activeTab: 'PIRATES' | 'PVP' = 'PIRATES';
  let selectedAllies: string[] = [];
  let battleLog = '';
  let lastLoot: any = null;

  onMount(async () => {
    // Switch to intense Combat BGM when entering Pirate/PvP Battle Console!
    soundEngine.setCombatMode(true);
    if (state.user?.id) {
      await fetchFriendsList(state.user.id);
      await syncMultiplayerState(state.user.id);
    }
  });

  onDestroy(() => {
    // Return to random Space Ambient BGM when leaving combat
    soundEngine.setCombatMode(false);
  });

  function toggleAlly(allyId: string) {
    if (selectedAllies.includes(allyId)) {
      selectedAllies = selectedAllies.filter((id) => id !== allyId);
    } else if (selectedAllies.length < 3) {
      selectedAllies = [...selectedAllies, allyId];
    }
  }

  function getPirateExpectedLoot(pirateLevel: number) {
    const loots = state.shopCatalog.filter((i) => i.pirate_only);
    if (pirateLevel >= 8) return loots.find((i) => i.id === 'loot_leviathan_crown') || loots[0];
    if (pirateLevel >= 6) return loots.find((i) => i.id === 'loot_dreadnought_singularity') || loots[0];
    if (pirateLevel >= 4) return loots.find((i) => i.id === 'loot_void_nav_blackbox') || loots[0];
    if (pirateLevel >= 2) return loots.find((i) => i.id === 'loot_corsair_plasma_cannon') || loots[0];
    return loots.find((i) => i.id === 'loot_pirate_scrap_core') || loots[0];
  }

  async function attackPirate(pirate: any, useCoop: boolean) {
    if (!state.user) return;
    soundEngine.playSfx('LASER');
    dispatch('fireLaserAtPirate', { x: pirate.x, y: pirate.y, z: pirate.z });

    const alliesToSend = useCoop ? selectedAllies : [];
    const res = await fetch(`${API_BASE}/game/combat/pirate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.user.id,
        pirateId: pirate.id,
        allyUserIds: alliesToSend,
      }),
    });
    const data = await res.json();
    if (data.user) {
      gameStore.update((s) => ({
        ...s,
        user: data.user,
        pirates: s.pirates.map((p) => (p.id === data.pirate?.id ? data.pirate : p)),
      }));
    }

    if (data.victory) {
      soundEngine.playSfx('EXPLOSION');
      setTimeout(() => soundEngine.playSfx('VICTORY'), 300);
      lastLoot = data.lootItem;
    } else if (data.defeated) {
      soundEngine.playSfx('ALARM');
    }

    battleLog = data.message || data.error || '';
    addGameLog(battleLog);
  }

  async function attackPlayerPvP(targetUser: any) {
    if (!state.user) return;
    soundEngine.playSfx('LASER');

    const res = await fetch(`${API_BASE}/game/combat/pvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.user.id,
        targetUserId: targetUser.id,
      }),
    });
    const data = await res.json();
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
    }
    if (data.victory) {
      soundEngine.playSfx('VICTORY');
    } else {
      soundEngine.playSfx('EXPLOSION');
    }
    battleLog = data.message || '';
    addGameLog(battleLog);
  }
</script>

<div
  class="p-6 bg-slate-900/95 border-2 border-rose-500/60 rounded-2xl max-w-5xl w-full shadow-[0_0_40px_rgba(244,63,94,0.3)] space-y-4"
>
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
    <div>
      <div class="flex items-center gap-2">
        <span class="px-2.5 py-0.5 rounded bg-rose-600 text-white text-xs font-extrabold animate-pulse">
          ⚔️ COMBAT MODE BGM ACTIVE
        </span>
        <h2 class="text-xl font-bold text-rose-300">
          🏴‍☠️ 레벨별 우주해적 토벌 (협동 레이드) & 멀티유저 PvP 전장
        </h2>
      </div>
      <p class="text-xs text-slate-400 mt-1">
        우주해적을 격파하면 레벨에 따라 <strong class="text-amber-300">상점에서 절대 팔지 않는 해적 전용 전리품(비매품 유물)</strong>을 획득합니다! 자신보다 레벨이 높은 해적은 친구/접속 유저와 <strong>협동 공격(Co-op)</strong>으로 격파하세요.
      </p>
    </div>

    <button
      on:click={() => gameStore.update((s) => ({ ...s, activeModal: null }))}
      class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
    >
      {$t.closeBtn}
    </button>
  </div>

  <!-- Tabs & Co-op Ally Selector -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <button
        on:click={() => (activeTab = 'PIRATES')}
        class="px-4 py-1.5 rounded-xl text-xs font-bold transition {activeTab === 'PIRATES'
          ? 'bg-rose-600 text-white'
          : 'bg-slate-800 text-slate-300'}"
      >
        🏴‍☠️ 우주해적 함대 (Lv.1 ~ Lv.10)
      </button>
      <button
        on:click={() => (activeTab = 'PVP')}
        class="px-4 py-1.5 rounded-xl text-xs font-bold transition {activeTab === 'PVP'
          ? 'bg-amber-600 text-white'
          : 'bg-slate-800 text-slate-300'}"
      >
        ⚡ 멀티유저 함대 교전 (PvP)
      </button>
    </div>

    <!-- Co-op Party Selector (Friends & Online Pilots) -->
    <div class="flex flex-wrap items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
      <span class="text-xs font-bold text-emerald-300 mr-1">🤝 협동 공격 아군 선택(최대 3명):</span>
      {#each state.otherPlayers.slice(0, 5) as ally}
        {@const isSelected = selectedAllies.includes(ally.id)}
        <button
          on:click={() => toggleAlly(ally.id)}
          class="px-2 py-0.5 rounded-lg text-[11px] font-bold border transition {isSelected
            ? 'bg-emerald-600 text-white border-emerald-300'
            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'}"
        >
          🟢 {ally.pilot_name} (Lv.{ally.pilot_level})
        </button>
      {/each}
    </div>
  </div>

  {#if battleLog}
    <div class="p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-xs text-rose-100 font-semibold flex items-center justify-between gap-3">
      <span>{battleLog}</span>
      {#if lastLoot}
        {@const lootStyle = getItemLevelStyle(lastLoot.level)}
        <div class="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 shrink-0 {lootStyle.borderClass}">
          <img src={lastLoot.image_url} alt={lastLoot.name_ko} class="w-8 h-8 rounded object-cover" />
          <div class="text-[11px]">
            <div class="font-bold {lootStyle.textClass}">🎁 노획: {lastLoot.name_ko}</div>
            <div class="text-[10px] text-amber-300">{lastLoot.effect_summary}</div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'PIRATES'}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[55vh] overflow-y-auto pr-1">
      {#each state.pirates as pirate (pirate.id)}
        {@const expectedLoot = getPirateExpectedLoot(pirate.level)}
        {@const lootStyle = getItemLevelStyle(expectedLoot?.level || 2)}
        {@const isHigherThanPlayer = pirate.level > (state.user?.pilot_level || 1)}
        {@const hpPct = Math.max(0, Math.round((pirate.hp / pirate.max_hp) * 100))}

        <div
          class="p-4 rounded-2xl bg-slate-950/90 border-2 transition flex flex-col justify-between {isHigherThanPlayer
            ? 'border-rose-500/60'
            : 'border-slate-700'}"
        >
          <div>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/50 text-xs font-extrabold">
                  Lv.{pirate.level}
                </span>
                <h3 class="font-bold text-sm text-white">{pirate.name_ko}</h3>
              </div>
              <span class="text-xs font-bold text-amber-400">
                💰 현상금 {pirate.reward_credits.toLocaleString()} CR
              </span>
            </div>

            <!-- Pirate HP Bar -->
            <div class="mt-2.5 space-y-1">
              <div class="flex justify-between text-[11px]">
                <span class="text-slate-400">해적 선체 HP: <strong class="text-rose-300">{pirate.hp} / {pirate.max_hp}</strong></span>
                <span class="text-slate-400">구역: {pirate.sector} · 화력 {pirate.attack}</span>
              </div>
              <div class="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div class="h-full bg-gradient-to-r from-rose-600 to-amber-500 transition-all" style="width: {hpPct}%"></div>
              </div>
            </div>

            <!-- Exclusive Non-Shop Pirate Loot Preview -->
            {#if expectedLoot}
              <div class="mt-3 p-2.5 rounded-xl bg-slate-900/90 flex items-center gap-3 {lootStyle.borderClass}">
                <img src={expectedLoot.image_url} alt={expectedLoot.name_ko} class="w-12 h-12 rounded-lg shrink-0" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-bold {lootStyle.badgeClass}">
                      {lootStyle.label}
                    </span>
                    <span class="text-[10px] font-bold text-rose-400">{$t.pirateExclusiveBadge}</span>
                  </div>
                  <div class="text-xs font-bold truncate mt-0.5 {lootStyle.textClass}">
                    {expectedLoot.name_ko}
                  </div>
                  <div class="text-[10px] text-cyan-300 truncate">{expectedLoot.effect_summary}</div>
                </div>
              </div>
            {/if}

            {#if isHigherThanPlayer}
              <div class="mt-2 text-[11px] text-amber-300 font-semibold">
                ⚠️ 내 레벨(Lv.{state.user?.pilot_level || 1})보다 높은 강적입니다! 상단에서 아군을 선택해 [협동 공격]을 권장합니다.
              </div>
            {/if}
          </div>

          <div class="mt-3 pt-2.5 border-t border-slate-800 flex items-center gap-2">
            <button
              on:click={() => attackPirate(pirate, false)}
              class="flex-1 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold"
            >
              {$t.soloAttackBtn}
            </button>
            <button
              on:click={() => {
                if (selectedAllies.length === 0 && state.otherPlayers.length > 0) {
                  selectedAllies = [state.otherPlayers[0].id, state.otherPlayers[1]?.id].filter(Boolean);
                }
                attackPirate(pirate, true);
              }}
              class="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow"
            >
              {$t.coopAttackBtn} ({selectedAllies.length || 2}명 합동)
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Multiplayer PvP Skirmish List -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[55vh] overflow-y-auto pr-1">
      {#each state.otherPlayers as op (op.id)}
        <div class="p-4 rounded-2xl bg-slate-950/90 border border-amber-500/40 flex items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                Lv.{op.pilot_level}
              </span>
              <h3 class="font-bold text-sm text-white">{op.pilot_name}</h3>
              <span class="text-[10px] text-emerald-400">🟢 ONLINE</span>
            </div>
            <div class="text-xs text-slate-400 mt-1">
              함선: {op.ship_name} · 추정 자산: {op.net_worth?.toLocaleString()} CR · 좌표 ({op.x}, {op.y}, {op.z})
            </div>
          </div>

          <button
            on:click={() => attackPlayerPvP(op)}
            class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shrink-0"
          >
            {$t.pvpAttackBtn}
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
