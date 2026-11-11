import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, View } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { HistoryIcon, SendIcon, StopIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import { useAppNavigation, type TabParamList } from '../../state/navigation';
import { useAiReports } from '../../state/useAiReports';
import { useAiConfigured, useAiDemo } from '../../state/useSettings';
import { AiErrorBox, AiLoading, AiNote, AppBar, ICON, IconButton, Screen, TextField, useDockInset } from '../../ui';
import {
  AssistantBubble,
  ConversationsSheet,
  NotConfiguredNotice,
  ReportedBubble,
  UserBubble,
  WelcomePanel,
} from './AssistantParts';
import { useAssistantChat } from './useAssistantChat';

const QUESTION_MAX = 2000;

export function AssistantScreen() {
  const navigation = useAppNavigation();
  const dockInset = useDockInset();
  const keyboardOpen = useKeyboardState(state => state.isVisible);
  const configured = useAiConfigured();
  const demo = useAiDemo();
  const tab = useNavigation<NavigationProp<TabParamList, 'Assistant'>>();
  const { params } = useRoute<RouteProp<TabParamList, 'Assistant'>>();
  const chat = useAssistantChat(params?.projectId);
  const { active, ai, conversations, input, loading, project, where } = chat;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const reports = useAiReports(s => s.reports);
  const reported = useMemo(() => new Set(reports.map(report => report.answerId).filter(Boolean)), [reports]);
  /** Reported answers the person chose to see again, for this visit only. */
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  const toggleShown = (id: string, on: boolean) =>
    setShown(prev => {
      const next = new Set(prev);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });

  /** A story passed in holds only for this visit: the dock opens the latest one. */
  useFocusEffect(useCallback(() => () => tab.setParams({ projectId: undefined }), [tab]));

  const messages = active?.messages ?? [];
  const canSend = configured && !loading && input.trim().length > 0;

  return (
    // The keyboard covers the dock, so the composer must not stay lifted above it.
    <Screen padded={false} keyboard bottom={!keyboardOpen} bottomInset={keyboardOpen ? 0 : dockInset}>
      <AppBar
        title={project ? project.title || t('Untitled') : t('Assistant')}
        subtitle={project ? t(where) : t('No story open · general manga questions')}
        hideBack
        right={
          <IconButton
            icon={HistoryIcon}
            badge={conversations.length > 1 ? conversations.length : undefined}
            onPress={() => chat.setListOpen(true)}
            accessibilityLabel={t('Conversations')}
          />
        }
      />
      <ScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="grow gap-3 p-4"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {!configured && (
          <NotConfiguredNotice onOpenProfile={() => navigation.navigate('Tabs', { screen: 'Profile' })} />
        )}
        {demo && <AiNote text={t('Sample answers. Add an AI server in Profile for answers about your story.')} />}
        {messages.length === 0 && <WelcomePanel project={project} prompts={chat.prompts} onPrompt={chat.send} />}
        {messages.map(message =>
          message.role === 'user' ? (
            <UserBubble key={message.id} message={message} />
          ) : reported.has(message.id) && !shown.has(message.id) ? (
            <ReportedBubble key={message.id} onShow={() => toggleShown(message.id, true)} />
          ) : (
            <AssistantBubble
              key={message.id}
              message={message}
              onCopy={() => chat.copy(message)}
              onSave={project ? () => chat.saveNote(message) : undefined}
              reported={reported.has(message.id)}
              onHide={() => toggleShown(message.id, false)}
            />
          ),
        )}
        {loading && <AiLoading label={t('Thinking…')} onCancel={chat.cancel} />}
        {ai.status === 'error' && <AiErrorBox message={ai.message} onRetry={chat.retry} onCancel={chat.reset} />}
      </ScrollView>
      <View className="flex-row items-end gap-2 bg-surface px-3 py-2">
        <TextField
          multiline
          value={input}
          onChangeText={chat.setInput}
          placeholder={project ? t('Ask about your story…') : t('Ask a manga question…')}
          maxLength={QUESTION_MAX}
          editable={configured}
          accessibilityLabel={t('Message')}
          className="flex-1"
          inputClassName="max-h-[120px]"
        />
        {loading ? (
          <IconButton
            icon={StopIcon}
            size={ICON.lg}
            color="danger"
            onPress={chat.cancel}
            accessibilityLabel={t('Stop')}
            className="rounded-full bg-danger/15"
          />
        ) : (
          <IconButton
            icon={SendIcon}
            size={ICON.md}
            color="on-ai"
            disabled={!canSend}
            onPress={() => chat.send(input)}
            accessibilityLabel={t('Send')}
            className="rounded-full bg-ai"
          />
        )}
      </View>

      <ConversationsSheet
        visible={chat.listOpen}
        onClose={() => chat.setListOpen(false)}
        subtitle={project ? project.title || t('Untitled') : t('Without a story')}
        conversations={conversations}
        activeId={active?.id}
        onNew={chat.startNew}
        onPick={chat.pick}
        onRemove={chat.remove}
      />
    </Screen>
  );
}
