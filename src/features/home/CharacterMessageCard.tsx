import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import { characterMessage } from '../../core/studio/characterChat';
import { useAppNavigation } from '../../state/navigation';
import { useStudio } from '../../state/useStudio';
import { Avatar, Card, ICON, IconButton, Pressable, Text } from '../../ui';
import { CloseIcon } from '../../ui/icons';
import { openRoute } from '../project/projectActions';
import type { HomeData } from './useHomeData';

/** A line from one of the person's own characters, drawn as a chat bubble. Tapping it opens where they appear. */
export const CharacterMessageCard = memo(function CharacterMessageCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const { state, today, studio } = data;
  const message = useMemo(() => characterMessage(state, today), [state, today]);
  const character = message ? state.characters[message.characterId] : undefined;

  if (!message || !character || studio.chatHiddenDay === today) {
    return null;
  }
  const name = character.name.trim() || t('Unnamed');
  return (
    <Card className="flex-row items-start gap-1 py-2 pl-3">
      <Pressable
        accessibilityLabel={t('{name} says: {text}', { name, text: message.text })}
        onPress={() => openRoute(navigation, message.route)}
        className="flex-1 flex-row items-start gap-3 py-1"
      >
        <Avatar character={character} size={44} />
        <View className="flex-1 gap-1">
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {name}
          </Text>
          <View className="self-start rounded-lg rounded-tl-sm bg-overlay px-3 py-2">
            <Text variant="bodySmall">{message.text}</Text>
          </View>
        </View>
      </Pressable>
      <IconButton
        icon={CloseIcon}
        size={ICON.md}
        accessibilityLabel={t('Hide messages for today')}
        onPress={() => useStudio.getState().hideChat(today)}
      />
    </Card>
  );
});
