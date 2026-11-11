import { useState } from 'react';
import { View } from 'react-native';

import { msg, t } from '../../../core/i18n';
import { NOTE_TEXT_MAX, STICKER_IDS, type StickerId } from '../../../core/nearby/readTogether';
import { hashString } from '../../../core/util/id';
import { Button, Icon, Pressable, Sheet, Text, TextField, type IconGlyph } from '../../../ui';
import {
  StarIcon,
  StickerFireIcon,
  StickerIdeaIcon,
  StickerLaughIcon,
  StickerLoveIcon,
  StickerQuestionIcon,
  StickerThumbsIcon,
  StickerWowIcon,
} from '../../../ui/icons';
import { ICON } from '../../../ui/tokens';

export const STICKER_LOOK: Record<StickerId, { icon: IconGlyph; label: string }> = {
  love: { icon: StickerLoveIcon, label: msg('Love it') },
  laugh: { icon: StickerLaughIcon, label: msg('Funny') },
  wow: { icon: StickerWowIcon, label: msg('Wow') },
  fire: { icon: StickerFireIcon, label: msg('So cool') },
  idea: { icon: StickerIdeaIcon, label: msg('Idea') },
  question: { icon: StickerQuestionIcon, label: msg('Confusing') },
  thumbs: { icon: StickerThumbsIcon, label: msg('Nice') },
  star: { icon: StarIcon, label: msg('Best part') },
};

const SIZE = 36;
const TILTS = [-9, -4, 3, 8];

/**
 * A sticker as if pressed on by hand: cream paper, an ink outline, a slight tilt that differs per note so a
 * cluster never looks machine-stamped.
 */
export function StickerMark({ sticker, seed, large }: { sticker: StickerId; seed: string; large?: boolean }) {
  const tilt = TILTS[parseInt(hashString(seed), 36) % TILTS.length];
  const size = large ? SIZE * 1.4 : SIZE;
  return (
    <View
      className="items-center justify-center rounded-full border-2 border-on-paper bg-paper"
      style={{ width: size, height: size, transform: [{ rotate: `${tilt}deg` }] }}
    >
      <Icon icon={STICKER_LOOK[sticker].icon} size={large ? ICON.lg : ICON.md} color="on-paper" weight="fill" />
    </View>
  );
}

export type PlacedSticker = { id: string; sticker: StickerId; text: string; x: number; y: number; from: string };

/** Stickers placed on one page, in page fractions. Touches pass through to the page. */
export function StickerLayer({ notes, width, height, highlight }: { notes: PlacedSticker[]; width: number; height: number; highlight?: string | null }) {
  if (!notes.length) {
    return null;
  }
  return (
    <View pointerEvents="none" className="absolute inset-0" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {notes.map(note => (
        <View
          key={note.id}
          className="absolute max-w-36 items-center"
          style={{ left: note.x * width - SIZE / 2, top: note.y * height - SIZE / 2 }}
        >
          <StickerMark sticker={note.sticker} seed={note.id} large={highlight === note.id} />
          {!!note.text && (
            <View className="mt-1 rounded-sm bg-paper px-1.5 py-0.5">
              <Text variant="caption" tone="onPaper" numberOfLines={2} maxFontSizeMultiplier={1.2}>
                {note.text}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

/** Pick a sticker and add a few words; opened by a long press on a panel. */
export function StickerSheet({ visible, onClose, onDrop }: { visible: boolean; onClose: () => void; onDrop: (sticker: StickerId, text: string) => void }) {
  const [sticker, setSticker] = useState<StickerId>('love');
  const [text, setText] = useState('');
  const drop = () => {
    onDrop(sticker, text);
    setText('');
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Drop a sticker')} subtitle={t('Everyone reading sees it on this panel')}>
      <View className="gap-4 px-4 pb-2">
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {STICKER_IDS.map(id => (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityLabel={t(STICKER_LOOK[id].label)}
              accessibilityState={{ selected: sticker === id }}
              onPress={() => setSticker(id)}
              className={`w-[23%] min-h-12 items-center gap-1 rounded-md py-2 ${sticker === id ? 'bg-accent/15' : ''}`}
            >
              <StickerMark sticker={id} seed={id} />
              <Text variant="caption" tone={sticker === id ? 'accent' : 'secondary'} numberOfLines={1}>
                {t(STICKER_LOOK[id].label)}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextField
          value={text}
          onChangeText={setText}
          placeholder={t('Add a few words (optional)')}
          accessibilityLabel={t('Note')}
          maxLength={NOTE_TEXT_MAX}
        />
        <Button title={t('Drop it here')} onPress={drop} />
      </View>
    </Sheet>
  );
}
