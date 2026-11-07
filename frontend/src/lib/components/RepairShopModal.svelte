<script lang="ts">
  import { gameStore, addGameLog, API_BASE } from '../stores/gameStore';

  $: state = $gameStore;

  async function runRepair(action: string) {
    if (!state.user) return;
    const res = await fetch(`${API_BASE}/game/repair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.user.id, action }),
    });
    const data = await res.json();
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
      addGameLog(`[정비/개조] ${action} 작업이 완료되었습니다.`);
    }
  }
</script>

<div class="p-6 bg-slate-900/95 border border-emerald-500/40 rounded-2xl max-w-2xl w-full space-y-3">
  <h2 class="text-xl font-bold text-emerald-300">🔧 궤도 수리점 & 함선 개조소</h2>
  <div class="grid grid-cols-2 gap-3">
    <button on:click={() => runRepair('REPAIR_HULL')} class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left">
      <div class="font-bold text-sm text-emerald-400">선체 완전 수리</div>
      <div class="text-xs text-slate-400">손상 1당 15 CR</div>
    </button>
    <button on:click={() => runRepair('REFUEL')} class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left">
      <div class="font-bold text-sm text-sky-400">워프 연료 완충</div>
      <div class="text-xs text-slate-400">연료 1당 8 CR</div>
    </button>
    <button on:click={() => runRepair('UPGRADE_CARGO')} class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left">
      <div class="font-bold text-sm text-amber-400">화물칸 +40 확장</div>
      <div class="text-xs text-slate-400">대량 차익 교역 필수 개조</div>
    </button>
    <button on:click={() => runRepair('UPGRADE_LASER')} class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left">
      <div class="font-bold text-sm text-purple-400">채굴 레이저 강화</div>
      <div class="text-xs text-slate-400">궤도 광물 채집량 증가</div>
    </button>
    <button on:click={() => runRepair('UPGRADE_WARP')} class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left">
      <div class="font-bold text-sm text-cyan-400">워프 드라이브 강화</div>
      <div class="text-xs text-slate-400">성간 이동 연료 소모 절감</div>
    </button>
    <button on:click={() => runRepair('UPGRADE_SHIP_TIER')} class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-left">
      <div class="font-bold text-sm text-rose-400">상위 등급 함선 건조</div>
      <div class="text-xs text-slate-400">차세대 주력함으로 교체</div>
    </button>
  </div>
</div>
