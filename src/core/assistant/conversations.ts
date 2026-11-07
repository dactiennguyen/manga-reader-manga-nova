import type { ID } from '../model/types';

export type AssistantRole = 'user' | 'assistant';

export type AssistantMessage = { id: ID; role: AssistantRole; text: string; at: number };

export type Conversation = {
  id: ID;
  projectKey: string;
  title: string;
  messages: AssistantMessage[];
  createdAt: number;
  updatedAt: number;
};

export const MAX_CONVERSATIONS = 20;
export const TITLE_MAX = 48;
export const NO_STORY_KEY = 'none';

export function projectKeyOf(projectId: ID | undefined | null): string {
  return projectId || NO_STORY_KEY;
}

export function conversationTitle(question: string): string {
  const clean = question.replace(/\s+/g, ' ').trim();
  if (!clean) {
    return 'New conversation';
  }
  if (clean.length <= TITLE_MAX) {
    return clean;
  }
  const cut = clean.slice(0, TITLE_MAX);
  const space = cut.lastIndexOf(' ');
  return `${(space > TITLE_MAX / 2 ? cut.slice(0, space) : cut).trim()}…`;
}

export function conversationsOf(conversations: Record<ID, Conversation>, projectKey: string): Conversation[] {
  return Object.values(conversations)
    .filter(item => item.projectKey === projectKey)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function pruneConversations(
  conversations: Record<ID, Conversation>,
  projectKey: string,
  max = MAX_CONVERSATIONS,
): Record<ID, Conversation> {
  const kept = conversationsOf(conversations, projectKey).slice(0, max);
  const keptIds = new Set(kept.map(item => item.id));
  const next: Record<ID, Conversation> = {};
  Object.values(conversations).forEach(item => {
    if (item.projectKey !== projectKey || keptIds.has(item.id)) {
      next[item.id] = item;
    }
  });
  return next;
}

export function appendMessage(conversation: Conversation, message: AssistantMessage): Conversation {
  const first = conversation.messages.length === 0 && message.role === 'user';
  return {
    ...conversation,
    title: first ? conversationTitle(message.text) : conversation.title,
    messages: [...conversation.messages, message],
    updatedAt: message.at,
  };
}

export type AssistantData = {
  conversations: Record<ID, Conversation>;
  activeByProject: Record<string, ID>;
};
