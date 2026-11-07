import type { LastOpened, Project } from '../model/types';
import { conversationTitle, type AssistantMessage } from './conversations';

const SCREEN_LABEL: Record<LastOpened['screen'], string> = {
  Script: 'Script',
  Storyboard: 'Storyboard',
  PanelLayout: 'Panel layout',
  Canvas: 'Canvas',
  Lettering: 'Lettering',
  Outline: 'Outline',
};

export function latestProject(projects: Record<string, Project>): Project | undefined {
  let latest: Project | undefined;
  Object.values(projects).forEach(item => {
    if (!item.deletedAt && (!latest || item.updatedAt > latest.updatedAt)) {
      latest = item;
    }
  });
  return latest;
}

export function whereOf(project: Project | undefined, chapterTitle: string | undefined): string {
  if (!project) {
    return 'Home';
  }
  const last = project.lastOpened;
  if (!last) {
    return 'Project overview';
  }
  const label = SCREEN_LABEL[last.screen];
  return chapterTitle ? `${label} of chapter "${chapterTitle}"` : label;
}

/** A saved answer is titled after the question that prompted it. */
export function noteTitleFor(messages: AssistantMessage[], messageId: string): string {
  const index = messages.findIndex(item => item.id === messageId);
  const question = messages
    .slice(0, Math.max(0, index))
    .reverse()
    .find(item => item.role === 'user');
  return question ? conversationTitle(question.text) : 'Assistant note';
}
