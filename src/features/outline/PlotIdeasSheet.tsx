import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AiIcon, CaretLeftIcon, DeleteIcon, InfoIcon, PlusIcon, RefreshIcon } from '../../ui/icons';

import { suggestPlots, type PlotDirection } from '../../core/ai/story';
import type { ID } from '../../core/model/types';
import { existingWork, planActsOf, planPlotApply, storyIsBlank, type PlotApplyMode } from '../../core/story/plotPlan';
import { plural } from '../../core/util/format';
import { useProject } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useAiTask } from '../../state/useAiTask';
import { useAiConfigured } from '../../state/useSettings';
import { undoStory, undoable, useStory } from '../../state/useStory';
import { Banner, Button, Sheet, Text, confirm, snackbar, toast } from '../../ui';
import { AiBusy, AiFailure, AiMark, AiSetupNotice, SheetFooter, useSheetClose } from './AiParts';

export function PlotIdeasSheet({ projectId, onClose }: { projectId: ID; onClose: () => void }) {
  const navigation = useAppNavigation();
  const configured = useAiConfigured();
  const project = useProject(projectId);
  const chapters = useStory(s => s.chapters);
  const sheet = useSheetClose(onClose);
  const { state, start, cancel, reset } = useAiTask<PlotDirection[]>();
  const [picked, setPicked] = useState<PlotDirection | null>(null);

  if (!project) {
    return null;
  }

  const acts = project.acts;
  const planActs = planActsOf(project, chapters);
  const blank = storyIsBlank(planActs);
  const work = existingWork(planActs);
  const logline = project.logline.trim();

  const generate = () => {
    setPicked(null);
    start(signal =>
      suggestPlots(
        { title: project.title, genres: project.genres, logline },
        acts.map(act => act.title),
        signal,
      ),
    );
  };

  const openProfile = () => sheet.closeThen(() => navigation.navigate('Tabs', { screen: 'Profile' }));

  const apply = (direction: PlotDirection, mode: PlotApplyMode) => {
    const store = useStory.getState();
    const current = store.projects[projectId];
    if (!current) {
      return;
    }
    const plan = planPlotApply(planActsOf(current, store.chapters), direction.acts, mode);
    if (!plan.create.length) {
      toast('This direction has no chapters to add');
      return;
    }
    const scope = `project:${projectId}` as const;
    undoable({ undoScope: scope }, () => {
      plan.remove.forEach(id => store.removeChapter(id));
      plan.create.forEach(item =>
        store.addChapter(projectId, {
          actId: item.actId,
          index: item.index,
          title: item.title || undefined,
          summary: item.summary,
        }),
      );
    });
    const message = `${plural(plan.create.length, 'chapter')} added from "${direction.title}"`;
    sheet.closeThen(() =>
      snackbar(plan.remove.length ? { message } : { message, actionLabel: 'Undo', onAction: () => undoStory(scope) }),
    );
  };

  const use = (direction: PlotDirection) => {
    if (blank) {
      apply(direction, 'append');
    } else {
      setPicked(direction);
    }
  };

  const extras = [work.scenes ? plural(work.scenes, 'script scene') : '', work.pages ? plural(work.pages, 'drawn page') : '']
    .filter(Boolean)
    .join(' and ');
  const lostText = `${plural(work.chapters, 'chapter')} with ${extras || 'everything written in them'}`;

  const replace = async (direction: PlotDirection) => {
    const ok = await confirm(
      `Replace ${plural(work.chapters, 'existing chapter')}?`,
      `This deletes ${lostText}. This cannot be undone.`,
      { confirmText: 'Delete and replace', destructive: true },
    );
    if (ok) {
      apply(direction, 'replace');
    }
  };

  const renderDirection = (direction: PlotDirection, index: number) => (
    <View key={index} className="gap-2 rounded-lg bg-surface p-3">
      <AiMark label={direction.tone || `Direction ${index + 1}`} />
      <Text variant="heading">{direction.title}</Text>
      {!!direction.summary && <Text tone="secondary">{direction.summary}</Text>}
      {direction.acts.map((list, actIndex) =>
        list.length ? (
          <View key={actIndex} className="mt-1 gap-1">
            <Text variant="caption" tone="muted">
              {acts[actIndex]?.title ?? `Act ${actIndex + 1}`}
            </Text>
            {list.map((chapter, chapterIndex) => (
              <View key={chapterIndex} className="py-0.5 pl-2">
                {!!chapter.title && <Text variant="label">{chapter.title}</Text>}
                {!!chapter.summary && (
                  <Text variant="caption" tone="secondary">
                    {chapter.summary}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : null,
      )}
      <Button title="Use this direction" icon={AiIcon} variant="ai" onPress={() => use(direction)} />
    </View>
  );

  const renderPicked = (direction: PlotDirection) => (
    <>
      <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
        <AiMark label={direction.tone || 'AI suggestion'} />
        <Text variant="heading">{direction.title}</Text>
        <Text tone="secondary">
          Your story already has {plural(work.chapters, 'chapter')}. What should happen to {work.chapters === 1 ? 'it' : 'them'}?
        </Text>
        <View className="gap-2 rounded-md bg-surface p-3">
          <Text variant="caption" tone="secondary">
            Keeps everything you have. The new chapters go after the existing ones in each act.
          </Text>
          <Button title="Add after existing chapters" icon={PlusIcon} onPress={() => apply(direction, 'append')} />
        </View>
        <View className="gap-2 rounded-md bg-danger/15 p-3">
          <Text variant="caption" tone="danger">
            Deletes {lostText}. This cannot be undone.
          </Text>
          <Button title="Replace existing chapters" icon={DeleteIcon} variant="danger" onPress={() => replace(direction)} />
        </View>
      </ScrollView>
      <SheetFooter>
        <Button title="Back to directions" icon={CaretLeftIcon} variant="ghost" onPress={() => setPicked(null)} />
      </SheetFooter>
    </>
  );

  const renderStart = () => (
    <>
      <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
        <Text tone="secondary">
          The AI proposes up to three directions for your plot, with chapters for each act, based on:
        </Text>
        <View className="gap-0.5 rounded-md bg-surface p-3">
          <Text variant="caption" tone="muted">
            Title
          </Text>
          <Text>{project.title || 'Untitled'}</Text>
          <Text variant="caption" tone="muted" className="mt-2">
            Genres
          </Text>
          <Text>{project.genres.length ? project.genres.join(', ') : 'None chosen'}</Text>
          <Text variant="caption" tone="muted" className="mt-2">
            Logline
          </Text>
          <Text tone={logline ? 'text' : 'muted'}>{logline || 'Not written yet'}</Text>
        </View>
        {!logline && (
          <Banner
            tone="warning"
            icon={InfoIcon}
            text="Without a logline the suggestions will be generic. You can write one sentence about your story at the top of the outline first, or continue anyway."
          />
        )}
      </ScrollView>
      <SheetFooter>
        <Button title={logline ? 'Suggest plot directions' : 'Continue anyway'} icon={AiIcon} variant="ai" onPress={generate} />
      </SheetFooter>
    </>
  );

  const renderBody = () => {
    if (!configured) {
      return <AiSetupNotice onOpenProfile={openProfile} />;
    }
    if (picked) {
      return renderPicked(picked);
    }
    if (state.status === 'loading') {
      return <AiBusy label="Thinking up plot directions…" onCancel={cancel} />;
    }
    if (state.status === 'error') {
      return (
        <>
          <AiFailure message={state.message} onRetry={generate} />
          <SheetFooter>
            <Button title="Back" variant="ghost" onPress={reset} />
          </SheetFooter>
        </>
      );
    }
    if (state.status === 'done') {
      return (
        <>
          <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
            <Text variant="caption" tone="muted">
              Nothing changes in your story until you choose a direction.
            </Text>
            {state.data.map(renderDirection)}
          </ScrollView>
          <SheetFooter>
            <Button title="Try again" icon={RefreshIcon} variant="secondary" onPress={generate} />
          </SheetFooter>
        </>
      );
    }
    return renderStart();
  };

  return (
    <Sheet
      visible={sheet.visible}
      onClose={sheet.close}
      onClosed={sheet.onClosed}
      title="AI plot ideas"
      subtitle={project.title}
      scroll={false}
      maxHeight="90%"
    >
      {renderBody()}
    </Sheet>
  );
}
