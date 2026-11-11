import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t, tn } from '../../core/i18n';
import { activeProjects, chaptersOf } from '../../core/model/selectors';
import type { ID } from '../../core/model/types';
import { useStoryData } from '../../state/hooks';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { useRoom } from '../../state/useRoom';
import { useStory } from '../../state/useStory';
import { AppBar, Button, IconButton, ListItem, PANEL_SHADOW, ProgressBar, Screen, Section, Switch, Text } from '../../ui';
import { CloseIcon, ReadIcon, SaveIcon } from '../../ui/icons';
import { TogetherReader } from './share/TogetherReader';
import { readOptions, useReadSession } from './share/useReadSession';
import { NoRoom } from './share/useShareRoom';

function startReading(projectId: ID, title: string): void {
  useRoom.getState().setActivity('read', { projectId, title: title.slice(0, 120), page: 0 });
}

/** The host picks one of their stories; everyone in the room reads it together. */
function StoryPicker() {
  const state = useStoryData();
  const projects = useMemo(() => activeProjects(state).filter(project => chaptersOf(state, project.id).some(ch => ch.pageIds.length > 0)), [state]);
  return (
    <Section title={t('Pick a story to read together')} footer={t('Friends get a copy to read along. It goes away when they leave, unless they keep it.')}>
      {projects.length === 0 ? (
        <ListItem title={t('No stories with pages yet')} subtitle={t('Lay out a page in one of your stories first.')} />
      ) : (
        projects.map(project => (
          <ListItem
            key={project.id}
            icon={ReadIcon}
            title={project.title.trim() || t('Untitled')}
            subtitle={tn(chaptersOf(state, project.id).length, '{count} chapter', '{count} chapters')}
            chevron
            onPress={() => startReading(project.id, project.title.trim() || t('Untitled'))}
          />
        ))
      )}
    </Section>
  );
}

function SessionBar({ session, onClose }: { session: ReturnType<typeof useReadSession>; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="absolute inset-x-2 gap-1 rounded-xl bg-raised p-1" style={{ top: insets.top + 8, boxShadow: PANEL_SHADOW }}>
      <View className="flex-row items-center gap-1">
        <IconButton icon={CloseIcon} onPress={onClose} accessibilityLabel={t('Leave reading')} />
        <View className="flex-1">
          <Text variant="label" numberOfLines={1}>
            {session.options?.title || t('Untitled')}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {session.isHost ? t('You turn the pages. Long-press a panel for a sticker.') : t('Long-press a panel to drop a sticker')}
          </Text>
        </View>
        {!session.isHost && (
          <IconButton
            icon={SaveIcon}
            active={session.kept}
            onPress={() => session.setKept(!session.kept)}
            accessibilityLabel={session.kept ? t('Keeping a copy. Tap to let it go') : t('Keep a copy after reading')}
          />
        )}
      </View>
      {!session.isHost && (
        <View className="min-h-12 flex-row items-center gap-3 px-3">
          <Text variant="bodySmall" className="flex-1" numberOfLines={1}>
            {t('Follow {name}', { name: session.hostName || t('the host') })}
          </Text>
          <Switch value={session.follow.following} onValueChange={session.toggleFollow} label={t('Follow the host')} />
        </View>
      )}
    </View>
  );
}

export function ReadTogetherScreen() {
  const navigation = useAppNavigation();
  const routeProject = useAppRoute<'ReadTogether'>().params?.projectId;
  const session = useReadSession();
  const { inRoom, isHost, options, copy, localId } = session;

  // A host who came here from a story starts with it.
  useEffect(() => {
    const project = routeProject ? useStory.getState().projects[routeProject] : undefined;
    if (inRoom && isHost && project && !readOptions(useRoom.getState().room)) {
      startReading(project.id, project.title.trim() || t('Untitled'));
    }
  }, [inRoom, isHost, routeProject]);

  // The host leaving ends the reading for everyone.
  useEffect(() => {
    if (!isHost) {
      return;
    }
    return () => {
      if (readOptions(useRoom.getState().room)) {
        useRoom.getState().setActivity('lobby');
      }
    };
  }, [isHost]);

  const close = () => navigation.goBack();

  if (inRoom && localId && options && session.pages.length > 0) {
    return (
      <View className="flex-1 bg-bg">
        <TogetherReader
          key={localId}
          projectId={localId}
          storyPages={session.pages}
          jump={session.jump}
          notes={session.notes.map(note => ({ ...note, from: note.name }))}
          onPageShown={session.onPageShown}
          onDrop={session.dropNote}
        />
        <SessionBar session={session} onClose={close} />
      </View>
    );
  }

  return (
    <Screen scroll>
      <AppBar title={t('Read together')} onBack={() => navigation.goBack()} />
      {!inRoom ? (
        <NoRoom art="read" message={t('Read a story together: the host turns the pages and everyone follows on their own phone.')} />
      ) : isHost ? (
        <StoryPicker />
      ) : !options ? (
        <Text tone="secondary">{t('Waiting for {name} to pick a story.', { name: session.hostName || t('the host') })}</Text>
      ) : copy.state === 'failed' ? (
        <View className="gap-3">
          <Text tone="secondary">{t("Couldn't open the story. Ask the host to try again.")}</Text>
          <Button title={t('Go back')} variant="secondary" onPress={close} />
        </View>
      ) : (
        <View className="gap-3" accessibilityLiveRegion="polite">
          <Text>
            {copy.state === 'importing'
              ? t('Opening “{title}”…', { title: options.title || t('Untitled') })
              : t('Getting “{title}” from {name}…', { title: options.title || t('Untitled'), name: session.hostName || t('the host') })}
          </Text>
          <ProgressBar value={copy.state === 'waiting' ? copy.progress : 1} />
        </View>
      )}
    </Screen>
  );
}

