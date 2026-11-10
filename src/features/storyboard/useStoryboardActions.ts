import { useState } from 'react';

import { t, tn } from '../../core/i18n';
import type { PagePlan } from '../../core/model/paginate';
import type { ID, Page, Project } from '../../core/model/types';
import { useAppNavigation } from '../../state/navigation';
import { undoStory, undoable, useStory } from '../../state/useStory';
import { confirm, snackbar, toast } from '../../ui';

export function useStoryboardActions({
  chapterId,
  project,
  pages,
  pageIds,
}: {
  chapterId: ID;
  project: Project | undefined;
  pages: Record<ID, Page>;
  pageIds: ID[];
}) {
  const navigation = useAppNavigation();
  const [selection, setSelection] = useState<ID[] | null>(null);
  const [pageMenu, setPageMenu] = useState<{ id: ID; open: boolean } | null>(null);
  const [flagNote, setFlagNote] = useState<ID | null>(null);
  const [paginating, setPaginating] = useState(false);
  const story = () => useStory.getState();
  const scope = `project:${project?.id}` as const;
  const offerUndo = (message: string) =>
    snackbar({ message, actionLabel: t('Undo'), onAction: () => undoStory(scope) });

  const openPage = (pageId: ID) => navigation.navigate('PanelLayout', { pageId });
  const addPage = (index?: number) => {
    const id = story().addPage(chapterId, index === undefined ? undefined : { index });
    if (index === undefined) {
      openPage(id);
    }
  };
  const removePages = async (ids: ID[]) => {
    const hasContent = ids.some(id => {
      const page = pages[id];
      return page && (page.layout || page.bubbles.length > 0);
    });
    if (hasContent) {
      const ok = await confirm(
        ids.length > 1 ? t('Delete {count} pages?', { count: ids.length }) : t('Delete page {n}?', { n: pageIds.indexOf(ids[0]) + 1 }),
        t('Panels, art and lettering go with it. Undo brings them back.'),
        { confirmText: t('Delete'), destructive: true },
      );
      if (!ok) {
        return;
      }
    }
    undoable({ undoScope: scope }, () => ids.forEach(id => story().removePage(id)));
    setSelection(null);
    offerUndo(ids.length > 1 ? t('{count} pages deleted', { count: ids.length }) : t('Page deleted'));
  };
  const applyPlans = (plans: PagePlan[]) => {
    const created = story().applyPagination(chapterId, plans, 'append');
    setPaginating(false);
    toast(tn(created.length, '{count} page added from script', '{count} pages added from script'));
  };
  const toggleSelect = (pageId: ID) =>
    setSelection(prev => {
      const list = prev ?? [];
      return list.includes(pageId) ? list.filter(id => id !== pageId) : [...list, pageId];
    });
  const pressPage = (pageId: ID) => (selection ? toggleSelect(pageId) : openPage(pageId));
  const longPressPage = (pageId: ID) => (selection ? toggleSelect(pageId) : setPageMenu({ id: pageId, open: true }));
  const closePageMenu = () => setPageMenu(menu => menu && { ...menu, open: false });

  return {
    selection,
    setSelection,
    pageMenu,
    closePageMenu,
    flagNote,
    setFlagNote,
    paginating,
    setPaginating,
    addPage,
    removePages,
    applyPlans,
    pressPage,
    longPressPage,
  };
}
