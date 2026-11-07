import { useState } from 'react';
import { View } from 'react-native';
import { AwakeIcon, FlagIcon, HiddenIcon, PreviewIcon, RotateIcon, TranslateIcon } from '../../ui/icons';

import { chapterLabel } from '../../core/model/selectors';
import type { Chapter, ID, PageFlag } from '../../core/model/types';
import { FLAG_REASONS } from '../../core/preview/reader';
import { orientationSupported } from '../../native/screen';
import { usePage } from '../../state/hooks';
import { useStory } from '../../state/useStory';
import { Button, Chip, ChipGroup, Menu, Pressable, Sheet, Text, TextField, confirm } from '../../ui';

export type ReaderSheet = 'chapters' | 'menu' | 'flags' | 'language' | null;

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
        placeholder="What needs fixing on this page?"
        accessibilityLabel="Flag note"
        multiline
        maxLength={300}
      />
      <ChipGroup>
        {FLAG_REASONS.map(reason => (
          <Chip key={reason} label={reason} selected={reasons.includes(reason)} onPress={() => toggle(reason)} />
        ))}
      </ChipGroup>
      <View className="flex-row gap-2">
        {flag && <Button title="Remove flag" variant="secondary" className="flex-1" onPress={() => save(undefined)} />}
        <Button
          title={flag ? 'Save' : 'Flag page'}
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
      title={page?.flag ? 'Edit flag' : 'Flag this page'}
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
    if (await confirm('Remove all flags?', 'Every flag in this chapter will be cleared.', { destructive: true })) {
      const { updatePage } = useStory.getState();
      flagged.forEach(id => updatePage(id, { flag: undefined }));
      onClose();
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Flags" subtitle={`${flagged.length} in this chapter`}>
      <View className="gap-3 p-4">
        {flagged.length === 0 && (
          <Text tone="secondary">No flags yet. Long-press a page to mark something to fix.</Text>
        )}
        {flagged.map(id => {
          const flag = pages[id].flag as PageFlag;
          const number = pageIds.indexOf(id) + 1;
          return (
            <Pressable
              key={id}
              accessibilityLabel={[`Page ${number}`, flag.note, flag.reasons.join(', ')].filter(Boolean).join('. ')}
              onPress={() => {
                onClose();
                onJump(id);
              }}
              className="min-h-12 gap-1 overflow-hidden rounded-md bg-overlay p-3"
            >
              <Text variant="caption" tone="accent">
                Page {number}
              </Text>
              {!!flag.note && <Text>{flag.note}</Text>}
              {flag.reasons.length > 0 && (
                <Text variant="caption" tone="secondary">
                  {flag.reasons.join(' · ')}
                </Text>
              )}
            </Pressable>
          );
        })}
        {flagged.length > 0 && <Button title="Remove all" variant="danger" small onPress={clearAll} />}
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
}) {
  const state = useStory.getState();
  const close = () => onSheet(null);
  return (
    <>
      <Menu
        visible={sheet === 'chapters'}
        onClose={close}
        title="Chapters"
        items={chapters.map(ch => ({
          label: chapterLabel(state, ch.id),
          subtitle: ch.pageIds.length === 1 ? '1 page' : `${ch.pageIds.length} pages`,
          disabled: ch.pageIds.length === 0,
          onPress: () => onChapter(ch.id),
        }))}
      />
      <Menu
        visible={sheet === 'menu'}
        onClose={close}
        items={[
          {
            label: hideUnfinished ? 'Show unfinished pages' : 'Hide unfinished pages',
            icon: hideUnfinished ? PreviewIcon : HiddenIcon,
            onPress: onToggleUnfinished,
          },
          {
            label: 'Flag list',
            subtitle: flagCount === 1 ? '1 flagged page' : `${flagCount} flagged pages`,
            icon: FlagIcon,
            onPress: () => onSheet('flags'),
          },
          { label: 'Keep screen on', subtitle: awake ? 'On' : 'Off', icon: AwakeIcon, onPress: onToggleAwake },
          manga &&
            orientationSupported && {
              label: landscape ? 'Rotate to portrait' : 'Rotate to landscape',
              subtitle: landscape ? 'One page at a time' : 'Two-page spread view',
              icon: RotateIcon,
              onPress: onRotate,
            },
          languages.length > 0 && {
            label: 'Language',
            subtitle: activeLang ?? 'Original',
            icon: TranslateIcon,
            onPress: () => onSheet('language'),
          },
        ]}
      />
      <Menu
        visible={sheet === 'language'}
        onClose={close}
        title="Language"
        items={[
          { label: 'Original', subtitle: activeLang ? undefined : 'Selected', onPress: () => onLanguage(undefined) },
          ...languages.map(code => ({
            label: code,
            subtitle: activeLang === code ? 'Selected' : undefined,
            onPress: () => onLanguage(code),
          })),
        ]}
      />
    </>
  );
}
