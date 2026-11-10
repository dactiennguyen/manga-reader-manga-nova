import { create } from 'zustand';

import { normalizeBaseUrl } from '../core/ai/port';
import { resolveLocale, setLocale, type LanguageChoice, type Locale } from '../core/i18n';
import type { ArtStyle } from '../core/model/types';
import type { MetaRepo } from '../core/ports';

export type ThemeMode = 'system' | 'light' | 'dark';

export type CreatorRole = 'write' | 'draw' | 'both';

export type Handedness = 'right' | 'left';

export type AppSettings = {
  themeMode: ThemeMode;
  /** The interface language. `system` follows the device and falls back to English. */
  language: LanguageChoice;
  handedness: Handedness;
  keepAwakeWhileDrawing: boolean;
  haptics: boolean;
  onboarded: boolean;
  onboardingStep: number;
  penName: string;
  role: CreatorRole;
  favoriteGenres: string[];
  defaultStyle: ArtStyle;
  libraryLayout: 'grid' | 'list';
  librarySort: 'updated' | 'title' | 'created';
  canvasTipsSeen: boolean;
  /** Colours drawn with lately, newest first, and the palette the person saved. Rules are in core/art/palette. */
  recentColors: string[];
  savedColors: string[];
  tipDismissedDay: string;
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
  /** Sample answers while no server is set, so the AI tools can be tried. */
  aiDemo: boolean;
  /** Strokes to draw each day. 0 turns the goal off. */
  dailyGoal: number;
  reminderOn: boolean;
  /** Hour of the day, 0 to 23. */
  reminderHour: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'light',
  language: 'system',
  handedness: 'right',
  keepAwakeWhileDrawing: true,
  haptics: true,
  onboarded: false,
  onboardingStep: 0,
  penName: '',
  role: 'both',
  favoriteGenres: [],
  defaultStyle: 'shounen',
  libraryLayout: 'grid',
  librarySort: 'updated',
  canvasTipsSeen: false,
  recentColors: [],
  savedColors: [],
  tipDismissedDay: '',
  aiBaseUrl: '',
  aiModel: 'gemini-3.6-flash',
  aiApiKey: '',
  aiDemo: true,
  dailyGoal: 100,
  reminderOn: false,
  reminderHour: 20,
};

const KEY = 'settings';

let repo: MetaRepo | null = null;

type SettingsActions = {
  set: (patch: Partial<AppSettings>) => void;
  reset: () => void;
};

function pick({ set: _set, reset: _reset, ...settings }: AppSettings & SettingsActions): AppSettings {
  return settings;
}

export const useSettings = create<AppSettings & SettingsActions>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  set: patch => {
    set(patch);
    repo?.set(KEY, JSON.stringify(pick(get())));
  },
  reset: () => {
    set(DEFAULT_SETTINGS);
    repo?.remove(KEY);
  },
}));

export function connectSettings(next: MetaRepo | null): void {
  repo = next;
  const raw = next?.get(KEY);
  useSettings.setState({ ...DEFAULT_SETTINGS, ...(raw ? (JSON.parse(raw) as Partial<AppSettings>) : null) });
}

/** The meta table, for small records that are not settings. Null until boot connects it. */
export function metaStore(): MetaRepo | null {
  return repo;
}

function serverSet(settings: AppSettings): boolean {
  return normalizeBaseUrl(settings.aiBaseUrl) !== '';
}

/** True when AI tools can answer: from the person's server, or with sample answers. */
export function aiConfigured(): boolean {
  const settings = useSettings.getState();
  return serverSet(settings) || settings.aiDemo;
}

export function useAiConfigured(): boolean {
  return useSettings(s => serverSet(s) || s.aiDemo);
}

export function aiServerSet(): boolean {
  return serverSet(useSettings.getState());
}

/** For tools that sample answers cannot stand in for, such as translating. */
export function useAiServerSet(): boolean {
  return useSettings(serverSet);
}

export function useAiDemo(): boolean {
  return useSettings(s => !serverSet(s) && s.aiDemo);
}

function deviceLanguage(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return 'en';
  }
}

/** Applies the chosen language before the screens draw, and re-renders the caller when it changes. */
export function useAppLocale(): Locale {
  const locale = resolveLocale(
    useSettings(s => s.language),
    deviceLanguage(),
  );
  setLocale(locale);
  return locale;
}
