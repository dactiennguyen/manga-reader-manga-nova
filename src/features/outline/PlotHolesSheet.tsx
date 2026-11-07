import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { ReadIcon, RefreshIcon } from '../../ui/icons';

import { storyBrief } from '../../core/ai/context';
import { findPlotHoles, type PlotHole } from '../../core/ai/people';
import { chapterIdsOf } from '../../core/model/selectors';
import type { ID } from '../../core/model/types';
import { matchChapter } from '../../core/story/plotHoles';
import { plural } from '../../core/util/format';
import { useProject } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useAiTask } from '../../state/useAiTask';
import { useAiConfigured } from '../../state/useSettings';
import { useStory } from '../../state/useStory';
import { Button, Sheet, Tag, Text } from '../../ui';
import { AiBusy, AiFailure, AiMark, AiSetupNotice, SheetFooter, useSheetClose } from './AiParts';

export function PlotHolesSheet({ projectId, onClose }: { projectId: ID; onClose: () => void }) {
  const navigation = useAppNavigation();
  const configured = useAiConfigured();
  const project = useProject(projectId);
  const chapters = useStory(s => s.chapters);
  const sheet = useSheetClose(onClose);
  const { state, start, cancel } = useAiTask<PlotHole[]>();
  const started = useRef(false);

  const generate = useCallback(() => {
    const brief = storyBrief(useStory.getState(), projectId).text;
    if (brief) {
      start(signal => findPlotHoles(brief, signal));
    }
  }, [projectId, start]);

  useEffect(() => {
    if (configured && !started.current) {
      started.current = true;
      generate();
    }
  }, [configured, generate]);

  if (!project) {
    return null;
  }

  const ordered = chapterIdsOf(project)
    .map(id => chapters[id])
    .filter(chapter => chapter !== undefined)
    .map(chapter => ({ id: chapter.id, title: chapter.title }));

  const openProfile = () => sheet.closeThen(() => navigation.navigate('Tabs', { screen: 'Profile' }));

  const openChapter = (chapterId: ID) => sheet.closeThen(() => navigation.navigate('Script', { chapterId }));

  const renderHole = (hole: PlotHole, index: number) => {
    const chapterId = matchChapter(hole.chapter, ordered);
    return (
      <View key={index} className="gap-2 rounded-lg bg-surface p-3">
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="caption" tone="ai">
            Issue {index + 1}
          </Text>
          {!!hole.chapter && <Tag label={hole.chapter} icon={ReadIcon} />}
        </View>
        <Text variant="label">{hole.issue}</Text>
        {!!hole.suggestion && (
          <View className="gap-0.5">
            <Text variant="caption" tone="muted">
              Suggestion
            </Text>
            <Text tone="secondary">{hole.suggestion}</Text>
          </View>
        )}
        {chapterId !== undefined && (
          <Button
            title="Open chapter"
            icon={ReadIcon}
            variant="secondary"
            small
            onPress={() => openChapter(chapterId)}
            className="self-start"
          />
        )}
      </View>
    );
  };

  const renderBody = () => {
    if (!configured) {
      return <AiSetupNotice onOpenProfile={openProfile} />;
    }
    if (state.status === 'loading') {
      return <AiBusy label="Reading the outline and characters…" onCancel={cancel} />;
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
      return (
        <>
          <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
            <AiMark label={plural(state.data.length, 'issue')} />
            <Text variant="caption" tone="muted">
              These are an editor's notes to think about. Nothing in your story is changed.
            </Text>
            {state.data.map(renderHole)}
          </ScrollView>
          <SheetFooter>
            <View className="flex-row gap-2">
              <Button title="Try again" icon={RefreshIcon} variant="secondary" onPress={generate} className="flex-1" />
              <Button title="Close" variant="ghost" onPress={sheet.close} className="flex-1" />
            </View>
          </SheetFooter>
        </>
      );
    }
    return (
      <>
        <View className="px-4 pb-4">
          <Text tone="secondary">
            The AI reads your outline and characters and lists contradictions, dropped threads and characters without a
            clear motive.
          </Text>
        </View>
        <SheetFooter>
          <Button title="Find plot holes" variant="ai" onPress={generate} />
        </SheetFooter>
      </>
    );
  };

  return (
    <Sheet
      visible={sheet.visible}
      onClose={sheet.close}
      onClosed={sheet.onClosed}
      title="Find plot holes"
      subtitle={project.title}
      scroll={false}
      maxHeight="90%"
    >
      {renderBody()}
    </Sheet>
  );
}
