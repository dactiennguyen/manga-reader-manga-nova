import { View } from 'react-native';
import { Check, Copy, MessageSquare, Plus, Sparkles, StickyNote, Trash2 } from 'lucide-react-native';

import type { Project } from '../../core/model/types';
import { plural } from '../../core/util/format';
import { formatRelative } from '../../core/util/time';
import type { AssistantMessage, Conversation } from '../../state/useAssistant';
import { AiNote, Button, Chip, Icon, IconButton, ListItem, Sheet, Text } from '../../ui';

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
        <Icon icon={Sparkles} size={14} color="ai" />
        <Text variant="caption" tone="ai">
          Assistant
        </Text>
      </View>
      <Text selectable>{message.text}</Text>
      <View className="-ml-2 flex-row flex-wrap gap-1">
        <Button title="Copy" icon={Copy} variant="ghost" small onPress={onCopy} />
        {!!onSave && <Button title="Save as note" icon={StickyNote} variant="ghost" small onPress={onSave} />}
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
      <AiNote text="AI is not set up" />
      <Text>Add the address of an OpenAI-compatible server in Profile to chat with the assistant.</Text>
      <Button title="Open Profile" variant="secondary" small onPress={onOpenProfile} className="self-start" />
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
      <View className="h-16 w-16 items-center justify-center rounded-full bg-ai/15">
        <Icon icon={Sparkles} size={28} color="ai" />
      </View>
      <Text variant="heading" className="text-center">
        {project ? `Ask about ${project.title || 'your story'}` : 'Ask anything about making manga'}
      </Text>
      <Text tone="secondary" className="text-center">
        {project
          ? 'The assistant knows your logline, characters, world notes and chapters. It never edits the story itself.'
          : 'Open a story to get answers about it, or ask a general question below.'}
      </Text>
      <View className="mt-2 w-full items-center gap-2">
        {prompts.map(prompt => (
          <Chip key={prompt} label={prompt} icon={Sparkles} onPress={() => onPrompt(prompt)} />
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
    <Sheet visible={visible} onClose={onClose} title="Conversations" subtitle={subtitle}>
      <View className="p-4 pt-2">
        <Button title="New conversation" icon={Plus} onPress={onNew} />
      </View>
      {conversations.length === 0 && (
        <Text tone="secondary" className="px-4 pb-4 text-center">
          No conversations yet.
        </Text>
      )}
      {conversations.map(conversation => {
        const active = conversation.id === activeId;
        return (
          <ListItem
            key={conversation.id}
            title={conversation.title}
            subtitle={`${plural(conversation.messages.length, 'message')} · ${formatRelative(conversation.updatedAt)}`}
            icon={active ? Check : MessageSquare}
            iconColor={active ? 'ai' : undefined}
            selected={active}
            onPress={() => onPick(conversation)}
            right={
              <IconButton
                icon={Trash2}
                size={18}
                color="danger"
                onPress={() => onRemove(conversation)}
                accessibilityLabel="Delete conversation"
              />
            }
          />
        );
      })}
    </Sheet>
  );
}
