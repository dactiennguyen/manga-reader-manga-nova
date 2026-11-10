import { AddPageIcon, ArrowDownIcon, ArrowUpIcon, BackIcon, ChecklistIcon, CopyIcon, DeleteIcon, DoneIcon, FlagIcon, ForwardIcon, ListIcon, ScriptIcon, TemplatesIcon } from '../../ui/icons';

import { t } from '../../core/i18n';
import type { Chapter, ID, Page } from '../../core/model/types';
import { moveArrows, type MoveArrow } from '../../core/reorder/storyboardGrid';
import { useAppNavigation } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { Dialog, Menu, Text, type IconGlyph } from '../../ui';
import { clearPageFlag, setPagesDone } from '../page/pageActions';
import type { useStoryboardActions } from './useStoryboardActions';

const ARROW: Record<MoveArrow, IconGlyph> = { left: BackIcon, right: ForwardIcon, up: ArrowUpIcon, down: ArrowDownIcon };

export function StoryboardMenus({
  chapter,
  pages,
  actions,
  webtoon,
  rtl,
  listView,
  menuOpen,
  onCloseMenu,
  onToggleList,
}: {
  chapter: Chapter;
  pages: Record<ID, Page>;
  actions: ReturnType<typeof useStoryboardActions>;
  webtoon: boolean;
  rtl: boolean;
  listView: boolean;
  menuOpen: boolean;
  onCloseMenu: () => void;
  onToggleList: () => void;
}) {
  const navigation = useAppNavigation();
  const { pageMenu, flagNote } = actions;
  const story = useStory.getState();
  const page = pageMenu ? pages[pageMenu.id] : undefined;
  const index = pageMenu ? chapter.pageIds.indexOf(pageMenu.id) : -1;
  const flagPage = flagNote ? pages[flagNote] : undefined;
  const arrows = moveArrows(webtoon, rtl, listView);

  return (
    <>
      <Menu
        visible={menuOpen}
        onClose={onCloseMenu}
        items={[
          { label: t('View script'), icon: ScriptIcon, onPress: () => navigation.navigate('Script', { chapterId: chapter.id }) },
          listView
            ? { label: t('View: Grid'), icon: TemplatesIcon, onPress: onToggleList }
            : { label: t('View: List'), icon: ListIcon, onPress: onToggleList },
          chapter.pageIds.length > 0 && {
            label: t('Select multiple'),
            icon: ChecklistIcon,
            onPress: () => actions.setSelection([]),
          },
        ]}
      />
      <Menu
        visible={!!pageMenu?.open && !!page}
        onClose={actions.closePageMenu}
        title={page ? t('Page {n}', { n: index + 1 }) : undefined}
        items={
          page
            ? [
                {
                  label: page.done ? t('Mark not done') : t('Mark done'),
                  icon: DoneIcon,
                  onPress: () => setPagesDone([page.id], !page.done),
                },
                { label: t('Duplicate'), icon: CopyIcon, onPress: () => story.duplicatePage(page.id) },
                { label: t('Insert page before'), icon: AddPageIcon, onPress: () => actions.addPage(index) },
                { label: t('Insert page after'), icon: AddPageIcon, onPress: () => actions.addPage(index + 1) },
                {
                  label: t('Move earlier'),
                  icon: ARROW[arrows.earlier],
                  disabled: index <= 0,
                  onPress: () => story.movePage(chapter.id, index, index - 1),
                },
                {
                  label: t('Move later'),
                  icon: ARROW[arrows.later],
                  disabled: index >= chapter.pageIds.length - 1,
                  onPress: () => story.movePage(chapter.id, index, index + 1),
                },
                !!page.flag && { label: t('View flag note'), icon: FlagIcon, onPress: () => actions.setFlagNote(page.id) },
                !!page.flag && { label: t('Remove flag'), icon: FlagIcon, onPress: () => clearPageFlag(page.id) },
                { label: t('Delete'), icon: DeleteIcon, destructive: true, onPress: () => actions.removePages([page.id]) },
              ]
            : []
        }
      />
      <Dialog
        visible={!!flagPage?.flag}
        onClose={() => actions.setFlagNote(null)}
        title={t('Flag note')}
        actions={[{ label: t('Close'), onPress: () => actions.setFlagNote(null) }]}
      >
        <Text>{[flagPage?.flag?.note, ...(flagPage?.flag?.reasons ?? [])].filter(Boolean).join('\n') || t('No note.')}</Text>
      </Dialog>
    </>
  );
}
