/**
 * Svelte Reactive Store & Hono Backend API Client (`frontend/src/lib/stores/gameStore.ts`)
 */
import { writable, get } from 'svelte/store';
import { currentLang } from '../i18n';
import { soundEngine } from '../audio/SoundEngine';

export const SUPERUSER_EMAIL = 'oldtv.cf@gmail.com';
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.7';

function resolveApiBase(): string {
  const configured = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      if (!configured || configured.includes('localhost') || configured.includes('127.0.0.1')) {
        if (host.startsWith('astro.')) {
          return `${window.location.protocol}//${host.replace(/^astro\./, 'astrob.')}/api`;
        }
        return `${window.location.origin}/api`;
      }
    }
  }
  return configured || 'http://localhost:8000/api';
}

export const API_BASE = resolveApiBase();

export interface FlightTelemetry {
  x: number;
  y: number;
  z: number;
  speed: number;
  isBoosting: boolean;
  nearestPlanetId: string | null;
  nearestPlanetName: string;
  nearestPlanetSector: string;
  nearestDistance: number;
  canDock: boolean;
  targetPlanetId: string | null;
  targetDistance: number;
  etaSeconds?: number;
  headingDeg?: number;
  targetBearingDeg?: number;
}

export const gameStore = writable({
  user: null as any,
  planets: [] as any[],
  resources: [] as any[],
  markets: [] as any[],
  events: [] as any[],
  pirates: [] as any[],
  otherPlayers: [] as any[],
  quests: [] as any[],
  friends: [] as any[],
  incomingRequests: [] as any[],
  discoverPilots: [] as any[],
  levelThresholds: [] as any[],
  shopCatalog: [] as any[],
  sectors: [] as string[],
  planetShopItems: [] as any[],
  totalUsers: 1,
  leaderboard: [] as any[],
  logs: [] as string[],
  flightMode: 'ORBIT' as 'ORBIT' | 'MANUAL' | 'AI_AUTOPILOT',
  selectedTargetPlanetId: 'planet_2' as string | null,
  currentBgmName: 'Track 1: Nebula Drift',
  flightTelemetry: {
    x: 95,
    y: 2,
    z: 12,
    speed: 0,
    isBoosting: false,
    nearestPlanetId: 'planet_1',
    nearestPlanetName: '올림푸스 프라임',
    nearestPlanetSector: 'Core-Alpha',
    nearestDistance: 0,
    canDock: true,
    targetPlanetId: 'planet_2',
    targetDistance: 78,
    etaSeconds: 4,
    headingDeg: 0,
    targetBearingDeg: 0,
  } as FlightTelemetry,
  activeModal: null as
    | null
    | 'TRADE'
    | 'REPAIR'
    | 'TAVERN'
    | 'SHOP'
    | 'MAP'
    | 'COMBAT'
    | 'FRIENDS'
    | 'QUESTS'
    | 'ADMIN'
    | 'AUTH',
});

export function addGameLog(message: string) {
  const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  gameStore.update((s) => ({
    ...s,
    logs: [`[${time}] ${message}`, ...s.logs.slice(0, 49)],
  }));
}

export async function fetchUniverse() {
  try {
    const res = await fetch(`${API_BASE}/game/universe`);
    const data = await res.json();
    gameStore.update((s) => ({
      ...s,
      planets: data.planets || [],
      resources: data.resources || [],
      markets: data.markets || [],
      events: data.events || [],
      pirates: data.pirates || [],
      levelThresholds: data.levelThresholds || [],
      shopCatalog: data.shopCatalog || [],
      sectors: data.sectors || [],
      totalUsers: data.totalUsers || 1,
      leaderboard: data.leaderboard || [],
    }));
  } catch (err) {
    console.error('Failed to fetch universe:', err);
  }
}

export async function fetchPlanetShop(planetId: string) {
  if (!planetId) return;
  try {
    const res = await fetch(`${API_BASE}/game/shop/${planetId}`);
    const data = await res.json();
    if (data.items) {
      gameStore.update((s) => ({
        ...s,
        planetShopItems: data.items,
      }));
    }
  } catch (err) {
    console.error('Failed to fetch planet shop:', err);
  }
}

export async function syncMultiplayerState(userId?: string, x?: number, y?: number, z?: number) {
  try {
    const res = await fetch(`${API_BASE}/game/multiplayer/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, x, y, z }),
    });
    const data = await res.json();
    if (data.otherPlayers || data.pirates) {
      gameStore.update((s) => ({
        ...s,
        otherPlayers: data.otherPlayers || s.otherPlayers,
        pirates: data.pirates || s.pirates,
      }));
    }
  } catch {
    // ignore transient network errors
  }
}

export async function fetchFriendsList(userId: string) {
  if (!userId) return;
  try {
    const res = await fetch(`${API_BASE}/game/friends/${userId}`);
    const data = await res.json();
    gameStore.update((s) => ({
      ...s,
      friends: data.friends || [],
      incomingRequests: data.incomingRequests || [],
      discoverPilots: data.discoverPilots || [],
    }));
  } catch (err) {
    console.error('Failed to fetch friends:', err);
  }
}

export async function fetchUserQuests(userId: string) {
  if (!userId) return;
  try {
    const res = await fetch(`${API_BASE}/game/quests/${userId}`);
    const data = await res.json();
    if (data.quests) {
      gameStore.update((s) => ({ ...s, quests: data.quests }));
    }
  } catch (err) {
    console.error('Failed to fetch quests:', err);
  }
}

export async function saveUserSettingsToDb(userId: string, partialSettings: Record<string, any>) {
  if (partialSettings.lang) {
    currentLang.set(partialSettings.lang);
  }
  soundEngine.applySettings(partialSettings);

  if (!userId) return;
  try {
    const res = await fetch(`${API_BASE}/game/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, settings: partialSettings }),
    });
    const data = await res.json();
    if (data.user) {
      gameStore.update((s) => ({ ...s, user: data.user }));
    }
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

const SECTOR_MAP_ITEM_IDS: Record<string, string> = {
  'Core-Alpha': 'map_core_alpha',
  'Inner-Sol': 'map_inner_sol',
  'Jovian-Belt': 'map_jovian_belt',
  'Saturn-Ring': 'map_saturn_ring',
  'Uranus-Rim': 'map_uranus_rim',
  'Neptune-Deep': 'map_neptune_deep',
  'Kuiper-Edge': 'map_kuiper_edge',
  'Mythos-Core': 'map_mythos_core',
  'Abyss-Omega': 'map_abyss_omega',
};

export function getSectorMapStatus(
  unlockedMaps: Record<string, number> | undefined,
  sector: string,
  nowMs: number = Date.now()
): { active: boolean; remainingSec: number } {
  if (!sector) return { active: false, remainingSec: 0 };
  const expiry = Math.max(unlockedMaps?.[sector] || 0, unlockedMaps?.['ALL_GALAXY'] || 0);
  if (expiry > nowMs) {
    return { active: true, remainingSec: Math.ceil((expiry - nowMs) / 1000) };
  }
  const inv = get(gameStore).user?.inventory || {};
  const mapItemId = SECTOR_MAP_ITEM_IDS[sector];
  if (
    (mapItemId && Number(inv[mapItemId] || 0) > 0) ||
    Number(inv['map_all_galaxy'] || 0) > 0 ||
    Number(inv['item_chrono_relic'] || 0) > 0 ||
    Number(inv['loot_leviathan_crown'] || 0) > 0 ||
    sector === 'Core-Alpha'
  ) {
    return { active: true, remainingSec: 3600 };
  }
  return { active: false, remainingSec: 0 };
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
}

export function getItemLevelStyle(level: number) {
  switch (level) {
    case 1:
      return {
        label: 'Lv.1 Common',
        borderClass: 'border-2 border-slate-400 hover:border-slate-300 shadow-[0_0_10px_rgba(148,163,184,0.2)]',
        badgeClass: 'bg-slate-800 text-slate-200 border border-slate-400/60',
        textClass: 'text-slate-200',
        ringColor: '#94a3b8',
      };
    case 2:
      return {
        label: 'Lv.2 Uncommon',
        borderClass: 'border-2 border-emerald-400 hover:border-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.3)]',
        badgeClass: 'bg-emerald-950 text-emerald-300 border border-emerald-400/70',
        textClass: 'text-emerald-300',
        ringColor: '#34d399',
      };
    case 3:
      return {
        label: 'Lv.3 Rare',
        borderClass: 'border-2 border-sky-400 hover:border-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.4)]',
        badgeClass: 'bg-sky-950 text-sky-300 border border-sky-400/70',
        textClass: 'text-sky-300',
        ringColor: '#38bdf8',
      };
    case 4:
      return {
        label: 'Lv.4 Epic',
        borderClass: 'border-2 border-purple-400 hover:border-purple-300 shadow-[0_0_18px_rgba(192,132,252,0.48)]',
        badgeClass: 'bg-purple-950 text-purple-300 border border-purple-400/80',
        textClass: 'text-purple-300',
        ringColor: '#c084fc',
      };
    case 5:
      return {
        label: 'Lv.5 Legendary',
        borderClass: 'border-2 border-amber-400 hover:border-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.55)]',
        badgeClass: 'bg-amber-950 text-amber-300 border border-amber-400/90',
        textClass: 'text-amber-300',
        ringColor: '#fbbf24',
      };
    case 6:
    default:
      return {
        label: 'Lv.6 Mythic',
        borderClass: 'border-2 border-rose-500 hover:border-rose-400 shadow-[0_0_26px_rgba(244,63,94,0.68)]',
        badgeClass: 'bg-rose-950 text-rose-200 border border-rose-400',
        textClass: 'text-rose-300',
        ringColor: '#f43f5e',
      };
  }
}
