import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DeleteIcon, ForwardIcon, PlusIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import { LIMITS } from '../../core/model/constants';
import type { ID } from '../../core/model/types';
import { useChapter } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { Button, Chip, ChipRow, FieldLabel, Sheet, Text, TextField, confirm, toast } from '../../ui';
import { CharacterPicker } from '../characters/CharacterPicker';
import { useSheetClose } from './AiParts';

const GOAL_MAX = 120;

export function ChapterEditSheet({
  chapterId,
  number,
  onClose,
}: {
  chapterId: ID | undefined;
  number: number;
  onClose: () => void;
}) {
  const navigation = useAppNavigation();
  const chapter = useChapter(chapterId);
  const characters = useStory(s => s.characters);
  const sheet = useSheetClose(onClose);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [goal, setGoal] = useState('');
  const [picking, setPicking] = useState(false);

  const loadedId = chapter?.id;
  useEffect(() => {
    const current = loadedId ? useStory.getState().chapters[loadedId] : undefined;
    if (current) {
      setTitle(current.title);
      setSummary(current.summary);
      setGoal(current.goal);
    }
  }, [loadedId]);

  if (!chapter) {
    return null;
  }

  const update = useStory.getState().updateChapter;
  const cast = chapter.characterIds.filter(id => characters[id]);

  const toggleCharacter = (id: ID | undefined) => {
    if (!id) {
      return;
    }
    const next = cast.includes(id) ? cast.filter(item => item !== id) : [...cast, id];
    update(chapter.id, { characterIds: next });
  };

  const remove = async () => {
    const pages = chapter.pageIds.length;
    const ok = await confirm(
      t('Delete chapter {n}?', { n: number }),
      pages
        ? tn(
            pages,
            'Its script and {count} page will be deleted too. This cannot be undone.',
            'Its script and {count} pages will be deleted too. This cannot be undone.',
          )
        : t('Its script will be deleted too. This cannot be undone.'),
      { confirmText: t('Delete chapter'), destructive: true },
    );
    if (ok) {
      sheet.closeThen(() => {
        useStory.getState().removeChapter(chapter.id);
        toast(t('Chapter deleted'));
      });
    }
  };

  const openScript = () => sheet.closeThen(() => navigation.navigate('Script', { chapterId: chapter.id }));

  return (
    <>
      <Sheet visible={sheet.visible} onClose={sheet.close} onClosed={sheet.onClosed} title={t('Chapter {n}', { n: number })}>
        <View className="gap-2 px-4 pb-6">
          <FieldLabel>{t('Chapter title')}</FieldLabel>
          <TextField
            value={title}
            maxLength={LIMITS.chapterTitle}
            placeholder={t('Chapter title')}
            onChangeText={value => {
              setTitle(value);
              update(chapter.id, { title: value });
            }}
          />
          <View className="flex-row items-center justify-between">
            <FieldLabel>{t('Summary')}</FieldLabel>
            <Text variant="caption" tone="muted">
              {summary.length}/{LIMITS.chapterSummary}
            </Text>
          </View>
          <TextField
            value={summary}
            multiline
            maxLength={LIMITS.chapterSummary}
            placeholder={t('What happens in this chapter?')}
            textAlignVertical="top"
            inputClassName="min-h-24"
            onChangeText={value => {
              setSummary(value);
              update(chapter.id, { summary: value });
            }}
          />
          <FieldLabel>{t('Chapter goal')}</FieldLabel>
          <TextField
            value={goal}
            maxLength={GOAL_MAX}
            placeholder={t('What should the reader learn or feel?')}
            onChangeText={value => {
              setGoal(value);
              update(chapter.id, { goal: value });
            }}
          />
          <FieldLabel>{t('Characters')}</FieldLabel>
          <ChipRow>
            {cast.map(id => (
              <Chip key={id} label={characters[id].name || t('Unnamed')} selected onPress={() => toggleCharacter(id)} />
            ))}
            <Chip label={t('Add')} icon={PlusIcon} onPress={() => setPicking(true)} />
          </ChipRow>
          {cast.length > 0 && (
            <Text variant="caption" tone="muted">
              {t('Tap a name to remove it from the chapter.')}
            </Text>
          )}
          <Button title={t('Write script')} icon={ForwardIcon} onPress={openScript} className="mt-3" />
          <Button title={t('Delete chapter')} icon={DeleteIcon} variant="danger" onPress={remove} />
        </View>
      </Sheet>
      <CharacterPicker
        visible={picking}
        onClose={() => setPicking(false)}
        projectId={chapter.projectId}
        selectedIds={cast}
        title={t('Characters')}
        onPick={toggleCharacter}
      />
    </>
  );
}
