import { chapterNumber, pageNumber } from '../model/selectors';
import type { ID, Project, StoryData } from '../model/types';

/** A screen a story can send the author to. Names and params match the app's route list. */
export type StoryRoute =
  | { name: 'Project' | 'Outline' | 'Preview' | 'Export'; params: { projectId: ID } }
  | { name: 'Script' | 'Storyboard'; params: { chapterId: ID } }
  | { name: 'Lettering'; params: { pageId: ID } }
  | { name: 'PanelLayout'; params: { pageId: ID; mode?: 'panels' | 'art' } }
  | { name: 'Canvas'; params: { pageId: ID; panelId: ID } };

export type ResumeTarget = { where: string; action: string; route: StoryRoute };

export function resumeTarget(state: StoryData, project: Project): ResumeTarget {
  const projectId = project.id;
  const fallback: ResumeTarget = {
    where: 'Story overview',
    action: 'Open story',
    route: { name: 'Project', params: { projectId } },
  };
  const last = project.lastOpened;
  if (!last) {
    return fallback;
  }
  if (last.screen === 'Outline') {
    return { where: 'Outline', action: 'Keep writing', route: { name: 'Outline', params: { projectId } } };
  }
  if (last.screen === 'Script' || last.screen === 'Storyboard') {
    const chapterId = last.chapterId;
    if (!chapterId || !state.chapters[chapterId]) {
      return fallback;
    }
    const number = chapterNumber(project, chapterId);
    return last.screen === 'Script'
      ? { where: `Chapter ${number} script`, action: 'Keep writing', route: { name: 'Script', params: { chapterId } } }
      : {
          where: `Chapter ${number} storyboard`,
          action: 'Keep drawing',
          route: { name: 'Storyboard', params: { chapterId } },
        };
  }
  const pageId = last.pageId;
  const page = pageId ? state.pages[pageId] : undefined;
  if (!pageId || !page) {
    return fallback;
  }
  const where = `Chapter ${chapterNumber(project, page.chapterId)} · Page ${pageNumber(state, pageId).index}`;
  if (last.screen === 'PanelLayout') {
    return { where, action: 'Keep paneling', route: { name: 'PanelLayout', params: { pageId } } };
  }
  if (last.screen === 'Lettering') {
    return { where, action: 'Keep lettering', route: { name: 'Lettering', params: { pageId } } };
  }
  const panelId = last.panelId;
  if (!panelId || !page.panels[panelId]) {
    return { where, action: 'Keep drawing', route: { name: 'PanelLayout', params: { pageId, mode: 'art' } } };
  }
  return { where, action: 'Keep drawing', route: { name: 'Canvas', params: { pageId, panelId } } };
}
