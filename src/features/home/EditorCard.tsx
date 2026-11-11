import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import { EDITOR } from '../../core/studio/cast';
import { editorNote } from '../../core/studio/editor';
import { useAppNavigation } from '../../state/navigation';
import { useStudio } from '../../state/useStudio';
import { Button, Card, ICON, IconButton, Text } from '../../ui';
import { CloseIcon, PlusIcon } from '../../ui/icons';
import { openRoute } from '../project/projectActions';
import { CastAvatar } from '../studio/parts/CastAvatar';
import type { HomeData } from './useHomeData';

/** Mori's note for today, on a slip of paper, with the one button that does what the note says. */
export const EditorCard = memo(function EditorCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const { state, m, today, drewToday, levelIndex, studio } = data;
  const levelSeen = studio.levelSeen;
  const note = useMemo(
    () => editorNote(state, m, today, { drewToday, levelIndex, levelSeen }),
    [state, m, today, drewToday, levelIndex, levelSeen],
  );

  if (studio.editorHiddenDay === today || !note.text) {
    return null;
  }
  const welcome = note.situation === 'welcome';
  return (
    <Card className="gap-3 p-3">
      <View className="flex-row items-center gap-3">
        <CastAvatar id="mori" size={48} />
        <View className="flex-1">
          <Text variant="caption" tone="muted">
            {t(EDITOR.role)}
          </Text>
          <Text variant="heading">{EDITOR.name}</Text>
        </View>
        <IconButton
          icon={CloseIcon}
          size={ICON.md}
          accessibilityLabel={t('Hide the note for today')}
          onPress={() => useStudio.getState().hideEditor(today)}
        />
      </View>
      <View className="rounded-md bg-paper px-3 py-2">
        <Text tone="onPaper">{note.text}</Text>
      </View>
      {welcome ? (
        <Button title={t('New story')} icon={PlusIcon} onPress={() => navigation.navigate('NewProject')} className="self-start" />
      ) : (
        !!note.action && (
          <Button
            title={note.action.label}
            variant="secondary"
            small
            className="self-start"
            onPress={() => {
              const route = note.action?.route;
              if (route) {
                openRoute(navigation, route);
              }
            }}
          />
        )
      )}
    </Card>
  );
});
