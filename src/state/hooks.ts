import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { chapterIdsOf, charactersOf } from '../core/model/selectors';
import type { Chapter, Character, ID, LastOpened, Page, Project, StoryData } from '../core/model/types';
import { useStory } from './useStory';

export function useProject(projectId: ID | undefined): Project | undefined {
  return useStory(s => (projectId ? s.projects[projectId] : undefined));
}

export function useChapter(chapterId: ID | undefined): Chapter | undefined {
  return useStory(s => (chapterId ? s.chapters[chapterId] : undefined));
}

export function usePage(pageId: ID | undefined): Page | undefined {
  return useStory(s => (pageId ? s.pages[pageId] : undefined));
}

export function useProjectOfChapter(chapterId: ID | undefined): Project | undefined {
  return useStory(s => {
    const chapter = chapterId ? s.chapters[chapterId] : undefined;
    return chapter ? s.projects[chapter.projectId] : undefined;
  });
}

export function useProjectOfPage(pageId: ID | undefined): Project | undefined {
  return useStory(s => {
    const page = pageId ? s.pages[pageId] : undefined;
    const chapter = page ? s.chapters[page.chapterId] : undefined;
    return chapter ? s.projects[chapter.projectId] : undefined;
  });
}

export function useChapters(projectId: ID | undefined): Chapter[] {
  return useStory(
    useShallow(s =>
      chapterIdsOf(projectId ? s.projects[projectId] : undefined)
        .map(id => s.chapters[id])
        .filter(Boolean),
    ),
  );
}

export function useCharacters(projectId: ID | undefined): Character[] {
  return useStory(useShallow(s => (projectId ? charactersOf(s, projectId) : [])));
}

export function useLastOpened(projectId: ID | undefined, lastOpened: LastOpened): void {
  const { screen, chapterId, pageId, panelId } = lastOpened;
  useFocusEffect(
    useCallback(() => {
      if (projectId) {
        useStory.getState().setLastOpened(projectId, { screen, chapterId, pageId, panelId });
      }
    }, [projectId, screen, chapterId, pageId, panelId]),
  );
}

export function useStoryData(): StoryData {
  const projects = useStory(s => s.projects);
  const chapters = useStory(s => s.chapters);
  const scenes = useStory(s => s.scenes);
  const characters = useStory(s => s.characters);
  const relations = useStory(s => s.relations);
  const world = useStory(s => s.world);
  const pages = useStory(s => s.pages);
  return useMemo(
    () => ({ projects, chapters, scenes, characters, relations, world, pages }),
    [projects, chapters, scenes, characters, relations, world, pages],
  );
}

/**
 * The live value while the screen is in sight, and the last one it showed while it is not. A screen that
 * stays mounted under another (Home under the canvas) uses it so nothing it derives is worked out again
 * until it comes back.
 */
export function useWhileFocused<T>(live: T): T {
  const focused = useIsFocused();
  const [kept, setKept] = useState(live);
  if (focused && kept !== live) {
    setKept(live);
  }
  return focused ? live : kept;
}
