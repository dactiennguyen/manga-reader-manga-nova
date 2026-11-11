import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AiIcon, CaretLeftIcon, DeleteIcon, InfoIcon, PlusIcon, RefreshIcon } from '../../ui/icons';

import { suggestPlots, type PlotDirection } from '../../core/ai/story';
import { t, tn } from '../../core/i18n';
import type { ID } from '../../core/model/types';
import { existingWork, planActsOf, planPlotApply, storyIsBlank, type PlotApplyMode } from '../../core/story/plotPlan';
import { useProject } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useAiTask } from '../../state/useAiTask';
import { useAiConfigured } from '../../state/useSettings';
import { undoStory, undoable, useStory } from '../../state/useStory';
import { Banner, Button, Sheet, Text, confirm, snackbar, toast } from '../../ui';
import { ReportAiButton } from '../aiReport/ReportButton';
import { AiBusy, AiFailure, AiMark, AiSetupNotice, SheetFooter, useSheetClose } from './AiParts';

/** The directions as one text, as they are reported. */
function directionsText(directions: PlotDirection[]): string {
  return directions
    .map(direction =>
      [
        [direction.tone, direction.title].filter(Boolean).join(': '),
        direction.summary,
        ...direction.acts.flat().map(chapter => `- ${[chapter.title, chapter.summary].filter(Boolean).join(': ')}`),
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

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
      toast(t('This direction has no chapters to add'));
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
    const message = tn(plan.create.length, '{count} chapter added from "{title}"', '{count} chapters added from "{title}"', {
      title: direction.title,
    });
    sheet.closeThen(() =>
      snackbar(plan.remove.length ? { message } : { message, actionLabel: t('Undo'), onAction: () => undoStory(scope) }),
    );
  };

  const use = (direction: PlotDirection) => {
    if (blank) {
      apply(direction, 'append');
    } else {
      setPicked(direction);
    }
  };

  const lostChapters = tn(work.chapters, '{count} chapter', '{count} chapters');
  const lostScenes = work.scenes ? tn(work.scenes, '{count} script scene', '{count} script scenes') : '';
  const lostPages = work.pages ? tn(work.pages, '{count} drawn page', '{count} drawn pages') : '';
  const extras = lostScenes && lostPages ? t('{scenes} and {pages}', { scenes: lostScenes, pages: lostPages }) : lostScenes || lostPages;
  const lostText = extras
    ? t('{chapters} with {extras}', { chapters: lostChapters, extras })
    : t('{chapters} with everything written in them', { chapters: lostChapters });

  const replace = async (direction: PlotDirection) => {
    const ok = await confirm(
      tn(work.chapters, 'Replace {count} existing chapter?', 'Replace {count} existing chapters?'),
      t('This deletes {what}. This cannot be undone.', { what: lostText }),
      { confirmText: t('Delete and replace'), destructive: true },
    );
    if (ok) {
      apply(direction, 'replace');
    }
  };

  const renderDirection = (direction: PlotDirection, index: number) => (
    <View key={index} className="gap-2 rounded-lg bg-surface p-3">
      <AiMark label={direction.tone || t('Direction {n}', { n: index + 1 })} />
      <Text variant="heading">{direction.title}</Text>
      {!!direction.summary && <Text tone="secondary">{direction.summary}</Text>}
      {direction.acts.map((list, actIndex) =>
        list.length ? (
          <View key={actIndex} className="mt-1 gap-1">
            <Text variant="caption" tone="muted">
              {acts[actIndex] ? t(acts[actIndex].title) : t('Act {n}', { n: actIndex + 1 })}
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
      <Button title={t('Use this direction')} icon={AiIcon} variant="ai" onPress={() => use(direction)} />
    </View>
  );

  const renderPicked = (direction: PlotDirection) => (
    <>
      <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
        <AiMark label={direction.tone || t('AI suggestion')} />
        <Text variant="heading">{direction.title}</Text>
        <Text tone="secondary">
          {tn(
            work.chapters,
            'Your story already has {count} chapter. What should happen to it?',
            'Your story already has {count} chapters. What should happen to them?',
          )}
        </Text>
        <View className="gap-2 rounded-md bg-surface p-3">
          <Text variant="caption" tone="secondary">
            {t('Keeps everything you have. The new chapters go after the existing ones in each act.')}
          </Text>
          <Button title={t('Add after existing chapters')} icon={PlusIcon} onPress={() => apply(direction, 'append')} />
        </View>
        <View className="gap-2 rounded-md bg-danger/15 p-3">
          <Text variant="caption" tone="danger">
            {t('Deletes {what}. This cannot be undone.', { what: lostText })}
          </Text>
          <Button title={t('Replace existing chapters')} icon={DeleteIcon} variant="danger" onPress={() => replace(direction)} />
        </View>
      </ScrollView>
      <SheetFooter>
        <Button title={t('Back to directions')} icon={CaretLeftIcon} variant="ghost" onPress={() => setPicked(null)} />
      </SheetFooter>
    </>
  );

  const renderStart = () => (
    <>
      <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
        <Text tone="secondary">
          {t('The AI proposes up to three directions for your plot, with chapters for each act, based on:')}
        </Text>
        <View className="gap-0.5 rounded-md bg-surface p-3">
          <Text variant="caption" tone="muted">
            {t('Title')}
          </Text>
          <Text>{project.title || t('Untitled')}</Text>
          <Text variant="caption" tone="muted" className="mt-2">
            {t('Genres')}
          </Text>
          <Text>{project.genres.length ? project.genres.map(genre => t(genre)).join(', ') : t('None chosen')}</Text>
          <Text variant="caption" tone="muted" className="mt-2">
            {t('Logline')}
          </Text>
          <Text tone={logline ? 'text' : 'muted'}>{logline || t('Not written yet')}</Text>
        </View>
        {!logline && (
          <Banner
            tone="warning"
            icon={InfoIcon}
            text={t('Without a logline the suggestions will be generic. You can write one sentence about your story at the top of the outline first, or continue anyway.')}
          />
        )}
      </ScrollView>
      <SheetFooter>
        <Button title={logline ? t('Suggest plot directions') : t('Continue anyway')} icon={AiIcon} variant="ai" onPress={generate} />
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
      return <AiBusy label={t('Thinking up plot directions…')} onCancel={cancel} />;
    }
    if (state.status === 'error') {
      return (
        <>
          <AiFailure message={state.message} onRetry={generate} />
          <SheetFooter>
            <Button title={t('Back')} variant="ghost" onPress={reset} />
          </SheetFooter>
        </>
      );
    }
    if (state.status === 'done') {
      return (
        <>
          <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
            <Text variant="caption" tone="muted">
              {t('Nothing changes in your story until you choose a direction.')}
            </Text>
            {state.data.map(renderDirection)}
          </ScrollView>
          <SheetFooter>
            <View className="flex-row gap-2">
              <Button title={t('Try again')} icon={RefreshIcon} variant="secondary" onPress={generate} className="flex-1" />
              <ReportAiButton text={directionsText(state.data)} feature="plotIdeas" />
            </View>
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
      title={t('AI plot ideas')}
      subtitle={project.title}
      scroll={false}
      maxHeight="90%"
    >
      {renderBody()}
    </Sheet>
  );
}
