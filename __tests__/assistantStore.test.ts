import {
  MAX_CONVERSATIONS,
  TITLE_MAX,
  appendMessage,
  conversationTitle,
  conversationsOf,
  projectKeyOf,
  pruneConversations,
  useAssistant,
  type Conversation,
} from '../src/state/useAssistant';

function conversation(id: string, projectKey: string, updatedAt: number): Conversation {
  return { id, projectKey, title: id, messages: [], createdAt: updatedAt, updatedAt };
}

describe('conversationTitle', () => {
  it('uses the first question, collapsed to one line', () => {
    expect(conversationTitle('  Is this   scene\ndragging? ')).toBe('Is this scene dragging?');
  });

  it('falls back when the question is empty', () => {
    expect(conversationTitle('   ')).toBe('New conversation');
  });

  it('shortens long questions at a word boundary', () => {
    const long = 'Can you tell me how to pace a twenty page chapter so the climax lands on a spread near the end';
    const title = conversationTitle(long);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX + 1);
    expect(title.endsWith('…')).toBe(true);
    const head = title.slice(0, -1);
    expect(long.startsWith(head)).toBe(true);
    expect(long[head.length]).toBe(' ');
  });
});

describe('appendMessage', () => {
  it('titles the conversation from its first user message only', () => {
    const base = conversation('a', 'p', 1);
    const first = appendMessage(base, { id: 'm1', role: 'user', text: 'Suggest a title', at: 2 });
    expect(first.title).toBe('Suggest a title');
    expect(first.updatedAt).toBe(2);
    const second = appendMessage(first, { id: 'm2', role: 'assistant', text: 'How about Moon Island?', at: 3 });
    const third = appendMessage(second, { id: 'm3', role: 'user', text: 'Another one', at: 4 });
    expect(third.title).toBe('Suggest a title');
    expect(third.messages.map(item => item.id)).toEqual(['m1', 'm2', 'm3']);
  });
});

describe('pruneConversations', () => {
  it('keeps the newest conversations of a project and leaves other projects alone', () => {
    const all: Record<string, Conversation> = {};
    for (let i = 0; i < MAX_CONVERSATIONS + 5; i++) {
      all[`a${i}`] = conversation(`a${i}`, 'p', i);
    }
    all.other = conversation('other', 'q', 0);
    const pruned = pruneConversations(all, 'p');
    const kept = conversationsOf(pruned, 'p');
    expect(kept).toHaveLength(MAX_CONVERSATIONS);
    expect(kept[0].id).toBe(`a${MAX_CONVERSATIONS + 4}`);
    expect(pruned.a0).toBeUndefined();
    expect(pruned.a4).toBeUndefined();
    expect(pruned.a5).toBeDefined();
    expect(pruned.other).toBeDefined();
  });
});

describe('useAssistant store', () => {
  beforeEach(() => useAssistant.getState().reset());

  it('maps a missing project to the shared no-story key', () => {
    expect(projectKeyOf(undefined)).toBe('none');
    expect(projectKeyOf('p1')).toBe('p1');
  });

  it('caps a project at twenty conversations', () => {
    const store = useAssistant.getState();
    for (let i = 0; i < MAX_CONVERSATIONS + 3; i++) {
      const id = store.startConversation('p');
      store.addMessage(id, 'user', `Question ${i}`);
    }
    const list = conversationsOf(useAssistant.getState().conversations, 'p');
    expect(list).toHaveLength(MAX_CONVERSATIONS);
    expect(list[0].title).toBe(`Question ${MAX_CONVERSATIONS + 2}`);
    expect(list.some(item => item.title === 'Question 0')).toBe(false);
  });

  it('replaces an untouched conversation instead of piling up empty ones', () => {
    const store = useAssistant.getState();
    store.startConversation('p');
    const second = store.startConversation('p');
    const list = conversationsOf(useAssistant.getState().conversations, 'p');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(second);
    expect(useAssistant.getState().activeByProject.p).toBe(second);
  });

  it('removes a conversation and clears it as the active one', () => {
    const store = useAssistant.getState();
    const id = store.startConversation('p');
    store.addMessage(id, 'user', 'Hello');
    store.removeConversation(id);
    expect(useAssistant.getState().conversations[id]).toBeUndefined();
    expect(useAssistant.getState().activeByProject.p).toBeUndefined();
  });
});
