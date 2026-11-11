import { msg, t } from '../i18n';
import type { LastOpened, Project } from '../model/types';
import { conversationTitle, type AssistantMessage } from './conversations';

const SCREEN_LABEL: Record<LastOpened['screen'], string> = {
  Script: msg('Script'),
  Storyboard: msg('Storyboard'),
  PanelLayout: msg('Panel layout'),
  Canvas: msg('Canvas'),
  Lettering: msg('Lettering'),
  Outline: msg('Outline'),
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

/** The story the person asked from, or else the one they changed last. */
export function assistantProject(projects: Record<string, Project>, projectId: string | undefined): Project | undefined {
  const asked = projectId ? projects[projectId] : undefined;
  return asked && !asked.deletedAt ? asked : latestProject(projects);
}

export function whereOf(project: Project | undefined, chapterTitle: string | undefined): string {
  if (!project) {
    return t('Home');
  }
  const last = project.lastOpened;
  if (!last) {
    return t('Project overview');
  }
  const label = t(SCREEN_LABEL[last.screen]);
  // quickPrompts matches on the screen name, so every translation keeps {screen} first.
  return chapterTitle ? t('{screen} of chapter "{title}"', { screen: label, title: chapterTitle }) : label;
}

/** A saved answer is titled after the question that prompted it. */
export function noteTitleFor(messages: AssistantMessage[], messageId: string): string {
  const index = messages.findIndex(item => item.id === messageId);
  const question = messages
    .slice(0, Math.max(0, index))
    .reverse()
    .find(item => item.role === 'user');
  return question ? conversationTitle(question.text) : t('Assistant note');
}
