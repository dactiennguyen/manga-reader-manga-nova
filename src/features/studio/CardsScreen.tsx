import { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { t, tn } from '../../core/i18n';
import { activeProjects, charactersOf } from '../../core/model/selectors';
import type { ID } from '../../core/model/types';
import { characterCard } from '../../core/studio/cards';
import { useStoryData } from '../../state/hooks';
import { useStudioState } from '../../state/useMetrics';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { EmptyState, Pressable, SectionHeader, Text } from '../../ui';
import { STUDIO_ART } from '../../ui/studioArt';
import { FriendCardsSection } from '../nearby/share/FriendCardsSection';
import { CardSheet } from './cards/CardSheet';
import { CharacterCardView, cardLabel } from './parts';
import { StudioPage } from './StudioPage';

const GAP = 12;
const SIDE = 16;

/** Every character of every story as a collectible card, grouped by story. */
export function CardsScreen() {
  const navigation = useAppNavigation();
  const routeCharacter = useAppRoute<'Cards'>().params?.characterId;
  const state = useStoryData();
  const studio = useStudioState();
  const { width } = useWindowDimensions();
  const [openId, setOpenId] = useState<ID | null>(routeCharacter && state.characters[routeCharacter] ? routeCharacter : null);

  const groups = useMemo(
    () =>
      activeProjects(state)
        .map(project => ({ project, characters: charactersOf(state, project.id) }))
        .filter(group => group.characters.length > 0),
    [state],
  );
  const total = groups.reduce((sum, group) => sum + group.characters.length, 0);
  const columns = width >= 900 ? 5 : width >= 600 ? 4 : 2;
  const cardWidth = Math.floor((Math.min(width, 1200) - SIDE * 2 - GAP * (columns - 1)) / columns);
  const firstProject = activeProjects(state)[0];

  return (
    <StudioPage title={t('Character cards')} subtitle={total > 0 ? tn(total, '{count} card', '{count} cards') : undefined}>
      {total === 0 ? (
        <EmptyState
          art={STUDIO_ART.cards}
          title={t('No cards yet')}
          message={t('Every character you create becomes a card. Fill in their profile to make the card rarer.')}
          action={
            firstProject
              ? { label: t('Open your story'), onPress: () => navigation.navigate('Project', { projectId: firstProject.id }) }
              : { label: t('Start a story'), onPress: () => navigation.navigate('NewProject') }
          }
        />
      ) : (
        groups.map(({ project, characters }) => (
          <View key={project.id} className="gap-2">
            <SectionHeader>{project.title.trim() || t('Untitled')}</SectionHeader>
            <View className="flex-row flex-wrap" style={{ gap: GAP }}>
              {characters.map(character => {
                const card = characterCard(state, character.id, studio);
                return (
                  <Pressable
                    key={character.id}
                    accessibilityRole="button"
                    accessibilityLabel={cardLabel(card, character)}
                    accessibilityHint={t('Opens the card')}
                    onPress={() => setOpenId(character.id)}
                    style={{ width: cardWidth }}
                  >
                    <CharacterCardView card={card} character={character} compact={cardWidth < 200} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
      <FriendCardsSection cardWidth={cardWidth} gap={GAP} bigWidth={Math.min(320, width - 64)} />
      {total > 0 && (
        <Text variant="caption" tone="muted">
          {t('Rarity rises as you fill in a profile: traits, a face drawing, expressions and relationships all count.')}
        </Text>
      )}
      <CardSheet
        character={openId ? state.characters[openId] ?? null : null}
        state={state}
        studio={studio}
        onClose={() => setOpenId(null)}
      />
    </StudioPage>
  );
}
