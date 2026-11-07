<script lang="ts">
  import { gameStore, addGameLog, API_BASE } from '../stores/gameStore';
  import { t } from '../i18n';

  $: state = $gameStore;
  let statusMsg = '';
  let errorMsg = '';

  function closeModal() {
    gameStore.update((s) => ({ ...s, activeModal: null }));
  }

  async function runRepair(action: string) {
    statusMsg = '';
    errorMsg = '';
    if (!state.user) return;
    const res = await fetch(`${API_BASE}/game/repair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.user.id, action }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      errorMsg = data.error || 'Action failed';
      return;
    }
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      statusMsg = `${action} OK`;
      addGameLog(`🔧 [Shipyard] ${action}`);
    }
  }
</script>

<div class="p-6 bg-slate-900/95 border border-emerald-500/45 rounded-2xl max-w-2xl w-full shadow-2xl space-y-4">
  <div class="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
    <h2 class="text-xl font-bold text-emerald-300">{$t.repairModalTitle}</h2>
    <button
      type="button"
      on:click={closeModal}
      class="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow"
    >
      {$t.closeBtn}
    </button>
  </div>

  {#if statusMsg}
    <div class="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-xs text-emerald-200">
      ✅ {statusMsg}
    </div>
  {/if}
  {#if errorMsg}
    <div class="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs text-rose-200">
      ⚠️ {errorMsg}
    </div>
  {/if}

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <button type="button" on:click={() => runRepair('REPAIR_HULL')} class="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700">
      <div class="font-bold text-sm text-emerald-400">🛡️ {$t.repairHullTitle}</div>
      <div class="text-xs text-slate-400 mt-0.5">{$t.repairHullDesc}</div>
    </button>
    <button type="button" on:click={() => runRepair('REFUEL')} class="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700">
      <div class="font-bold text-sm text-sky-400">⚡ {$t.repairFuelTitle}</div>
      <div class="text-xs text-slate-400 mt-0.5">{$t.repairFuelDesc}</div>
    </button>
    <button type="button" on:click={() => runRepair('UPGRADE_CARGO')} class="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700">
      <div class="font-bold text-sm text-amber-400">📦 {$t.upgradeCargoTitle}</div>
      <div class="text-xs text-slate-400 mt-0.5">{$t.upgradeCargoDesc}</div>
    </button>
    <button type="button" on:click={() => runRepair('UPGRADE_LASER')} class="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700">
      <div class="font-bold text-sm text-purple-400">⛏️ {$t.upgradeLaserTitle}</div>
      <div class="text-xs text-slate-400 mt-0.5">{$t.upgradeLaserDesc}</div>
    </button>
    <button type="button" on:click={() => runRepair('UPGRADE_WARP')} class="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700">
      <div class="font-bold text-sm text-cyan-400">🌀 {$t.upgradeWarpTitle}</div>
      <div class="text-xs text-slate-400 mt-0.5">{$t.upgradeWarpDesc}</div>
    </button>
    <button type="button" on:click={() => runRepair('UPGRADE_SHIP_TIER')} class="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-left border border-slate-700">
      <div class="font-bold text-sm text-rose-400">🚀 {$t.upgradeShipTierTitle}</div>
      <div class="text-xs text-slate-400 mt-0.5">{$t.upgradeShipTierDesc}</div>
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
