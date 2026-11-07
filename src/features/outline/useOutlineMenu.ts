import { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Columns2,
  FolderInput,
  List,
  Pencil,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react-native';

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
        toast(`Moved to ${target.crossed}`);
      }
    }
  };

  const requestRemoveAct = async (act: Act) => {
    if (acts.length <= 1) {
      toast('A story needs at least one act');
      return;
    }
    if (act.chapterIds.length > 0) {
      open({ kind: 'removeAct', actId: act.id });
      return;
    }
    const ok = await confirm(`Delete "${act.title}"?`, 'This act is empty.', { confirmText: 'Delete act', destructive: true });
    if (ok) {
      story().removeAct(projectId, act.id);
    }
  };

  const mainMenu = (): MenuContent => ({
    title: 'Outline',
    items: [
      { label: listMode ? 'View as board' : 'View as list', icon: listMode ? Columns2 : List, onPress: actions.toggleList },
      { label: 'AI plot ideas', icon: Sparkles, onPress: actions.openPlotIdeas },
      { label: 'Find plot holes (AI)', icon: Sparkles, onPress: actions.openPlotHoles },
      { label: 'Export outline as text', icon: Share2, onPress: actions.shareOutline },
    ],
  });

  const chapterMenu = (id: ID): MenuContent => {
    const { first, last } = chapterEdges(acts, id);
    return {
      title: `Chapter ${numbers[id] ?? ''}`,
      subtitle: chapters[id]?.title,
      items: [
        { label: 'Edit chapter', icon: Pencil, onPress: () => actions.editChapter(id) },
        { label: 'Break into scenes (AI)', icon: Sparkles, onPress: () => actions.breakIntoScenes(id) },
        { label: 'Move up', icon: ArrowUp, disabled: first, onPress: () => shiftChapter(id, -1) },
        { label: 'Move down', icon: ArrowDown, disabled: last, onPress: () => shiftChapter(id, 1) },
        acts.length > 1 && {
          label: 'Move to act…',
          icon: FolderInput,
          onPress: () => open({ kind: 'chapterToAct', chapterId: id }),
        },
      ],
    };
  };

  const chapterToActMenu = (id: ID): MenuContent => {
    const current = locateChapter(acts, id).act;
    return {
      title: 'Move to act',
      subtitle: chapters[id]?.title,
      items: acts
        .filter(act => act.id !== current?.id)
        .map(act => ({
          label: act.title,
          subtitle: chapterCount(act.chapterIds.length),
          onPress: () => story().moveChapter(id, act.id, act.chapterIds.length),
        })),
    };
  };

  const removeActMenu = (act: Act): MenuContent => ({
    title: `Delete "${act.title}"`,
    subtitle: `This act still has ${chapterCount(act.chapterIds.length)}. Which act should they move to?`,
    items: acts
      .filter(item => item.id !== act.id)
      .map(item => ({
        label: item.title,
        subtitle: chapterCount(item.chapterIds.length),
        onPress: () => {
          story().removeAct(projectId, act.id, item.id);
          toast(`Chapters moved to ${item.title}`);
        },
      })),
  });

  const actMenu = (act: Act): MenuContent => {
    const actIndex = acts.indexOf(act);
    return {
      title: act.title,
      subtitle: chapterCount(act.chapterIds.length),
      items: [
        { label: 'Rename', icon: Pencil, onPress: () => actions.renameAct(act.id) },
        {
          label: 'Move left',
          icon: ArrowLeft,
          disabled: actIndex === 0,
          onPress: () => story().moveAct(projectId, act.id, -1),
        },
        {
          label: 'Move right',
          icon: ArrowRight,
          disabled: actIndex === acts.length - 1,
          onPress: () => story().moveAct(projectId, act.id, 1),
        },
        { label: 'Delete act', icon: Trash2, destructive: true, onPress: () => requestRemoveAct(act) },
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
