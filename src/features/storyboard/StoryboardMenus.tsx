import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleCheck,
  Copy,
  Flag,
  LayoutGrid,
  List,
  ListChecks,
  ScrollText,
  SquarePlus,
  Trash2,
} from 'lucide-react-native';

import type { Chapter, ID, Page } from '../../core/model/types';
import { moveArrows, type MoveArrow } from '../../core/reorder/storyboardGrid';
import { useAppNavigation } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { Dialog, Menu, Text, type LucideIcon } from '../../ui';
import { clearPageFlag, setPagesDone } from '../page/pageActions';
import type { useStoryboardActions } from './useStoryboardActions';

const ARROW: Record<MoveArrow, LucideIcon> = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown };

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
          { label: 'View script', icon: ScrollText, onPress: () => navigation.navigate('Script', { chapterId: chapter.id }) },
          listView
            ? { label: 'View: Grid', icon: LayoutGrid, onPress: onToggleList }
            : { label: 'View: List', icon: List, onPress: onToggleList },
          chapter.pageIds.length > 0 && {
            label: 'Select multiple',
            icon: ListChecks,
            onPress: () => actions.setSelection([]),
          },
        ]}
      />
      <Menu
        visible={!!pageMenu?.open && !!page}
        onClose={actions.closePageMenu}
        title={page ? `Page ${index + 1}` : undefined}
        items={
          page
            ? [
                {
                  label: page.done ? 'Mark not done' : 'Mark done',
                  icon: CircleCheck,
                  onPress: () => setPagesDone([page.id], !page.done),
                },
                { label: 'Duplicate', icon: Copy, onPress: () => story.duplicatePage(page.id) },
                { label: 'Insert page before', icon: SquarePlus, onPress: () => actions.addPage(index) },
                { label: 'Insert page after', icon: SquarePlus, onPress: () => actions.addPage(index + 1) },
                {
                  label: 'Move earlier',
                  icon: ARROW[arrows.earlier],
                  disabled: index <= 0,
                  onPress: () => story.movePage(chapter.id, index, index - 1),
                },
                {
                  label: 'Move later',
                  icon: ARROW[arrows.later],
                  disabled: index >= chapter.pageIds.length - 1,
                  onPress: () => story.movePage(chapter.id, index, index + 1),
                },
                !!page.flag && { label: 'View flag note', icon: Flag, onPress: () => actions.setFlagNote(page.id) },
                !!page.flag && { label: 'Remove flag', icon: Flag, onPress: () => clearPageFlag(page.id) },
                { label: 'Delete', icon: Trash2, destructive: true, onPress: () => actions.removePages([page.id]) },
              ]
            : []
        }
      />
      <Dialog
        visible={!!flagPage?.flag}
        onClose={() => actions.setFlagNote(null)}
        title="Flag note"
        actions={[{ label: 'Close', onPress: () => actions.setFlagNote(null) }]}
      >
        <Text>{[flagPage?.flag?.note, ...(flagPage?.flag?.reasons ?? [])].filter(Boolean).join('\n') || 'No note.'}</Text>
      </Dialog>
    </>
  );
}
