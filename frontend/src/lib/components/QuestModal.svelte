<script lang="ts">
  import { onMount } from 'svelte';
  import { gameStore, fetchUserQuests, addGameLog, API_BASE } from '../stores/gameStore';
  import { currentLang, t } from '../i18n';
  import { soundEngine } from '../audio/SoundEngine';

  $: state = $gameStore;
  let statusMsg = '';
  let errorMsg = '';

  function closeModal() {
    gameStore.update((s) => ({ ...s, activeModal: null }));
  }

  onMount(() => {
    if (state.user?.id) {
      fetchUserQuests(state.user.id);
    }
  });

  function getTitle(q: any, lang: string) {
    if (lang === 'ko') return q.title_ko || q.title_en;
    if (lang === 'ja') return q.title_ja || q.title_en;
    if (lang === 'zh') return q.title_zh || q.title_en;
    return q.title_en;
  }

  function getDesc(q: any, lang: string) {
    if (lang === 'ko') return q.desc_ko || q.desc_en;
    if (lang === 'ja') return q.desc_ja || q.desc_en;
    if (lang === 'zh') return q.desc_zh || q.desc_en;
    return q.desc_en;
  }

  async function claimQuest(questId: string) {
    statusMsg = '';
    errorMsg = '';
    if (!state.user) return;

    const res = await fetch(`${API_BASE}/game/quests/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.user.id, questId }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      errorMsg = data.error || 'Failed to claim quest';
      return;
    }

    soundEngine.playSfx('VICTORY');
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
    }
    statusMsg = data.message;
    addGameLog(data.message);
    await fetchUserQuests(state.user.id);
  }
</script>

<div class="p-6 bg-slate-900/95 border border-amber-500/50 rounded-2xl max-w-4xl w-full shadow-2xl space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
    <div>
      <h2 class="text-xl font-bold text-amber-300">{$t.questsModalTitle}</h2>
      <p class="text-xs text-slate-400 mt-0.5">
        {$t.questsModalSubtitle} (Lv.{state.user?.pilot_level || 1} · {(state.user?.net_worth || 0).toLocaleString()} CR)
      </p>
    </div>

    <div class="flex items-center gap-2">
      {#if state.user?.isSuperAdmin}
        <button
          type="button"
          on:click={() => gameStore.update((s) => ({ ...s, activeModal: 'ADMIN' }))}
          class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
        >
          {$t.questsOpenAdminBtn}
        </button>
      {/if}
      <button
        type="button"
        on:click={closeModal}
        class="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow"
      >
        {$t.closeBtn}
      </button>
    </div>
  </div>

  {#if statusMsg}
    <div class="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-xs text-emerald-200">
      {statusMsg}
    </div>
  {/if}
  {#if errorMsg}
    <div class="p-3 rounded-xl bg-rose-950/90 border border-rose-500/50 text-xs text-rose-200">
      {errorMsg}
    </div>
  {/if}

  <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[54vh] overflow-y-auto pr-1">
    {#each state.quests as q (q.id)}
      {@const unlocked = (state.user?.pilot_level || 1) >= q.min_level}
      {@const pct = Math.min(100, Math.round(((q.progress || 0) / Math.max(1, q.target_amount)) * 100))}

      <div
        class="p-4 rounded-2xl border flex flex-col justify-between transition {q.claimed
          ? 'bg-slate-900/50 border-slate-800 opacity-70'
          : unlocked
          ? 'bg-slate-950/90 border-amber-500/50'
          : 'bg-slate-950/60 border-slate-800'}"
      >
        <div>
          <div class="flex items-center justify-between gap-2">
            <span
              class="px-2 py-0.5 rounded text-[10px] font-bold {unlocked
                ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                : 'bg-slate-800 text-slate-400'}"
            >
              {$t.questsReqLevel}{q.min_level}+ · {q.quest_type}
            </span>
            <div class="text-xs font-bold text-emerald-400">
              +{q.reward_credits.toLocaleString()} CR
              {#if q.reward_warp_tickets > 0}
                <span class="text-cyan-300"> & ⚡{dimensionTicketLabel(q.reward_warp_tickets, $t.hudWarpCells)}</span>
              {/if}
            </div>
          </div>

          <h3 class="font-bold text-sm text-white mt-2">{getTitle(q, $currentLang)}</h3>
          <p class="text-xs text-slate-400 mt-1">{getDesc(q, $currentLang)}</p>

          <!-- Progress Bar -->
          <div class="mt-3 space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-slate-400">{$t.questsProgressLabel}: {q.progress || 0} / {q.target_amount}</span>
              <span class="text-amber-300 font-bold">{pct}%</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div class="h-full bg-amber-500 transition-all" style="width: {pct}%"></div>
            </div>
          </div>
        </div>

        <div class="mt-3 pt-2.5 border-t border-slate-800 flex justify-end">
          {#if q.claimed}
            <span class="px-3 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold">
              {$t.questsClaimedBadge}
            </span>
          {:else if !unlocked}
            <span class="px-3 py-1 rounded-lg bg-rose-950/60 text-rose-300 text-xs font-bold">
              {$t.questsLockedBadgePrefix}{q.min_level}
            </span>
          {:else if q.completed}
            <button
              type="button"
              on:click={() => claimQuest(q.id)}
              class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow animate-pulse"
            >
              {$t.questsClaimBtn}
            </button>
          {:else}
            <span class="px-3 py-1 rounded-lg bg-slate-800 text-cyan-300 text-xs">
              {$t.questsInProgressBadge} ({q.progress || 0}/{q.target_amount})
            </span>
          {/if}
        </div>
      </div>
    {/each}
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

<script context="module" lang="ts">
  function dimensionTicketLabel(count: number, label: string) {
    return `${label} +${count}`;
  }
</script>
