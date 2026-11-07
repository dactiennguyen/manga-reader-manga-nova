import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AiIcon, DoneIcon, ForwardIcon, InfoIcon, PlaceIcon, PlusIcon, RefreshIcon } from '../../ui/icons';

import { suggestScenes, type SceneIdea } from '../../core/ai/story';
import { chapterName } from '../../core/model/selectors';
import type { Block, ID } from '../../core/model/types';
import { plural } from '../../core/util/format';
import { uid } from '../../core/util/id';
import { useChapter } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useAiTask } from '../../state/useAiTask';
import { useAiConfigured } from '../../state/useSettings';
import { undoable, useStory } from '../../state/useStory';
import { Banner, Button, ICON, Icon, Sheet, Text } from '../../ui';
import { AiBusy, AiFailure, AiMark, AiSetupNotice, SheetFooter, useSheetClose } from './AiParts';

function sceneBlocks(idea: SceneIdea): Block[] {
  const setting = idea.setting.trim();
  return setting ? [{ id: uid(), type: 'setting', text: setting }] : [];
}

export function SceneIdeasSheet({ chapterId, number, onClose }: { chapterId: ID; number: number; onClose: () => void }) {
  const navigation = useAppNavigation();
  const configured = useAiConfigured();
  const chapter = useChapter(chapterId);
  const sheet = useSheetClose(onClose);
  const { state, start, cancel } = useAiTask<SceneIdea[]>();
  const [added, setAdded] = useState(0);
  const started = useRef(false);

  const generate = useCallback(() => {
    const store = useStory.getState();
    const current = store.chapters[chapterId];
    const project = current ? store.projects[current.projectId] : undefined;
    if (!current || !project) {
      return;
    }
    start(signal =>
      suggestScenes(
        { title: project.title, genres: project.genres, logline: project.logline },
        { title: chapterName(current.title, number), summary: current.summary, goal: current.goal },
        signal,
      ),
    );
  }, [chapterId, number, start]);

  const hasSummary = !!chapter?.summary.trim();
  const autoStart = configured && hasSummary;
  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      generate();
    }
  }, [autoStart, generate]);

  if (!chapter) {
    return null;
  }

  const existing = chapter.sceneIds.length;
  const name = chapterName(chapter.title, number);

  const openProfile = () => sheet.closeThen(() => navigation.navigate('Tabs', { screen: 'Profile' }));

  const openScript = () => sheet.closeThen(() => navigation.navigate('Script', { chapterId }));

  const accept = (ideas: SceneIdea[]) => {
    const store = useStory.getState();
    if (!store.chapters[chapterId]) {
      return;
    }
    undoable({ undoScope: `script:${chapterId}` }, () => {
      ideas.forEach(idea => store.addScene(chapterId, { description: idea.description, blocks: sceneBlocks(idea) }));
    });
    setAdded(ideas.length);
  };

  const renderBody = () => {
    if (added > 0) {
      return (
        <>
          <View className="items-center gap-3 p-6">
            <Icon icon={DoneIcon} size={ICON.xl} color="success" />
            <Text variant="heading" className="text-center">
              {plural(added, 'scene')} added to the script
            </Text>
            <Text tone="secondary" className="text-center">
              Open the script to write the action and dialogue for each scene.
            </Text>
          </View>
          <SheetFooter>
            <Button title="Open script" icon={ForwardIcon} onPress={openScript} />
            <Button title="Done" variant="ghost" onPress={sheet.close} />
          </SheetFooter>
        </>
      );
    }
    if (!configured) {
      return <AiSetupNotice onOpenProfile={openProfile} />;
    }
    if (state.status === 'loading') {
      return <AiBusy label="Breaking the chapter into scenes…" onCancel={cancel} />;
    }
    if (state.status === 'error') {
      return (
        <>
          <AiFailure message={state.message} onRetry={generate} />
          <SheetFooter>
            <Button title="Close" variant="ghost" onPress={sheet.close} />
          </SheetFooter>
        </>
      );
    }
    if (state.status === 'done') {
      const ideas = state.data;
      return (
        <>
          <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
            <AiMark />
            <Text variant="caption" tone="muted">
              {existing > 0
                ? `This chapter's script already has ${plural(existing, 'scene')}. These will be added after ${
                    existing === 1 ? 'it' : 'them'
                  }.`
                : 'Nothing is added to the script until you accept.'}
            </Text>
            {ideas.map((idea, index) => (
              <View key={index} className="gap-1 rounded-lg bg-surface p-3">
                <Text variant="caption" tone="ai">
                  Scene {existing + index + 1}
                </Text>
                {!!idea.setting && (
                  <View className="flex-row items-center gap-1">
                    <Icon icon={PlaceIcon} size={ICON.xs} color="text-muted" />
                    <Text variant="label" className="flex-1">
                      {idea.setting}
                    </Text>
                  </View>
                )}
                <Text tone="secondary">{idea.description}</Text>
              </View>
            ))}
          </ScrollView>
          <SheetFooter>
            <Button title="Add to script" icon={PlusIcon} onPress={() => accept(ideas)} />
            <View className="flex-row gap-2">
              <Button title="Try again" icon={RefreshIcon} variant="secondary" onPress={generate} className="flex-1" />
              <Button title="Discard" variant="ghost" onPress={sheet.close} className="flex-1" />
            </View>
          </SheetFooter>
        </>
      );
    }
    return (
      <>
        <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
          <Text tone="secondary">
            The AI proposes three to six scenes for this chapter, each with a setting and a short description. You
            preview them before anything is added to the script.
          </Text>
          <View className="gap-0.5 rounded-md bg-surface p-3">
            <Text variant="caption" tone="muted">
              Summary
            </Text>
            <Text tone={hasSummary ? 'text' : 'muted'}>{hasSummary ? chapter.summary.trim() : 'Not written yet'}</Text>
          </View>
          {!hasSummary && (
            <Banner
              tone="warning"
              icon={InfoIcon}
              text="This chapter has no summary, so the scenes will be generic. Add a summary first for better results, or continue anyway."
            />
          )}
        </ScrollView>
        <SheetFooter>
          <Button title={hasSummary ? 'Suggest scenes' : 'Continue anyway'} icon={AiIcon} variant="ai" onPress={generate} />
        </SheetFooter>
      </>
    );
  };

  return (
    <Sheet
      visible={sheet.visible}
      onClose={sheet.close}
      onClosed={sheet.onClosed}
      title="Break into scenes"
      subtitle={name}
      scroll={false}
      maxHeight="90%"
    >
      {renderBody()}
    </Sheet>
  );
}
