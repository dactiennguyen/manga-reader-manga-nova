import { useState } from 'react';
import { AiIcon, ArrowDownIcon, ArrowUpIcon, BackIcon, ColumnsIcon, DeleteIcon, EditIcon, ForwardIcon, ListIcon, MoveToIcon, ShareIcon } from '../../ui/icons';

import { t, tn } from '../../core/i18n';
import type { Act, Chapter, ID, Project } from '../../core/model/types';
import { chapterCount, chapterEdges, locateChapter, shiftTarget } from '../../core/story/outlineTools';
import { useStory } from '../../state/useStory';
import { confirm, toast, type MenuItem } from '../../ui';

export type MenuState =
  | { kind: 'main' }
  | { kind: 'chapter'; chapterId: ID }
  | { kind: 'chapterToAct'; chapterId: ID }
  | { kind: 'act'; actId: ID }
  | { kind: 'removeAct'; actId: ID };

type Actions = {
  toggleList: () => void;
  openPlotIdeas: () => void;
  openPlotHoles: () => void;
  shareOutline: () => void;
  editChapter: (chapterId: ID) => void;
  breakIntoScenes: (chapterId: ID) => void;
  renameAct: (actId: ID) => void;
};

type MenuContent = { title?: string; subtitle?: string; items: (MenuItem | false)[] };

export function useOutlineMenu({
  project,
  chapters,
  numbers,
  listMode,
  actions,
}: {
  project: Project;
  chapters: Record<ID, Chapter | undefined>;
  numbers: Record<ID, number>;
  listMode: boolean;
  actions: Actions;
}) {
  // The last content stays in place so the sheet does not empty out while it slides away.
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [visible, setVisible] = useState(false);
  const acts = project.acts;
  const projectId = project.id;

  const open = (next: MenuState) => {
    setMenu(next);
    setVisible(true);
  };

  const story = () => useStory.getState();

  const shiftChapter = (chapterId: ID, delta: -1 | 1) => {
    const target = shiftTarget(acts, chapterId, delta);
    if (target) {
      story().moveChapter(chapterId, target.actId, target.index);
      if (target.crossed) {
        toast(t('Moved to {act}', { act: t(target.crossed) }));
      }
    }
  };

  const requestRemoveAct = async (act: Act) => {
    if (acts.length <= 1) {
      toast(t('A story needs at least one act'));
      return;
    }
    if (act.chapterIds.length > 0) {
      open({ kind: 'removeAct', actId: act.id });
      return;
    }
    const ok = await confirm(t('Delete "{name}"?', { name: t(act.title) }), t('This act is empty.'), {
      confirmText: t('Delete act'),
      destructive: true,
    });
    if (ok) {
      story().removeAct(projectId, act.id);
    }
  };

  const mainMenu = (): MenuContent => ({
    title: t('Outline'),
    items: [
      { label: listMode ? t('View as board') : t('View as list'), icon: listMode ? ColumnsIcon : ListIcon, onPress: actions.toggleList },
      { label: t('AI plot ideas'), icon: AiIcon, onPress: actions.openPlotIdeas },
      { label: t('Find plot holes (AI)'), icon: AiIcon, onPress: actions.openPlotHoles },
      { label: t('Export outline as text'), icon: ShareIcon, onPress: actions.shareOutline },
    ],
  });

  const chapterMenu = (id: ID): MenuContent => {
    const { first, last } = chapterEdges(acts, id);
    return {
      title: t('Chapter {n}', { n: numbers[id] ?? '' }),
      subtitle: chapters[id]?.title,
      items: [
        { label: t('Edit chapter'), icon: EditIcon, onPress: () => actions.editChapter(id) },
        { label: t('Break into scenes (AI)'), icon: AiIcon, onPress: () => actions.breakIntoScenes(id) },
        { label: t('Move up'), icon: ArrowUpIcon, disabled: first, onPress: () => shiftChapter(id, -1) },
        { label: t('Move down'), icon: ArrowDownIcon, disabled: last, onPress: () => shiftChapter(id, 1) },
        acts.length > 1 && {
          label: t('Move to act…'),
          icon: MoveToIcon,
          onPress: () => open({ kind: 'chapterToAct', chapterId: id }),
        },
      ],
    };
  };

  const chapterToActMenu = (id: ID): MenuContent => {
    const current = locateChapter(acts, id).act;
    return {
      title: t('Move to act'),
      subtitle: chapters[id]?.title,
      items: acts
        .filter(act => act.id !== current?.id)
        .map(act => ({
          label: t(act.title),
          subtitle: chapterCount(act.chapterIds.length),
          onPress: () => story().moveChapter(id, act.id, act.chapterIds.length),
        })),
    };
  };

  const removeActMenu = (act: Act): MenuContent => ({
    title: t('Delete "{name}"', { name: t(act.title) }),
    subtitle: tn(
      act.chapterIds.length,
      'This act still has {count} chapter. Which act should they move to?',
      'This act still has {count} chapters. Which act should they move to?',
    ),
    items: acts
      .filter(item => item.id !== act.id)
      .map(item => ({
        label: t(item.title),
        subtitle: chapterCount(item.chapterIds.length),
        onPress: () => {
          story().removeAct(projectId, act.id, item.id);
          toast(t('Chapters moved to {act}', { act: t(item.title) }));
        },
      })),
  });

  const actMenu = (act: Act): MenuContent => {
    const actIndex = acts.indexOf(act);
    return {
      title: t(act.title),
      subtitle: chapterCount(act.chapterIds.length),
      items: [
        { label: t('Rename'), icon: EditIcon, onPress: () => actions.renameAct(act.id) },
        {
          label: t('Move left'),
          icon: BackIcon,
          disabled: actIndex === 0,
          onPress: () => story().moveAct(projectId, act.id, -1),
        },
        {
          label: t('Move right'),
          icon: ForwardIcon,
          disabled: actIndex === acts.length - 1,
          onPress: () => story().moveAct(projectId, act.id, 1),
        },
        { label: t('Delete act'), icon: DeleteIcon, destructive: true, onPress: () => requestRemoveAct(act) },
      ],
    };
  };

  const content = (): MenuContent => {
    if (!menu) {
      return { items: [] };
    }
    switch (menu.kind) {
      case 'main':
        return mainMenu();
      case 'chapter':
        return chapterMenu(menu.chapterId);
      case 'chapterToAct':
        return chapterToActMenu(menu.chapterId);
    }
    const act = acts.find(item => item.id === menu.actId);
    if (!act) {
      return { items: [] };
    }
    return menu.kind === 'removeAct' ? removeActMenu(act) : actMenu(act);
  };

  return { open, close: () => setVisible(false), visible, ...content() };
}
