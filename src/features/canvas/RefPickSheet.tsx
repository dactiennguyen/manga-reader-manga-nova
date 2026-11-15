import { useMemo, useRef } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import type { ID } from '../../core/model/types';
import { boardsForCanvas, imagesOf, useLinkTargets, useRefBoards, type RefBoard } from '../../state/useRefBoards';
import { ListItem, Section, Sheet, Text } from '../../ui';
import { AddImageIcon, CharactersIcon, RefBoardIcon } from '../../ui/icons';
import { BoardCollage } from '../refBoards/BoardCollage';

const THUMB = 48;

export type RefPick = { kind: 'board'; board: RefBoard } | { kind: 'character' } | { kind: 'device' } | { kind: 'manage' };

/**
 * What to keep beside the page: a board, a character's sheet or one picture from the device. The choice
 * runs after the sheet has closed, because iOS cannot open a picker or another sheet over it.
 */
export function RefPickSheet({
  visible,
  projectId,
  onClose,
  onPick,
}: {
  visible: boolean;
  projectId: ID;
  onClose: () => void;
  onPick: (pick: RefPick) => void;
}) {
  const targets = useLinkTargets();
  const boardMap = useRefBoards(s => s.boards);
  const images = useRefBoards(s => s.images);
  const boards = useMemo(() => boardsForCanvas(Object.values(boardMap), targets, { projectId }), [boardMap, targets, projectId]);
  const chosen = useRef<RefPick | null>(null);
  const pick = (next: RefPick) => {
    chosen.current = next;
    onClose();
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        const next = chosen.current;
        chosen.current = null;
        if (next) {
          onPick(next);
        }
      }}
      title={t('Reference boards')}
      subtitle={t('Keep a picture beside the page while you draw')}
    >
      <View className="gap-4 px-4 pb-2">
        <Section>
          <ListItem icon={CharactersIcon} title={t('Character reference')} onPress={() => pick({ kind: 'character' })} />
          <ListItem icon={AddImageIcon} title={t('Add reference image')} onPress={() => pick({ kind: 'device' })} />
        </Section>
        <Section title={t('Your boards')}>
          {boards.length === 0 ? (
            <View className="gap-1 px-4 py-3">
              <Text variant="bodySmall" tone="secondary">
                {t('Group references by character, place or pose, then keep one open beside the page while you draw.')}
              </Text>
            </View>
          ) : (
            boards.map(board => {
              const list = imagesOf(images, board.id);
              return (
                <ListItem
                  key={board.id}
                  title={board.name}
                  subtitle={tn(list.length, '{count} picture', '{count} pictures')}
                  disabled={!list.length}
                  left={
                    <View className="overflow-hidden rounded-sm">
                      <BoardCollage paths={list.slice(0, 4).map(image => image.path)} width={THUMB} height={THUMB} />
                    </View>
                  }
                  onPress={() => pick({ kind: 'board', board })}
                />
              );
            })
          )}
          <ListItem icon={RefBoardIcon} title={t('Manage boards')} chevron onPress={() => pick({ kind: 'manage' })} />
        </Section>
      </View>
    </Sheet>
  );
}
