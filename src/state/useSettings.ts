import { create } from 'zustand';

import { normalizeBaseUrl } from '../core/ai/port';
import type { ArtStyle } from '../core/model/types';
import type { MetaRepo } from '../core/ports';

export type ThemeMode = 'system' | 'light' | 'dark';

export type CreatorRole = 'write' | 'draw' | 'both';

export type Handedness = 'right' | 'left';

export type AppSettings = {
  themeMode: ThemeMode;
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
  tipDismissedDay: string;
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'dark',
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
  tipDismissedDay: '',
  aiBaseUrl: '',
  aiModel: 'gemini-3.6-flash',
  aiApiKey: '',
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

export function aiConfigured(): boolean {
  return normalizeBaseUrl(useSettings.getState().aiBaseUrl) !== '';
}

export function useAiConfigured(): boolean {
  return useSettings(s => normalizeBaseUrl(s.aiBaseUrl) !== '');
}
