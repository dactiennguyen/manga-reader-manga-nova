import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { t } from '../../core/i18n';
import { tileRatio } from '../../core/refBoards/layout';
import { fileUri } from '../../core/util/paths';
import { REF_LIMITS, parseTags, tagsText, useRefBoards, type RefImage } from '../../state/useRefBoards';
import { Button, Chip, ChipRow, FieldLabel, Sheet, Text, TextField } from '../../ui';
import { PlusIcon } from '../../ui/icons';

const THUMB = 96;

/** The note and tags of one pinned picture. Tags already used on the board are one tap away. */
export function RefImageSheet({
  image,
  boardTags,
  onClose,
}: {
  image: RefImage | null;
  boardTags: string[];
  onClose: () => void;
}) {
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [shown, setShown] = useState<RefImage | null>(image);

  useEffect(() => {
    if (image) {
      setShown(image);
      setCaption(image.caption);
      setTags(tagsText(image.tags));
    }
  }, [image]);

  const current = parseTags(tags);
  const suggestions = boardTags.filter(tag => !current.some(item => item.toLocaleLowerCase() === tag.toLocaleLowerCase())).slice(0, 12);

  const save = () => {
    if (shown) {
      useRefBoards.getState().updateImage(shown.id, { caption, tags });
    }
    onClose();
  };

  return (
    <Sheet visible={!!image} onClose={onClose} title={t('Note and tags')}>
      <View className="gap-3 px-4 pb-2">
        {shown ? (
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: fileUri(shown.path) }}
            className="self-center rounded-md bg-overlay"
            style={{ width: THUMB, height: Math.round(THUMB * tileRatio(shown.width, shown.height)) }}
            resizeMode="cover"
          />
        ) : null}
        <FieldLabel>{t('Note')}</FieldLabel>
        <TextField
          value={caption}
          onChangeText={setCaption}
          placeholder={t('What to look at: the fold of the sleeve, the light from the left…')}
          maxLength={REF_LIMITS.caption}
          multiline
          inputClassName="min-h-16"
          accessibilityLabel={t('Note')}
        />
        <FieldLabel>{t('Tags')}</FieldLabel>
        <TextField
          value={tags}
          onChangeText={setTags}
          placeholder={t('hands, back view, night')}
          autoCapitalize="none"
          accessibilityLabel={t('Tags')}
        />
        <Text variant="caption" tone="muted">
          {t('Separate tags with commas. Up to {n}.', { n: REF_LIMITS.tags })}
        </Text>
        {suggestions.length > 0 && (
          <ChipRow>
            {suggestions.map(tag => (
              <Chip key={tag} icon={PlusIcon} label={tag} onPress={() => setTags(tagsText([...current, tag]))} />
            ))}
          </ChipRow>
        )}
        <Button title={t('Save')} onPress={save} className="mt-2" />
      </View>
    </Sheet>
  );
}
