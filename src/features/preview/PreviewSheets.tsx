import { useState } from 'react';
import { View } from 'react-native';
import { AwakeIcon, FlagIcon, HiddenIcon, PreviewIcon, RotateIcon, StickerIcon, TranslateIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import { chapterLabel } from '../../core/model/selectors';
import type { Chapter, ID, PageFlag } from '../../core/model/types';
import { FLAG_REASONS } from '../../core/preview/reader';
import { orientationSupported } from '../../native/screen';
import { usePage } from '../../state/hooks';
import { useStory } from '../../state/useStory';
import { Button, Chip, ChipGroup, Menu, Pressable, Sheet, Text, TextField, confirm } from '../../ui';

export type ReaderSheet = 'chapters' | 'menu' | 'flags' | 'language' | 'notes' | null;

function FlagEditor({ pageId, flag, onClose }: { pageId: ID; flag: PageFlag | undefined; onClose: () => void }) {
  const [note, setNote] = useState(flag?.note ?? '');
  const [reasons, setReasons] = useState<string[]>(flag?.reasons ?? []);
  const toggle = (reason: string) =>
    setReasons(list => (list.includes(reason) ? list.filter(item => item !== reason) : [...list, reason]));
  const save = (next: PageFlag | undefined) => {
    useStory.getState().updatePage(pageId, { flag: next });
    onClose();
  };
  return (
    <View className="gap-3 p-4">
      <TextField
        value={note}
        onChangeText={setNote}
        placeholder={t('What needs fixing on this page?')}
        accessibilityLabel={t('Flag note')}
        multiline
        maxLength={300}
      />
      <ChipGroup>
        {FLAG_REASONS.map(reason => (
          <Chip key={reason} label={t(reason)} selected={reasons.includes(reason)} onPress={() => toggle(reason)} />
        ))}
      </ChipGroup>
      <View className="flex-row gap-2">
        {flag && <Button title={t('Remove flag')} variant="secondary" className="flex-1" onPress={() => save(undefined)} />}
        <Button
          title={flag ? t('Save') : t('Flag page')}
          icon={FlagIcon}
          className="flex-1"
          onPress={() => save({ note: note.trim(), reasons })}
        />
      </View>
    </View>
  );
}

export function FlagSheet({
  pageId,
  pageLabel,
  onClose,
}: {
  pageId: ID | null;
  pageLabel: string;
  onClose: () => void;
}) {
  const page = usePage(pageId ?? undefined);
  return (
    <Sheet
      visible={!!pageId}
      onClose={onClose}
      title={page?.flag ? t('Edit flag') : t('Flag this page')}
      subtitle={pageLabel}
    >
      {pageId && <FlagEditor key={pageId} pageId={pageId} flag={page?.flag} onClose={onClose} />}
    </Sheet>
  );
}

export function FlagListSheet({
  visible,
  onClose,
  pageIds,
  onJump,
}: {
  visible: boolean;
  onClose: () => void;
  pageIds: ID[];
  onJump: (pageId: ID) => void;
}) {
  const pages = useStory(s => s.pages);
  const flagged = pageIds.filter(id => !!pages[id]?.flag);
  const clearAll = async () => {
    if (await confirm(t('Remove all flags?'), t('Every flag in this chapter will be cleared.'), { destructive: true })) {
      const { updatePage } = useStory.getState();
      flagged.forEach(id => updatePage(id, { flag: undefined }));
      onClose();
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Flags')} subtitle={t('{count} in this chapter', { count: flagged.length })}>
      <View className="gap-3 p-4">
        {flagged.length === 0 && (
          <Text tone="secondary">{t('No flags yet. Long-press a page to mark something to fix.')}</Text>
        )}
        {flagged.map(id => {
          const flag = pages[id].flag as PageFlag;
          const number = pageIds.indexOf(id) + 1;
          return (
            <Pressable
              key={id}
              accessibilityLabel={[t('Page {n}', { n: number }), flag.note, flag.reasons.map(reason => t(reason)).join(', ')].filter(Boolean).join('. ')}
              onPress={() => {
                onClose();
                onJump(id);
              }}
              className="min-h-12 gap-1 overflow-hidden rounded-md bg-overlay p-3"
            >
              <Text variant="caption" tone="accent">
                {t('Page {n}', { n: number })}
              </Text>
              {!!flag.note && <Text>{flag.note}</Text>}
              {flag.reasons.length > 0 && (
                <Text variant="caption" tone="secondary">
                  {flag.reasons.map(reason => t(reason)).join(' · ')}
                </Text>
              )}
            </Pressable>
          );
        })}
        {flagged.length > 0 && <Button title={t('Remove all')} variant="danger" small onPress={clearAll} />}
      </View>
    </Sheet>
  );
}

export function ReaderMenus({
  sheet,
  onSheet,
  chapters,
  hideUnfinished,
  flagCount,
  awake,
  manga,
  landscape,
  languages,
  activeLang,
  onChapter,
  onToggleUnfinished,
  onToggleAwake,
  onRotate,
  onLanguage,
  noteCount = 0,
}: {
  sheet: ReaderSheet;
  onSheet: (sheet: ReaderSheet) => void;
  chapters: Chapter[];
  hideUnfinished: boolean;
  flagCount: number;
  awake: boolean;
  manga: boolean;
  landscape: boolean;
  languages: string[];
  activeLang: string | undefined;
  onChapter: (chapterId: ID) => void;
  onToggleUnfinished: () => void;
  onToggleAwake: () => void;
  onRotate: () => void;
  onLanguage: (lang: string | undefined) => void;
  /** Notes friends left while reading this chapter together; the menu offers them when there are any. */
  noteCount?: number;
}) {
  const state = useStory.getState();
  const close = () => onSheet(null);
  return (
    <>
      <Menu
        visible={sheet === 'chapters'}
        onClose={close}
        title={t('Chapters')}
        items={chapters.map(ch => ({
          label: chapterLabel(state, ch.id),
          subtitle: tn(ch.pageIds.length, '{count} page', '{count} pages'),
          disabled: ch.pageIds.length === 0,
          onPress: () => onChapter(ch.id),
        }))}
      />
      <Menu
        visible={sheet === 'menu'}
        onClose={close}
        items={[
          {
            label: hideUnfinished ? t('Show unfinished pages') : t('Hide unfinished pages'),
            icon: hideUnfinished ? PreviewIcon : HiddenIcon,
            onPress: onToggleUnfinished,
          },
          {
            label: t('Flag list'),
            subtitle: tn(flagCount, '{count} flagged page', '{count} flagged pages'),
            icon: FlagIcon,
            onPress: () => onSheet('flags'),
          },
          noteCount > 0 && {
            label: t('Notes from friends'),
            subtitle: tn(noteCount, '{count} note', '{count} notes'),
            icon: StickerIcon,
            onPress: () => onSheet('notes'),
          },
          { label: t('Keep screen on'), subtitle: awake ? t('On') : t('Off'), icon: AwakeIcon, onPress: onToggleAwake },
          manga &&
            orientationSupported && {
              label: landscape ? t('Rotate to portrait') : t('Rotate to landscape'),
              subtitle: landscape ? t('One page at a time') : t('Two-page spread view'),
              icon: RotateIcon,
              onPress: onRotate,
            },
          languages.length > 0 && {
            label: t('Language'),
            subtitle: activeLang ?? t('Original'),
            icon: TranslateIcon,
            onPress: () => onSheet('language'),
          },
        ]}
      />
      <Menu
        visible={sheet === 'language'}
        onClose={close}
        title={t('Language')}
        items={[
          { label: t('Original'), subtitle: activeLang ? undefined : t('Selected'), onPress: () => onLanguage(undefined) },
          ...languages.map(code => ({
            label: code,
            subtitle: activeLang === code ? t('Selected') : undefined,
            onPress: () => onLanguage(code),
          })),
        ]}
      />
    </>
  );
}
