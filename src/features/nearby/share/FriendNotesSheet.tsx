import { useMemo } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../../core/i18n';
import type { ID } from '../../../core/model/types';
import { notesInOrder, type ReviewNote } from '../../../core/nearby/reviewNotes';
import { panelIdsOf } from '../../../core/nearby/readTogether';
import { formatDate } from '../../../core/util/time';
import { useNearbyShare } from '../../../state/useNearbyShare';
import { useStory } from '../../../state/useStory';
import { IconButton, Pressable, Sheet, Text } from '../../../ui';
import { DeleteIcon } from '../../../ui/icons';
import { STICKER_LOOK, StickerMark, type PlacedSticker } from './Stickers';

export function useChapterNotes(chapterId: ID | undefined): ReviewNote[] {
  const notes = useNearbyShare(s => s.notes);
  const pages = useStory(s => (chapterId ? s.chapters[chapterId]?.pageIds : undefined));
  return useMemo(() => (chapterId ? notesInOrder(notes, chapterId, pages ?? []) : []), [notes, chapterId, pages]);
}

/** One page's review notes, ready to draw over it. */
export function placedOn(notes: ReviewNote[], pageId: ID): PlacedSticker[] {
  return notes.filter(note => note.pageId === pageId);
}

/**
 * "Notes from friends": the stickers and words friends left while reading this chapter together, in reading
 * order. Tapping one jumps to its page and lifts that sticker so the panel is easy to spot.
 */
export function FriendNotesSheet({
  visible,
  chapterId,
  onClose,
  onJump,
}: {
  visible: boolean;
  chapterId: ID | undefined;
  onClose: () => void;
  onJump: (note: ReviewNote) => void;
}) {
  const notes = useChapterNotes(chapterId);
  const state = useStory.getState();
  const pageIds = chapterId ? state.chapters[chapterId]?.pageIds ?? [] : [];
  const where = (note: ReviewNote) => {
    const page = state.pages[note.pageId];
    const pageNumber = pageIds.indexOf(note.pageId) + 1;
    const panelNumber = page && note.panelId ? panelIdsOf(page).indexOf(note.panelId) + 1 : 0;
    if (pageNumber <= 0) {
      return t('Page removed');
    }
    return panelNumber > 0 ? t('Page {n}, panel {panel}', { n: pageNumber, panel: panelNumber }) : t('Page {n}', { n: pageNumber });
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Notes from friends')} subtitle={tn(notes.length, '{count} note', '{count} notes')}>
      <View className="gap-2 p-4">
        {notes.length === 0 && <Text tone="secondary">{t('No notes yet. Read this chapter together with friends nearby and their stickers land here.')}</Text>}
        {notes.map(note => (
          <View key={note.id} className="flex-row items-center gap-2 overflow-hidden rounded-md bg-overlay pr-1">
            <Pressable
              accessibilityLabel={[t(STICKER_LOOK[note.sticker].label), note.text, note.from, where(note)].filter(Boolean).join('. ')}
              accessibilityHint={t('Jumps to the panel')}
              onPress={() => {
                onClose();
                onJump(note);
              }}
              className="min-h-14 flex-1 flex-row items-center gap-3 p-3"
            >
              <StickerMark sticker={note.sticker} seed={note.id} />
              <View className="flex-1 gap-0.5">
                <Text variant="caption" tone="accent">
                  {where(note)}
                </Text>
                <Text numberOfLines={3}>{note.text || t(STICKER_LOOK[note.sticker].label)}</Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {t('{name}, {date}', { name: note.from || t('A friend'), date: formatDate(note.at) })}
                </Text>
              </View>
            </Pressable>
            <IconButton
              icon={DeleteIcon}
              accessibilityLabel={t('Remove note')}
              onPress={() => useNearbyShare.getState().removeNote(note.chapterId, note.id)}
            />
          </View>
        ))}
      </View>
    </Sheet>
  );
}
