import { t } from '../../core/i18n';
import { activeProjects, chapterIdsOf, chapterLabel } from '../../core/model/selectors';
import type { StoryData } from '../../core/model/types';
import type { PlannerData } from '../../core/planner/data';
import { deadlineText } from '../../core/planner/words';
import { useAppNavigation } from '../../state/navigation';
import { Menu, type MenuItem } from '../../ui';
import { ChapterIcon, DeadlineIcon } from '../../ui/icons';

/** Every chapter of the stories in the library, newest story first, to give one a plan. */
export function ChapterPickerSheet({
  visible,
  onClose,
  state,
  data,
}: {
  visible: boolean;
  onClose: () => void;
  state: StoryData;
  data: PlannerData;
}) {
  const navigation = useAppNavigation();
  const items: MenuItem[] = activeProjects(state).flatMap(project =>
    chapterIdsOf(project)
      .filter(chapterId => !!state.chapters[chapterId])
      .map(chapterId => {
        const plan = data.plans[chapterId];
        return {
          // Menu rows are keyed by label, so the story's title keeps "Chapter 1" of two stories apart.
          label: `${project.title.trim() || t('Untitled')} · ${chapterLabel(state, chapterId)}`,
          subtitle: plan ? t('Due {date}', { date: deadlineText(plan.deadline) }) : undefined,
          icon: plan ? DeadlineIcon : ChapterIcon,
          onPress: () => navigation.navigate('ChapterPlan', { chapterId }),
        };
      }),
  );
  return <Menu visible={visible} onClose={onClose} title={t('Plan a chapter')} items={items} />;
}
