import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { askAssistant, quickPrompts, type AssistantTurn } from '../../core/ai/assistant';
import { storyBrief } from '../../core/ai/context';
import { latestProject, noteTitleFor, whereOf } from '../../core/assistant/where';
import type { ID } from '../../core/model/types';
import { copyText } from '../../native/files';
import { useAppNavigation } from '../../state/navigation';
import { useAiTask } from '../../state/useAiTask';
import {
  conversationsOf,
  projectKeyOf,
  useAssistant,
  type AssistantMessage,
  type Conversation,
} from '../../state/useAssistant';
import { useStory } from '../../state/useStory';
import { confirm, snackbar, toast } from '../../ui';

export function useAssistantChat() {
  const navigation = useAppNavigation();
  const project = useStory(useShallow(s => latestProject(s.projects)));
  const chapterTitle = useStory(s => {
    const chapterId = project?.lastOpened?.chapterId;
    return chapterId ? s.chapters[chapterId]?.title : undefined;
  });
  const projectKey = projectKeyOf(project?.id);
  const conversations = useAssistant(useShallow(s => conversationsOf(s.conversations, projectKey)));
  const activeId = useAssistant(s => s.activeByProject[projectKey]);
  const active: Conversation | undefined = useMemo(
    () => conversations.find(item => item.id === activeId) ?? conversations[0],
    [conversations, activeId],
  );
  const where = whereOf(project, chapterTitle);
  const prompts = useMemo(() => quickPrompts(where, !!project), [where, project]);

  const { state: ai, start, cancel, reset } = useAiTask<string>();
  const [input, setInput] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const pending = useRef<{ conversationId: ID; question: string } | null>(null);
  const loading = ai.status === 'loading';

  const ask = useCallback(
    (conversationId: ID, question: string) => {
      pending.current = { conversationId, question };
      const story = useStory.getState();
      const brief = project ? storyBrief(story, project.id, { chapterId: project.lastOpened?.chapterId }).text : '';
      const turns = useAssistant.getState().conversations[conversationId]?.messages ?? [];
      const history: AssistantTurn[] = turns.slice(0, -1).map(turn => ({ role: turn.role, text: turn.text }));
      start(signal => askAssistant({ brief, where }, history, question, signal)).then(answer => {
        if (answer) {
          useAssistant.getState().addMessage(conversationId, 'assistant', answer);
          reset();
        }
      });
    },
    [project, where, start, reset],
  );

  const send = (raw: string) => {
    const question = raw.trim();
    if (!question || loading) {
      return;
    }
    const store = useAssistant.getState();
    const conversationId = active?.id ?? store.startConversation(projectKey);
    if (!store.activeByProject[projectKey]) {
      store.setActive(projectKey, conversationId);
    }
    store.addMessage(conversationId, 'user', question);
    setInput('');
    ask(conversationId, question);
  };

  const retry = () => {
    if (pending.current) {
      ask(pending.current.conversationId, pending.current.question);
    }
  };

  const copy = (message: AssistantMessage) => {
    try {
      copyText(message.text);
      toast('Copied');
    } catch {
      toast('Could not copy');
    }
  };

  const saveNote = (message: AssistantMessage) => {
    if (!project || !active) {
      return;
    }
    const entryId = useStory.getState().addWorldEntry(project.id, 'note', {
      title: noteTitleFor(active.messages, message.id),
      body: message.text,
      fromAssistant: true,
    });
    snackbar({
      message: 'Saved as a note in the world wiki',
      actionLabel: 'Open',
      onAction: () => navigation.navigate('WorldEntry', { entryId }),
    });
  };

  const startNew = () => {
    cancel();
    useAssistant.getState().startConversation(projectKey);
    setListOpen(false);
  };

  const pick = (conversation: Conversation) => {
    if (conversation.id !== active?.id) {
      cancel();
    }
    useAssistant.getState().setActive(projectKey, conversation.id);
    setListOpen(false);
  };

  const remove = async (conversation: Conversation) => {
    const ok = await confirm('Delete this conversation?', conversation.title, {
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) {
      if (conversation.id === active?.id) {
        cancel();
      }
      useAssistant.getState().removeConversation(conversation.id);
    }
  };

  return {
    project,
    where,
    prompts,
    conversations,
    active,
    ai,
    loading,
    input,
    setInput,
    listOpen,
    setListOpen,
    send,
    retry,
    copy,
    saveNote,
    startNew,
    pick,
    remove,
    cancel,
    reset,
  };
}
