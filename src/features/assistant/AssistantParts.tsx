import { Image, View } from 'react-native';
import { AiIcon, CheckIcon, CopyIcon, DeleteIcon, MessageIcon, NoteIcon, PlusIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import type { Project } from '../../core/model/types';
import { formatRelative } from '../../core/util/time';
import type { AssistantMessage, Conversation } from '../../state/useAssistant';
import { ART, AiNote, Button, Chip, ICON, Icon, IconButton, ListItem, Sheet, Text } from '../../ui';

export function AssistantBubble({
  message,
  onCopy,
  onSave,
}: {
  message: AssistantMessage;
  onCopy: () => void;
  onSave?: () => void;
}) {
  return (
    <View className="max-w-[92%] gap-2 self-start rounded-lg bg-surface p-3">
      <View className="flex-row items-center gap-1">
        <Icon icon={AiIcon} size={ICON.xs} color="ai" />
        <Text variant="caption" tone="ai">
          {t('Assistant')}
        </Text>
      </View>
      <Text selectable>{message.text}</Text>
      <View className="-ml-2 flex-row flex-wrap gap-1">
        <Button title={t('Copy')} icon={CopyIcon} variant="ghost" small onPress={onCopy} />
        {!!onSave && <Button title={t('Save as note')} icon={NoteIcon} variant="ghost" small onPress={onSave} />}
      </View>
    </View>
  );
}

export function UserBubble({ message }: { message: AssistantMessage }) {
  return (
    <View className="max-w-[85%] self-end rounded-lg rounded-br-sm bg-overlay px-3 py-2">
      <Text selectable>{message.text}</Text>
    </View>
  );
}

export function NotConfiguredNotice({ onOpenProfile }: { onOpenProfile: () => void }) {
  return (
    <View className="gap-2 rounded-md bg-ai/15 p-3">
      <AiNote text={t('AI is not set up')} />
      <Text>{t('Add the address of an OpenAI-compatible server in Profile to chat with the assistant.')}</Text>
      <Button title={t('Open Profile')} variant="secondary" small onPress={onOpenProfile} className="self-start" />
    </View>
  );
}

export function WelcomePanel({
  project,
  prompts,
  onPrompt,
}: {
  project: Project | undefined;
  prompts: string[];
  onPrompt: (prompt: string) => void;
}) {
  return (
    <View className="items-center gap-3 px-2 py-6">
      <Image accessibilityIgnoresInvertColors source={ART.assistantHero} className="h-20 w-20 rounded-lg" />
      <Text variant="heading" className="text-center">
        {!project
          ? t('Ask anything about making manga')
          : project.title
          ? t('Ask about {title}', { title: project.title })
          : t('Ask about your story')}
      </Text>
      <Text tone="secondary" className="text-center">
        {project
          ? t('The assistant knows your logline, characters, world notes and chapters. It never edits the story itself.')
          : t('Open a story to get answers about it, or ask a general question below.')}
      </Text>
      <View className="mt-2 w-full items-center gap-2">
        {prompts.map(prompt => (
          <Chip key={prompt} label={t(prompt)} icon={AiIcon} onPress={() => onPrompt(t(prompt))} />
        ))}
      </View>
    </View>
  );
}

export function ConversationsSheet({
  visible,
  onClose,
  subtitle,
  conversations,
  activeId,
  onNew,
  onPick,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  subtitle: string;
  conversations: Conversation[];
  activeId: string | undefined;
  onNew: () => void;
  onPick: (conversation: Conversation) => void;
  onRemove: (conversation: Conversation) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Conversations')} subtitle={subtitle}>
      <View className="p-4 pt-2">
        <Button title={t('New conversation')} icon={PlusIcon} onPress={onNew} />
      </View>
      {conversations.length === 0 && (
        <Text tone="secondary" className="px-4 pb-4 text-center">
          {t('No conversations yet.')}
        </Text>
      )}
      {conversations.map(conversation => {
        const active = conversation.id === activeId;
        return (
          <ListItem
            key={conversation.id}
            title={conversation.title}
            subtitle={`${tn(conversation.messages.length, '{count} message', '{count} messages')} · ${formatRelative(conversation.updatedAt)}`}
            icon={active ? CheckIcon : MessageIcon}
            iconColor={active ? 'ai' : undefined}
            selected={active}
            onPress={() => onPick(conversation)}
            right={
              <IconButton
                icon={DeleteIcon}
                size={ICON.md}
                color="danger"
                onPress={() => onRemove(conversation)}
                accessibilityLabel={t('Delete conversation')}
              />
            }
          />
        );
      })}
    </Sheet>
  );
}
