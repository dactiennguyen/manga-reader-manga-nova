import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ForwardIcon } from '../../ui/icons';

import type { BlockDraft } from '../../core/ai/writing';
import { t } from '../../core/i18n';
import { BLOCK_LABEL, DIALOGUE_KIND_LABEL } from '../../core/model/constants';
import type { Character } from '../../core/model/types';
import { Avatar, ICON, Icon, Text } from '../../ui';

/** Mirrors the editor: margin and a small label, no card per block. */
export function DraftBlockView({ draft, character }: { draft: BlockDraft; character: Character | undefined }) {
  if (draft.type === 'dialogue') {
    return (
      <View className="ml-8 gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <View className="shrink flex-row items-center gap-2">
            <Avatar character={character} size={24} />
            <Text variant="caption" tone={character ? 'secondary' : 'warning'} numberOfLines={1} className="shrink">
              {character ? character.name || t('Unnamed') : draft.characterName || t('No character')}
            </Text>
          </View>
          <Text variant="caption" tone="secondary">
            {t(DIALOGUE_KIND_LABEL[draft.kind ?? 'speak'])}
          </Text>
        </View>
        <Text>{draft.text}</Text>
        {!character && (
          <Text variant="caption" tone="warning">
            {draft.characterName
              ? t('"{name}" is not in your cast. The line is inserted without a character.', { name: draft.characterName })
              : t('The line is inserted without a character.')}
          </Text>
        )}
      </View>
    );
  }
  return (
    <View className={draft.type === 'narration' || draft.type === 'sfx' ? 'ml-4' : ''}>
      {draft.type !== 'action' && (
        <Text variant="caption" tone="muted">
          {t(BLOCK_LABEL[draft.type])}
        </Text>
      )}
      <Text variant={draft.type === 'sfx' ? 'title' : draft.type === 'setting' ? 'heading' : 'body'}>{draft.text}</Text>
    </View>
  );
}

export function BeforeAfter({ label, before, after }: { label?: string; before: string; after: string }) {
  return (
    <View className="gap-1 rounded-md bg-surface p-3">
      {!!label && (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      )}
      <View className="flex-row items-start gap-2">
        <View className="flex-1 gap-0.5">
          <Text variant="caption" tone="muted">
            {t('Before')}
          </Text>
          <Text tone="secondary">{before}</Text>
        </View>
        <Icon icon={ForwardIcon} size={ICON.sm} color="ai" />
        <View className="flex-1 gap-0.5">
          <Text variant="caption" tone="ai">
            {t('After')}
          </Text>
          <Text>{after}</Text>
        </View>
      </View>
    </View>
  );
}

export function Footer({ children }: { children: ReactNode }) {
  return <View className="gap-2 px-4 pt-2">{children}</View>;
}
