/**
 * Modular Internationalization (i18n) System (`frontend/src/lib/i18n/index.ts`)
 * - Default language: English ('en')
 * - Built-in support: English ('en'), Korean ('ko'), Japanese ('ja'), Chinese ('zh')
 * - Extensible via `registerLocale(code, label, dictionary)`
 */
import { writable, derived } from 'svelte/store';
import { en } from './locales/en';
import { ko } from './locales/ko';
import { ja } from './locales/ja';
import { zh } from './locales/zh';

export type LocaleCode = 'en' | 'ko' | 'ja' | 'zh' | string;
export type TranslationDict = typeof en & Record<string, string>;

export interface LocaleInfo {
  code: LocaleCode;
  label: string;
  flag: string;
  dict: TranslationDict;
}

const localeRegistry = new Map<LocaleCode, LocaleInfo>();

export function registerLocale(code: LocaleCode, label: string, flag: string, dict: Partial<TranslationDict>) {
  localeRegistry.set(code, {
    code,
    label,
    flag,
    dict: { ...en, ...dict } as TranslationDict,
  });
}

// Register default 4 languages (English is default!)
registerLocale('en', 'English', '🇺🇸', en);
registerLocale('ko', '한국어', '🇰🇷', ko);
registerLocale('ja', '日本語', '🇯🇵', ja);
registerLocale('zh', '中文', '🇨🇳', zh);

export function getSupportedLocales(): LocaleInfo[] {
  return Array.from(localeRegistry.values());
}

// Default language is Korean ('ko')
export const currentLang = writable<LocaleCode>('ko');

export const t = derived(currentLang, ($lang) => {
  const entry = localeRegistry.get($lang) || localeRegistry.get('en')!;
  return entry.dict;
});

/**
 * Helper to return localized entity name (Planet, Resource, Item, Pirate)
 * based on the current active language.
 */
export function localName(entity: any, lang: LocaleCode): string {
  if (!entity) return '';
  if (lang === 'ko') {
    return entity.name_ko || entity.name_en || entity.name || '';
  }
  return entity.name_en || entity.name || entity.name_ko || '';
}
