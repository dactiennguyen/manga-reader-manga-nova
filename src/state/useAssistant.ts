import { create } from 'zustand';

import {
  appendMessage,
  conversationsOf,
  pruneConversations,
  type AssistantData,
  type AssistantMessage,
  type AssistantRole,
  type Conversation,
} from '../core/assistant/conversations';
import type { ID } from '../core/model/types';
import { uid } from '../core/util/id';

export * from '../core/assistant/conversations';

export type AssistantStorage = {
  load: () => Conversation[];
  save: (conversation: Conversation) => void;
  remove: (conversationId: ID) => void;
};

type AssistantActions = {
  startConversation: (projectKey: string) => ID;
  setActive: (projectKey: string, conversationId: ID) => void;
  addMessage: (conversationId: ID, role: AssistantRole, text: string) => ID;
  removeConversation: (conversationId: ID) => void;
  reset: () => void;
};

const EMPTY: AssistantData = { conversations: {}, activeByProject: {} };

let storage: AssistantStorage | null = null;
let lastStamp = 0;

function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

function sync(before: Record<ID, Conversation>, after: Record<ID, Conversation>): void {
  if (!storage) {
    return;
  }
  for (const id of Object.keys(before)) {
    if (!after[id]) {
      storage.remove(id);
    }
  }
  for (const conversation of Object.values(after)) {
    if (before[conversation.id] !== conversation) {
      storage.save(conversation);
    }
  }
}

export const useAssistant = create<AssistantData & AssistantActions>()((set, get) => {
  const change = (next: Partial<AssistantData>) => {
    const before = get().conversations;
    set(next);
    sync(before, get().conversations);
  };
  return {
    ...EMPTY,

    startConversation: projectKey => {
      const id = uid();
      const now = stamp();
      const state = get();
      const conversation: Conversation = {
        id,
        projectKey,
        title: 'New conversation',
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      const empties = conversationsOf(state.conversations, projectKey).filter(item => item.messages.length === 0);
      const conversations = { ...state.conversations };
      empties.forEach(item => delete conversations[item.id]);
      conversations[id] = conversation;
      change({
        conversations: pruneConversations(conversations, projectKey),
        activeByProject: { ...state.activeByProject, [projectKey]: id },
      });
      return id;
    },

    setActive: (projectKey, conversationId) =>
      set(state => ({ activeByProject: { ...state.activeByProject, [projectKey]: conversationId } })),

    addMessage: (conversationId, role, text) => {
      const id = uid();
      const conversation = get().conversations[conversationId];
      if (conversation) {
        const message: AssistantMessage = { id, role, text, at: stamp() };
        change({ conversations: { ...get().conversations, [conversationId]: appendMessage(conversation, message) } });
      }
      return id;
    },

    removeConversation: conversationId => {
      const conversation = get().conversations[conversationId];
      if (!conversation) {
        return;
      }
      const conversations = { ...get().conversations };
      delete conversations[conversationId];
      const activeByProject = { ...get().activeByProject };
      if (activeByProject[conversation.projectKey] === conversationId) {
        delete activeByProject[conversation.projectKey];
      }
      change({ conversations, activeByProject });
    },

    reset: () => change(EMPTY),
  };
});

export function connectAssistant(next: AssistantStorage | null): void {
  storage = next;
  const conversations: Record<ID, Conversation> = {};
  next?.load().forEach(item => {
    conversations[item.id] = item;
  });
  useAssistant.setState({ conversations, activeByProject: {} });
}
