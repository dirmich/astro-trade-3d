<script lang="ts">
  import { onMount } from 'svelte';
  import {
    gameStore,
    fetchUniverse,
    fetchUserQuests,
    addGameLog,
    API_BASE,
    SUPERUSER_EMAIL,
  } from '../stores/gameStore';
  import { currentLang, t } from '../i18n';

  $: state = $gameStore;
  let adminTab: 'QUEST_EDITOR' | 'GALAXY' = 'QUEST_EDITOR';
  let adminQuests: any[] = [];
  let statusMsg = '';

  // Quest Editor Form
  let editingId = '';
  let qMinLevel = 1;
  let qQuestType = 'MINE';
  let qTargetAmount = 15;
  let qRewardCredits = 2500;
  let qRewardWarpTickets = 1;
  let qTitleEn = '[Lv.1] Special Orbital Contract';
  let qTitleKo = '[Lv.1] 특별 궤도 채굴 작전';
  let qTitleJa = '[Lv.1] 特別軌道採掘作戦';
  let qTitleZh = '[Lv.1] 特别轨道采矿行动';
  let qDescEn = 'Complete the special directive issued by Galactic Command.';
  let qDescKo = '은하 사령부에서 하달한 특별 목표 수량을 달성하세요.';

  let newPlanetName = 'Persephone Prime';
  let newPlanetNameKo = '페르세포네 프라임';
  let newPlanetBiome = 'CRYSTAL';
  let simUserCount = 4;

  function closeModal() {
    gameStore.update((s) => ({ ...s, activeModal: null }));
  }

  onMount(() => {
    loadAdminQuests();
  });

  async function loadAdminQuests() {
    const res = await fetch(`${API_BASE}/admin/quests`);
    const data = await res.json();
    adminQuests = data.quests || [];
  }

  function selectQuestForEdit(q: any) {
    editingId = q.id;
    qMinLevel = q.min_level;
    qQuestType = q.quest_type;
    qTargetAmount = q.target_amount;
    qRewardCredits = q.reward_credits;
    qRewardWarpTickets = q.reward_warp_tickets || 0;
    qTitleEn = q.title_en;
    qTitleKo = q.title_ko;
    qTitleJa = q.title_ja;
    qTitleZh = q.title_zh;
    qDescEn = q.desc_en;
    qDescKo = q.desc_ko;
  }

  function resetQuestForm() {
    editingId = '';
    qMinLevel = 1;
    qQuestType = 'MINE';
    qTargetAmount = 15;
    qRewardCredits = 2500;
    qRewardWarpTickets = 1;
    qTitleEn = '[Lv.1] New Galactic Mission';
    qTitleKo = '[Lv.1] 신규 은하계 임무';
    qTitleJa = '[Lv.1] 新規銀河ミッション';
    qTitleZh = '[Lv.1] 新银河任务';
    qDescEn = 'Fulfill the mission objective to earn credits and warp cells.';
    qDescKo = '임무 목표를 달성하여 크레딧과 워프 셀 보상을 획득하세요.';
  }

  async function saveQuest() {
    const res = await fetch(`${API_BASE}/admin/quests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminEmail: state.user?.email || SUPERUSER_EMAIL,
        id: editingId || undefined,
        min_level: qMinLevel,
        max_level: 10,
        quest_type: qQuestType,
        target_id: 'ANY',
        target_amount: qTargetAmount,
        reward_credits: qRewardCredits,
        reward_warp_tickets: qRewardWarpTickets,
        title_en: qTitleEn,
        title_ko: qTitleKo,
        title_ja: qTitleJa,
        title_zh: qTitleZh,
        desc_en: qDescEn,
        desc_ko: qDescKo,
      }),
    });
    const data = await res.json();
    statusMsg = data.message || data.error || '';
    addGameLog(`[ADMIN] ${statusMsg}`);
    await loadAdminQuests();
    if (state.user?.id) await fetchUserQuests(state.user.id);
    resetQuestForm();
  }

  async function deleteQuest(id: string) {
    const res = await fetch(
      `${API_BASE}/admin/quests/${id}?adminEmail=${encodeURIComponent(state.user?.email || SUPERUSER_EMAIL)}`,
      { method: 'DELETE' }
    );
    const data = await res.json();
    statusMsg = data.message || '';
    await loadAdminQuests();
    if (state.user?.id) await fetchUserQuests(state.user.id);
  }

  async function handleSimulateUsers() {
    const res = await fetch(`${API_BASE}/admin/simulate-users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail: SUPERUSER_EMAIL, count: simUserCount }),
    });
    const data = await res.json();
    statusMsg = data.message;
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
    statusMsg = data.message;
    addGameLog(`[ADMIN] ${data.message}`);
    await fetchUniverse();
  }
</script>

<div class="p-6 bg-slate-900/95 border border-rose-500/50 rounded-2xl max-w-4xl w-full space-y-4 shadow-2xl">
  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
    <div>
      <h2 class="text-xl font-bold text-rose-400">{$t.adminModalTitle} ({SUPERUSER_EMAIL})</h2>
      <span class="text-xs text-slate-400">
        {$t.adminStatsSummary}: {state.planets.length} / {state.totalUsers} / {adminQuests.length}
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        on:click={() => (adminTab = 'QUEST_EDITOR')}
        class="px-3 py-1.5 rounded-xl text-xs font-bold {adminTab === 'QUEST_EDITOR'
          ? 'bg-rose-600 text-white'
          : 'bg-slate-800 text-slate-300'}"
      >
        {$t.adminTabQuestEditor}
      </button>
      <button
        type="button"
        on:click={() => (adminTab = 'GALAXY')}
        class="px-3 py-1.5 rounded-xl text-xs font-bold {adminTab === 'GALAXY'
          ? 'bg-cyan-600 text-white'
          : 'bg-slate-800 text-slate-300'}"
      >
        {$t.adminTabGalaxy}
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

  {#if statusMsg}
    <div class="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200">
      {statusMsg}
    </div>
  {/if}

  {#if adminTab === 'QUEST_EDITOR'}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[58vh] overflow-y-auto pr-1">
      <!-- Left: Create / Edit Quest Form -->
      <div class="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-sm text-amber-300">
            {editingId ? `${$t.adminEditQuestTitle} (${editingId})` : $t.adminNewQuestTitle}
          </h3>
          {#if editingId}
            <button type="button" on:click={resetQuestForm} class="text-xs text-cyan-400 hover:underline">{$t.adminSwitchToNewBtn}</button>
          {/if}
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="block text-slate-400 mb-1">{$t.adminMinLevelLabel}</span>
            <input type="number" min="1" max="10" bind:value={qMinLevel} class="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700" />
          </div>
          <div>
            <span class="block text-slate-400 mb-1">{$t.adminQuestTypeLabel}</span>
            <select bind:value={qQuestType} class="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700">
              <option value="MINE">MINE</option>
              <option value="TRADE">TRADE</option>
              <option value="KILL_PIRATE">KILL_PIRATE</option>
              <option value="VISIT_PLANET">VISIT_PLANET</option>
            </select>
          </div>
          <div>
            <span class="block text-slate-400 mb-1">{$t.adminTargetAmountLabel}</span>
            <input type="number" min="1" bind:value={qTargetAmount} class="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700" />
          </div>
          <div>
            <span class="block text-slate-400 mb-1">{$t.adminRewardCreditsLabel}</span>
            <input type="number" step="100" bind:value={qRewardCredits} class="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700" />
          </div>
          <div class="col-span-2">
            <span class="block text-slate-400 mb-1">{$t.adminRewardWarpLabel}</span>
            <input type="number" min="0" max="10" bind:value={qRewardWarpTickets} class="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700" />
          </div>
        </div>

        <input bind:value={qTitleEn} class="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs" placeholder="English Title" />
        <input bind:value={qTitleKo} class="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs" placeholder="Korean Title" />
        <input bind:value={qDescEn} class="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs" placeholder="English Description" />
        <input bind:value={qDescKo} class="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs" placeholder="Korean Description" />

        <button
          type="button"
          on:click={saveQuest}
          class="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow"
        >
          {$t.adminSaveQuestBtn}
        </button>
      </div>

      <!-- Right: Existing Quests List -->
      <div class="space-y-2">
        <h3 class="font-bold text-sm text-cyan-300">{$t.adminQuestListHeader} ({adminQuests.length})</h3>
        {#each adminQuests as q (q.id)}
          <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-bold">
                  Lv.{q.min_level}+
                </span>
                <span class="font-bold text-xs text-white truncate">
                  {$currentLang === 'ko' ? q.title_ko : q.title_en}
                </span>
              </div>
              <div class="text-[11px] text-slate-400 truncate mt-0.5">
                {q.quest_type} x{q.target_amount} · +{q.reward_credits.toLocaleString()} CR / +⚡{q.reward_warp_tickets}
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <button
                type="button"
                on:click={() => selectQuestForEdit(q)}
                class="px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-bold"
              >
                {$t.adminEditBtn}
              </button>
              <button
                type="button"
                on:click={() => deleteQuest(q.id)}
                class="px-2.5 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white text-[11px] font-bold"
              >
                {$t.adminDeleteBtn}
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
        <h3 class="font-bold text-sm text-cyan-300">{$t.adminSimUsersTitle}</h3>
        <p class="text-xs text-slate-400">{$t.adminSimUsersDesc}</p>
        <button type="button" on:click={handleSimulateUsers} class="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold">
          +{simUserCount} {$t.adminSimUsersBtn}
        </button>
      </div>

      <div class="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
        <h3 class="font-bold text-sm text-amber-300">{$t.adminCreatePlanetTitle}</h3>
        <input bind:value={newPlanetName} class="w-full px-2 py-1 rounded bg-slate-900 text-xs border border-slate-700" placeholder="English Name" />
        <input bind:value={newPlanetNameKo} class="w-full px-2 py-1 rounded bg-slate-900 text-xs border border-slate-700" placeholder="Korean Name" />
        <button type="button" on:click={handleAddPlanet} class="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold">
          {$t.adminCreatePlanetBtn}
        </button>
      </div>
    </div>
  {/if}

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
