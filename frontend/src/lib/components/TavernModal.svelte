<script lang="ts">
  import { gameStore, fetchUniverse, addGameLog, API_BASE } from '../stores/gameStore';

  $: state = $gameStore;
  let wager = 1000;

  async function triggerTavern(actionType: 'RUMOR' | 'GAMBLE' | 'HIRE_CREW' | 'RANDOM_DRINK') {
    if (!state.user) return;
    const res = await fetch(`${API_BASE}/game/tavern`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.user.id, actionType, wager }),
    });
    const data = await res.json();
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      addGameLog(data.message);
      await fetchUniverse();
    }
  }
</script>

<div class="p-6 bg-slate-900/95 border border-amber-500/40 rounded-2xl max-w-2xl w-full space-y-4">
  <h2 class="text-xl font-bold text-amber-300">🍸 네뷸라 라운지 (우주 술집)</h2>
  <p class="text-xs text-slate-400">성간 무역상, 정보 브로커, 용병, 도박사들이 모여 고급 시세 루머와 일확천금을 거래하는 공간입니다.</p>
  <div class="grid grid-cols-2 gap-3">
    <button on:click={() => triggerTavern('RUMOR')} class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left">
      <div class="font-bold text-sm text-amber-400">🕵️ 비밀 시세 루머 매수 (600 CR)</div>
      <div class="text-xs text-slate-400">특정 행성의 자원 폭등/폭락 정보 즉시 입수</div>
    </button>
    <button on:click={() => triggerTavern('HIRE_CREW')} class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left">
      <div class="font-bold text-sm text-cyan-400">🧑‍🚀 베테랑 선원 영입 (3,500 CR)</div>
      <div class="text-xs text-slate-400">항해 연료 절감·채굴량 보너스 전문가 고용</div>
    </button>
    <button on:click={() => triggerTavern('GAMBLE')} class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left">
      <div class="font-bold text-sm text-purple-400">🎲 퀀텀 다이스 베팅 ({wager} CR)</div>
      <div class="text-xs text-slate-400">합 8 이상 2배, 합 12 잭팟 3배 배당</div>
    </button>
    <button on:click={() => triggerTavern('RANDOM_DRINK')} class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left">
      <div class="font-bold text-sm text-emerald-400">🍹 은하 특주 주문 & 랜덤 조우 (250 CR)</div>
      <div class="text-xs text-slate-400">고대 광맥 좌표 획득 또는 무료 선체 수리</div>
    </button>
  </div>
</div>
