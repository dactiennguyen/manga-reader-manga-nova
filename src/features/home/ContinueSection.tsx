import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import { chapterIdsOf, projectProgress } from '../../core/model/selectors';
import type { ID, Project, StoryData } from '../../core/model/types';
import { resumeTarget, type StoryRoute } from '../../core/story/resume';
import { chapterTouchedAt } from '../../core/studio/castUtil';
import { chapterBlocks, speakableText } from '../../core/studio/tableRead';
import { Button, SectionHeader } from '../../ui';
import { ListenIcon } from '../../ui/icons';
import { ListenSheet } from '../studio/ListenSheet';
import { ContinueCard } from './ContinueCard';
import type { HomeData } from './useHomeData';

function chapterOfRoute(state: StoryData, route: StoryRoute): ID | null {
  if ('chapterId' in route.params) {
    return route.params.chapterId;
  }
  if ('pageId' in route.params) {
    return state.pages[route.params.pageId]?.chapterId ?? null;
  }
  return null;
}

function hasScript(state: StoryData, chapterId: ID): boolean {
  return chapterBlocks(state, chapterId).some(block => !!speakableText(block.text));
}

/** The chapter to read aloud: where the person left off, else the latest chapter that has a script. */
function chapterToListen(state: StoryData, project: Project, route: StoryRoute): ID | null {
  const resumed = chapterOfRoute(state, route);
  if (resumed && hasScript(state, resumed)) {
    return resumed;
  }
  const latest = chapterIdsOf(project)
    .filter(id => state.chapters[id] && hasScript(state, id))
    .sort((a, b) => chapterTouchedAt(state, b) - chapterTouchedAt(state, a));
  return latest[0] ?? null;
}

/** Where the person left off in the latest story, and a way to hear its chapter read aloud. */
export const ContinueSection = memo(function ContinueSectionView({ data }: { data: HomeData }) {
  const { state, project } = data;
  const [listening, setListening] = useState(false);
  const resume = useMemo(() => (project ? resumeTarget(state, project) : null), [state, project]);
  const progress = useMemo(() => (project ? projectProgress(state, project.id) : null), [state, project]);
  const chapterId = useMemo(
    () => (project && resume ? chapterToListen(state, project, resume.route) : null),
    [state, project, resume],
  );

  if (!project || !resume || !progress) {
    return null;
  }
  return (
    <View className="gap-2">
      <SectionHeader>{t('Continue')}</SectionHeader>
      <ContinueCard project={project} resume={resume} progress={progress} />
      {!!chapterId && (
        <>
          <Button title={t('Listen to the chapter')} icon={ListenIcon} variant="secondary" onPress={() => setListening(true)} />
          <ListenSheet chapterId={chapterId} visible={listening} onClose={() => setListening(false)} />
        </>
      )}
    </View>
  );
});
