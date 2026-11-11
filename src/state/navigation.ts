import { createNavigationContainerRef, useNavigation, useRoute, type NavigatorScreenParams, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import type { ID } from '../core/model/types';

export type TabParamList = {
  Home: undefined;
  Library: undefined;
  Assistant: { projectId?: ID } | undefined;
  Profile: undefined;
};

type StoryDraft = { title: string; genres: string[]; logline: string };

export type RootStackParamList = {
  Welcome: undefined;
  Preferences: { edit?: boolean } | undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  NewProject: { idea?: string; draft?: StoryDraft } | undefined;
  Project: { projectId: ID };
  Outline: { projectId: ID };
  Script: { chapterId: ID; blockId?: ID };
  Character: { characterId: ID };
  World: { projectId: ID };
  WorldEntry: { entryId: ID };
  Storyboard: { chapterId: ID };
  PanelLayout: { pageId: ID; mode?: 'panels' | 'art' };
  Canvas: { pageId: ID; panelId: ID };
  Lettering: { pageId: ID };
  Preview: { projectId: ID; chapterId?: ID };
  Export: { projectId: ID; chapterId?: ID };
  Trash: undefined;
  About: undefined;
  Journey: undefined;
  Club: { chapterId?: ID } | undefined;
  Mailbox: undefined;
  Cards: { characterId?: ID } | undefined;
  Magazine: undefined;
  // Play together nearby
  Nearby: undefined;
  Room: undefined;
  CoDraw: { pageId?: ID } | undefined;
  Relay: undefined;
  Battle: undefined;
  Guess: undefined;
  ScriptTogether: undefined;
  ReadTogether: { projectId: ID } | undefined;
  Dub: { chapterId?: ID } | undefined;
  CardSwap: undefined;
  MangakaCard: undefined;
  SendStory: undefined;
  ScanCode: undefined;
};

/** The app's one navigator, for code that runs outside a screen: links opened from another app or a scanned code. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export type AppNavigation = NativeStackNavigationProp<RootStackParamList>;

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export function useAppNavigation(): AppNavigation {
  return useNavigation<AppNavigation>();
}

export function useAppRoute<T extends keyof RootStackParamList>(): RouteProp<RootStackParamList, T> {
  return useRoute<RouteProp<RootStackParamList, T>>();
}
