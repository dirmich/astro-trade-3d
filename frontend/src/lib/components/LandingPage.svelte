<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentLang, getSupportedLocales, t } from '../i18n';
  import { SUPERUSER_EMAIL } from '../stores/gameStore';

  const dispatch = createEventDispatcher<{
    googleLogin: { email: string; name: string };
    passwordLogin: { email: string; password: string };
    registerPilot: { email: string; password: string; pilotName: string; shipName: string };
  }>();

  let customGoogleEmail = 'pilot.alex@gmail.com';
  let customGoogleName = 'Captain Alex';
  let showGooglePicker = false;
  let authTab: 'GOOGLE' | 'LOGIN' | 'REGISTER' = 'GOOGLE';

  let loginEmail = SUPERUSER_EMAIL;
  let loginPassword = 'AstroAdmin!2026#';

  let regEmail = '';
  let regPassword = '';
  let regPilotName = '';
  let regShipName = 'StarRunner MK-I';

  const locales = getSupportedLocales();
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
>
  <div
    class="max-w-4xl w-full rounded-3xl bg-slate-900/95 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.25)] p-6 md:p-8 space-y-6"
  >
    <!-- Top Bar: Brand + Language Selector (English Default + KO/JA/ZH) -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
      <div>
        <div class="flex items-center gap-2.5">
          <span class="text-2xl">🚀</span>
          <h1 class="font-['Orbitron'] text-2xl md:text-3xl font-extrabold text-cyan-400 tracking-wider">
            {$t.appTitle}
          </h1>
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
            MULTIPLAYER v2.0
          </span>
        </div>
        <p class="text-xs md:text-sm text-slate-300 mt-1">{$t.landingSubtitle}</p>
      </div>

      <!-- Modular Language Switcher -->
      <div class="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
        {#each locales as loc}
          <button
            on:click={() => currentLang.set(loc.code)}
            class="px-2.5 py-1 rounded-lg text-xs font-bold transition {$currentLang === loc.code
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'}"
          >
            {loc.flag} {loc.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Core Feature Highlights -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <div class="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-1">
        <div class="text-sm font-bold text-emerald-300">🛸 {$t.featureManualFlight}</div>
        <p class="text-xs text-slate-400 leading-relaxed">{$t.featureManualFlightDesc}</p>
      </div>
      <div class="p-4 rounded-2xl bg-slate-950/80 border border-rose-500/30 space-y-1">
        <div class="text-sm font-bold text-rose-300">🏴‍☠️ {$t.featurePirateRaid}</div>
        <p class="text-xs text-slate-400 leading-relaxed">{$t.featurePirateRaidDesc}</p>
      </div>
      <div class="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 space-y-1">
        <div class="text-sm font-bold text-amber-300">📈 {$t.featureDynamicLevel}</div>
        <p class="text-xs text-slate-400 leading-relaxed">{$t.featureDynamicLevelDesc}</p>
      </div>
      <div class="p-4 rounded-2xl bg-slate-950/80 border border-fuchsia-500/30 space-y-1">
        <div class="text-sm font-bold text-fuchsia-300">🗺️ {$t.featureSectorMap}</div>
        <p class="text-xs text-slate-400 leading-relaxed">{$t.featureSectorMapDesc}</p>
      </div>
    </div>

    <!-- Authentication Tabs: Google SSO / Email Login / New Pilot Register -->
    <div class="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4">
      <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          on:click={() => (authTab = 'GOOGLE')}
          class="px-4 py-1.5 rounded-xl text-xs font-bold transition {authTab === 'GOOGLE'
            ? 'bg-white text-slate-950'
            : 'bg-slate-800 text-slate-300'}"
        >
          {$t.authTabGoogle}
        </button>
        <button
          on:click={() => (authTab = 'LOGIN')}
          class="px-4 py-1.5 rounded-xl text-xs font-bold transition {authTab === 'LOGIN'
            ? 'bg-cyan-600 text-white'
            : 'bg-slate-800 text-slate-300'}"
        >
          {$t.authTabLogin}
        </button>
        <button
          on:click={() => (authTab = 'REGISTER')}
          class="px-4 py-1.5 rounded-xl text-xs font-bold transition {authTab === 'REGISTER'
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-800 text-slate-300'}"
        >
          {$t.authTabRegister}
        </button>
      </div>

      {#if authTab === 'GOOGLE'}
        <div class="space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <!-- 1. Google SSO as Superuser (Admin Menu Enabled) -->
            <button
              on:click={() =>
                dispatch('googleLogin', {
                  email: SUPERUSER_EMAIL,
                  name: 'Supreme Commander (Admin)',
                })}
              class="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-lg transition"
            >
              <span class="text-base">👑</span>
              <span>{$t.googleAdminLoginBtn}</span>
            </button>

            <!-- 2. Google SSO as Standard Pilot (Starts with 3,500 CR tight budget) -->
            <button
              on:click={() => (showGooglePicker = !showGooglePicker)}
              class="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg transition"
            >
              <span class="text-base">🌐</span>
              <span>{$t.googleLoginBtn} ({$t.pilotAccountSuffix})</span>
            </button>
          </div>

          {#if showGooglePicker}
            <div class="p-4 rounded-xl bg-slate-900 border border-cyan-500/40 space-y-2.5">
              <div class="text-xs font-bold text-cyan-300">{$t.googleAccountSelector}</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  bind:value={customGoogleEmail}
                  class="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  placeholder={$t.emailPlaceholder}
                />
                <input
                  bind:value={customGoogleName}
                  class="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  placeholder={$t.callsignPlaceholder}
                />
              </div>
              <button
                on:click={() =>
                  dispatch('googleLogin', {
                    email: customGoogleEmail,
                    name: customGoogleName,
                  })}
                class="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                {$t.continueWithGoogle} ({customGoogleEmail})
              </button>
            </div>
          {/if}
        </div>
      {:else if authTab === 'LOGIN'}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <input
            bind:value={loginEmail}
            class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            placeholder={$t.emailPlaceholder}
          />
          <input
            type="password"
            bind:value={loginPassword}
            class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            placeholder={$t.passwordPlaceholder}
          />
          <button
            on:click={() => dispatch('passwordLogin', { email: loginEmail, password: loginPassword })}
            class="py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
          >
            🚀 {$t.enterUniverse}
          </button>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <input
            bind:value={regEmail}
            class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            placeholder={$t.emailPlaceholder}
          />
          <input
            type="password"
            bind:value={regPassword}
            class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            placeholder={$t.passwordPlaceholder}
          />
          <input
            bind:value={regPilotName}
            class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            placeholder={$t.callsignPlaceholder}
          />
          <input
            bind:value={regShipName}
            class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            placeholder={$t.shipNamePlaceholder}
          />
          <button
            on:click={() =>
              dispatch('registerPilot', {
                email: regEmail,
                password: regPassword,
                pilotName: regPilotName,
                shipName: regShipName,
              })}
            class="md:col-span-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          >
            {$t.registerNewPilotBtn}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
