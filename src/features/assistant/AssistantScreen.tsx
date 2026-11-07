import { useRef, type ComponentRef } from 'react';
import { ScrollView, View } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { HistoryIcon, SendIcon, StopIcon } from '../../ui/icons';

import { useAppNavigation } from '../../state/navigation';
import { useAiConfigured } from '../../state/useSettings';
import { AiErrorBox, AiLoading, AppBar, IconButton, Screen, TextField, useDockInset } from '../../ui';
import {
  AssistantBubble,
  ConversationsSheet,
  NotConfiguredNotice,
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
  const chat = useAssistantChat();
  const { active, ai, conversations, input, loading, project, where } = chat;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const messages = active?.messages ?? [];
  const canSend = configured && !loading && input.trim().length > 0;

  return (
    // The keyboard covers the dock, so the composer must not stay lifted above it.
    <Screen padded={false} keyboard bottom={!keyboardOpen} bottomInset={keyboardOpen ? 0 : dockInset}>
      <AppBar
        title={project ? project.title || 'Untitled' : 'Assistant'}
        subtitle={project ? where : 'No story open · general manga questions'}
        hideBack
        right={
          <IconButton
            icon={HistoryIcon}
            badge={conversations.length > 1 ? conversations.length : undefined}
            onPress={() => chat.setListOpen(true)}
            accessibilityLabel="Conversations"
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
        {messages.length === 0 && <WelcomePanel project={project} prompts={chat.prompts} onPrompt={chat.send} />}
        {messages.map(message =>
          message.role === 'user' ? (
            <UserBubble key={message.id} message={message} />
          ) : (
            <AssistantBubble
              key={message.id}
              message={message}
              onCopy={() => chat.copy(message)}
              onSave={project ? () => chat.saveNote(message) : undefined}
            />
          ),
        )}
        {loading && <AiLoading label="Thinking…" onCancel={chat.cancel} />}
        {ai.status === 'error' && <AiErrorBox message={ai.message} onRetry={chat.retry} onCancel={chat.reset} />}
      </ScrollView>
      <View className="flex-row items-end gap-2 bg-surface px-3 py-2">
        <TextField
          multiline
          value={input}
          onChangeText={chat.setInput}
          placeholder={project ? 'Ask about your story…' : 'Ask a manga question…'}
          maxLength={QUESTION_MAX}
          editable={configured}
          accessibilityLabel="Message"
          className="flex-1"
          inputClassName="max-h-[120px]"
        />
        {loading ? (
          <IconButton
            icon={StopIcon}
            size={22}
            color="danger"
            onPress={chat.cancel}
            accessibilityLabel="Stop"
            className="rounded-full bg-danger/15"
          />
        ) : (
          <IconButton
            icon={SendIcon}
            size={20}
            color="on-ai"
            disabled={!canSend}
            onPress={() => chat.send(input)}
            accessibilityLabel="Send"
            className="rounded-full bg-ai"
          />
        )}
      </View>

      <ConversationsSheet
        visible={chat.listOpen}
        onClose={() => chat.setListOpen(false)}
        subtitle={project ? project.title || 'Untitled' : 'Without a story'}
        conversations={conversations}
        activeId={active?.id}
        onNew={chat.startNew}
        onPick={chat.pick}
        onRemove={chat.remove}
      />
    </Screen>
  );
}
