<script lang="ts">
  import { gameStore, fetchUniverse, addGameLog, API_BASE } from '../stores/gameStore';
  import { t } from '../i18n';

  $: state = $gameStore;
  let wager = 1000;
  let statusMsg = '';
  let errorMsg = '';

  function closeModal() {
    gameStore.update((s) => ({ ...s, activeModal: null }));
  }

  async function triggerTavern(actionType: 'RUMOR' | 'GAMBLE' | 'HIRE_CREW' | 'RANDOM_DRINK') {
    statusMsg = '';
    errorMsg = '';
    if (!state.user) return;
    const res = await fetch(`${API_BASE}/game/tavern`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.user.id, actionType, wager }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      errorMsg = data.error || 'Action failed';
      return;
    }
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      statusMsg = data.message || '';
      addGameLog(data.message);
      await fetchUniverse();
    }
  }
</script>

<div class="p-6 bg-slate-900/95 border border-amber-500/45 rounded-2xl max-w-2xl w-full shadow-2xl space-y-4">
  <div class="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
    <div>
      <h2 class="text-xl font-bold text-amber-300">{$t.tavernModalTitle}</h2>
      <p class="text-xs text-slate-400 mt-0.5">{$t.tavernModalSubtitle}</p>
    </div>
    <button
      type="button"
      on:click={closeModal}
      class="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow shrink-0"
    >
      {$t.closeBtn}
    </button>
  </div>

  {#if statusMsg}
    <div class="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-xs text-emerald-200">
      {statusMsg}
    </div>
  {/if}
  {#if errorMsg}
    <div class="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs text-rose-200">
      ⚠️ {errorMsg}
    </div>
  {/if}

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <button type="button" on:click={() => triggerTavern('RUMOR')} class="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700">
      <div class="font-bold text-sm text-amber-400">{$t.tavernRumorTitle}</div>
      <div class="text-xs text-slate-400 mt-0.5">{$t.tavernRumorDesc}</div>
    </button>
    <button type="button" on:click={() => triggerTavern('HIRE_CREW')} class="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700">
      <div class="font-bold text-sm text-cyan-400">{$t.tavernCrewTitle}</div>
      <div class="text-xs text-slate-400 mt-0.5">{$t.tavernCrewDesc}</div>
    </button>
    <button type="button" on:click={() => triggerTavern('GAMBLE')} class="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700">
      <div class="font-bold text-sm text-purple-400">{$t.tavernGambleTitle} ({wager} CR)</div>
      <div class="text-xs text-slate-400 mt-0.5">{$t.tavernGambleDesc}</div>
    </button>
    <button type="button" on:click={() => triggerTavern('RANDOM_DRINK')} class="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700">
      <div class="font-bold text-sm text-emerald-400">{$t.tavernDrinkTitle}</div>
      <div class="text-xs text-slate-400 mt-0.5">{$t.tavernDrinkDesc}</div>
    </button>
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
