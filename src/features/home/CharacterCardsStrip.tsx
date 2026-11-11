import { memo, useMemo } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { t } from '../../core/i18n';
import { charactersOf } from '../../core/model/selectors';
import { characterCard } from '../../core/studio/cards';
import { useAppNavigation } from '../../state/navigation';
import { Button, Card, Pressable, SectionHeader, Text } from '../../ui';
import { STUDIO_ART } from '../../ui/studioArt';
import { CharacterCardView, cardLabel } from '../studio/parts';
import type { HomeData } from './useHomeData';

const MAX_CARDS = 8;

/** The latest story's characters as small trading cards. A story without characters gets a nudge to make one. */
export const CharacterCardsStrip = memo(function CharacterCardsStripView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const { state, studio, project } = data;
  const unlocked = studio.unlocked;
  const cards = useMemo(
    () =>
      project
        ? charactersOf(state, project.id)
            .slice(0, MAX_CARDS)
            .map(character => ({ character, card: characterCard(state, character.id, { unlocked }) }))
        : [],
    [state, project, unlocked],
  );

  if (!project) {
    return null;
  }
  if (!cards.length) {
    return (
      <Card
        accessibilityLabel={t('Create a character and get their card')}
        onPress={() => navigation.navigate('Project', { projectId: project.id })}
        className="flex-row items-center gap-3 p-3"
      >
        <Image accessibilityIgnoresInvertColors source={STUDIO_ART.cards} style={{ width: 64, height: 64 }} className="rounded-md bg-paper" />
        <View className="flex-1 gap-0.5">
          <Text variant="heading">{t('Character cards')}</Text>
          <Text variant="bodySmall" tone="secondary">
            {t('Create a character and get their card')}
          </Text>
        </View>
      </Card>
    );
  }
  return (
    <View className="gap-2">
      <SectionHeader
        right={<Button title={t('See all')} variant="ghost" small onPress={() => navigation.navigate('Cards', {})} />}
      >
        {t('Character cards')}
      </SectionHeader>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pb-1 pr-4">
        {cards.map(({ character, card }) => (
          <Pressable
            key={character.id}
            accessibilityLabel={cardLabel(card, character)}
            onPress={() => navigation.navigate('Cards', { characterId: character.id })}
            className="w-28"
          >
            <CharacterCardView card={card} character={character} compact />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});
