import { useMemo } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import type { Character } from '../../core/model/types';
import { useAppNavigation } from '../../state/navigation';
import { filterBoards, imagesOf, useLinkTargets, useRefBoards } from '../../state/useRefBoards';
import { Button, ListItem, SectionHeader, Text } from '../../ui';
import { PlusIcon } from '../../ui/icons';
import { BoardCollage } from './BoardCollage';

const THUMB = 48;

/** The boards linked to one character, on their Design tab. A new one is linked and named for them. */
export function CharacterBoards({ character }: { character: Character }) {
  const navigation = useAppNavigation();
  const targets = useLinkTargets();
  const boardMap = useRefBoards(s => s.boards);
  const images = useRefBoards(s => s.images);
  const boards = useMemo(
    () => filterBoards(Object.values(boardMap), [], { query: '', kind: 'all', scope: { projectId: character.projectId, characterId: character.id } }, targets),
    [boardMap, character.projectId, character.id, targets],
  );
  const name = character.name.trim() || t('this character');

  const create = () => {
    const boardId = useRefBoards.getState().createBoard({
      name: character.name,
      kind: 'characters',
      projectId: character.projectId,
      characterId: character.id,
    });
    navigation.navigate('RefBoard', { boardId });
  };

  return (
    <View className="gap-2">
      <SectionHeader right={<Button small variant="ghost" icon={PlusIcon} title={t('New board')} onPress={create} />}>
        {t('Reference boards')}
      </SectionHeader>
      {boards.length === 0 ? (
        <Text variant="caption" tone="muted">
          {t('Pin outfit, hair and pose pictures for {name} on a board, then open it beside the page while you draw.', { name })}
        </Text>
      ) : (
        <View className="overflow-hidden rounded-lg bg-surface">
          {boards.map(board => {
            const list = imagesOf(images, board.id);
            return (
              <ListItem
                key={board.id}
                title={board.name}
                subtitle={tn(list.length, '{count} picture', '{count} pictures')}
                left={
                  <View className="overflow-hidden rounded-sm">
                    <BoardCollage paths={list.slice(0, 4).map(image => image.path)} width={THUMB} height={THUMB} />
                  </View>
                }
                chevron
                onPress={() => navigation.navigate('RefBoard', { boardId: board.id })}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}
