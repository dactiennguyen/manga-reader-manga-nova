import { useRef } from 'react';

import { t } from '../../core/i18n';
import {
  canMerge,
  cutFromLine,
  hitTestPanel,
  mergePanels,
  removePanel,
  splitPanel,
  type LayoutTemplate,
  type Pt,
} from '../../core/layout/layout';
import { blankPanel, pasteLayout } from '../../core/layout/pageEdit';
import { clearWarning, pasteWarning, templateWarning, type ChangeWarning } from '../../core/layout/templateChange';
import type { ID, Page } from '../../core/model/types';
import { uid } from '../../core/util/id';
import type { PageContext } from '../../render/drawPage';
import { emptyArt, panelHasArt, saveArt } from '../../state/artStore';
import { undoable, useStory } from '../../state/useStory';
import { confirm, toast } from '../../ui';

export type PagePatch = Partial<Pick<Page, 'layout' | 'panels' | 'order' | 'gutterH' | 'gutterV' | 'height'>>;

const WEBTOON_STEP = 800;
const WEBTOON_MIN_H = 1200;

function ask(warning: ChangeWarning): Promise<boolean> {
  return confirm(warning.title, warning.message, { confirmText: warning.confirmText, destructive: warning.destructive });
}

/**
 * Panel edits. They all land in the shared page:<pageId> history, and none of them touch art: a dropped
 * panel's art stays until a cold-start GC finds nothing pointing at it, which is what lets Undo restore it.
 */
export function usePanelEdits({
  ctx,
  selected,
  commit,
  afterTemplate,
  clearSelection,
}: {
  ctx: PageContext;
  selected: ID | null;
  commit: (patch: PagePatch) => void;
  afterTemplate: () => void;
  clearSelection: () => void;
}) {
  const { page, size, shapes, rtl } = ctx;
  const pageId = page.id;
  const layout = page.layout;
  const panelCount = Object.keys(page.panels).length;
  const gutterRun = useRef(0);

  const pickTemplate = async (template: LayoutTemplate) => {
    const warning = templateWarning(page, template, rtl, panelHasArt);
    if (warning && !(await ask(warning))) {
      return;
    }
    useStory.getState().applyTemplate(pageId, template.id);
    afterTemplate();
  };
  const clearPanels = async () => {
    if (await ask(clearWarning(panelCount))) {
      commit({ layout: null, panels: {}, order: undefined });
    }
  };
  const paste = async () => {
    const snapshot = pasteLayout();
    if (snapshot && (!layout || (await ask(pasteWarning(panelCount))))) {
      commit(snapshot);
    }
  };
  const cut = (p0: Pt, p1: Pt) => {
    const id = hitTestPanel(shapes, { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 });
    const shape = shapes.find(item => item.id === id);
    const line = shape && cutFromLine(shape, p0, p1);
    if (!layout || !shape || !line) {
      toast(t('Draw a longer line across the panel'));
      return;
    }
    const newId = uid();
    commit({
      layout: splitPanel(layout, shape.id, line.dir, line.t0, line.t1, { splitId: uid(), panelId: newId }),
      panels: { ...page.panels, [newId]: blankPanel(newId) },
      order: undefined,
    });
  };
  const without = (panelId: ID) => {
    const panels = { ...page.panels };
    delete panels[panelId];
    return panels;
  };
  const merge = (keepId: ID, removeId: ID) => {
    const next = layout && canMerge(layout, keepId, removeId) ? mergePanels(layout, keepId, removeId) : null;
    clearSelection();
    if (!next) {
      toast(t('Only two panels sharing one divider can be merged'));
      return;
    }
    commit({ layout: next, panels: without(removeId), order: page.order?.filter(id => id !== removeId) });
  };
  const deletePanel = (panelId: ID) => {
    if (layout) {
      commit({ layout: removePanel(layout, panelId), panels: without(panelId), order: page.order?.filter(id => id !== panelId) });
    }
  };
  const togglePanel = (panelId: ID, key: 'bleed' | 'borderless') =>
    useStory.getState().updatePanel(pageId, panelId, { [key]: !page.panels[panelId]?.[key] });
  /** One undo step per slider drag. Writes wait for the pause, like typing. */
  const setGutter = (patch: { gutterH?: number; gutterV?: number }) =>
    undoable(
      { undoScope: `page:${pageId}`, coalesceKey: `gutter:${Object.keys(patch)[0]}:${gutterRun.current}`, typing: true },
      () => commit(patch),
    );
  const endGutter = () => {
    gutterRun.current += 1;
  };
  const extend = () => commit({ height: size.h + WEBTOON_STEP });
  const shorten = () => commit({ height: Math.max(WEBTOON_MIN_H, size.h - WEBTOON_STEP) });
  const autoOrder = () => commit({ order: undefined });
  /** The one place art really goes, and only on request. The dialog says it cannot be undone because it cannot. */
  const deleteArt = async () => {
    const ok =
      !!selected &&
      (await confirm(t("Delete this panel's art?"), t('This cannot be undone.'), { confirmText: t('Delete'), destructive: true }));
    if (ok) {
      saveArt(selected, emptyArt());
      useStory.getState().bumpArt(pageId);
    }
  };

  return {
    pickTemplate,
    clearPanels,
    paste,
    cut,
    merge,
    deletePanel,
    togglePanel,
    setGutter,
    endGutter,
    extend,
    shorten,
    autoOrder,
    deleteArt,
  };
}
