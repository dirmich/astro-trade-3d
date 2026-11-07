/**
 * Svelte Reactive Store & Hono Backend API Client (`frontend/src/lib/stores/gameStore.ts`)
 */
import { writable } from 'svelte/store';

export const SUPERUSER_EMAIL = 'oldtv.cf@gmail.com';
export const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000/api';

export const gameStore = writable({
  user: null as any,
  planets: [] as any[],
  resources: [] as any[],
  markets: [] as any[],
  events: [] as any[],
  totalUsers: 1,
  leaderboard: [] as any[],
  logs: [] as string[],
  activeModal: null as null | 'TRADE' | 'REPAIR' | 'TAVERN' | 'MAP' | 'ADMIN' | 'AUTH',
});

export function addGameLog(message: string) {
  const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  gameStore.update((s) => ({
    ...s,
    logs: [`[${time}] ${message}`, ...s.logs.slice(0, 49)],
  }));
}

export async function fetchUniverse() {
  const res = await fetch(`${API_BASE}/game/universe`);
  const data = await res.json();
  gameStore.update((s) => ({
    ...s,
    planets: data.planets || [],
    resources: data.resources || [],
    markets: data.markets || [],
    events: data.events || [],
    totalUsers: data.totalUsers || 1,
    leaderboard: data.leaderboard || [],
  }));
}
