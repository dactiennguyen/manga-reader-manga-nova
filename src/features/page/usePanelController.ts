import { useMemo, useRef, useState } from 'react';

import { computeDividers, computePanels, hitTestPanel, setSplit, type Pt } from '../../core/layout/layout';
import { dragSplit, hitHandle, type HandleKind } from '../../core/layout/pageEdit';
import {
  HANDLE_HIT_DP,
  HOME_VIEW,
  clampView,
  clampZoom,
  fitScale,
  insidePage,
  pageFrame,
  swipeStep,
  toPagePoint,
  type LayoutView,
} from '../../core/layout/pageView';
import type { Chapter, ID } from '../../core/model/types';
import type { PageContext } from '../../render/drawPage';
import { useLastOpened } from '../../state/hooks';
import { useAppNavigation } from '../../state/navigation';
import { useStory } from '../../state/useStory';
import { toast } from '../../ui';
import type { PanelGestureHandlers } from './PanelGestures';
import { usePanelEdits, type PagePatch } from './usePanelEdits';

export type Tool = 'none' | 'cut' | 'merge' | 'gutter' | 'order';

export type PanelSheet = 'menu' | 'jump' | 'art' | 'shot' | 'describe' | null;

type Drag = { splitId: ID; t0: number; t1: number };

type Active =
  | { kind: 'cut'; p0: Pt }
  | { kind: 'handle'; splitId: ID; handle: HandleKind }
  | { kind: 'swipe' }
  | { kind: 'view'; tx: number; ty: number };

export function usePanelController({
  ctx,
  chapter,
  initialMode,
}: {
  ctx: PageContext;
  chapter: Chapter;
  initialMode?: 'panels' | 'art';
}) {
  const { page, project, size, shapes, rtl } = ctx;
  const pageId = page.id;
  const navigation = useAppNavigation();
  const [mode, setMode] = useState<'panels' | 'art'>(initialMode ?? (page.layout ? 'art' : 'panels'));
  const [tool, setTool] = useState<Tool>('none');
  const [view, setView] = useState<LayoutView>(HOME_VIEW);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pickedPanel, setPickedPanel] = useState<ID | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [cutLine, setCutLine] = useState<{ p0: Pt; p1: Pt } | null>(null);
  const [picked, setPicked] = useState<ID[]>([]);
  const [safeGrid, setSafeGrid] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(!page.layout && (initialMode ?? 'panels') === 'panels');
  const [sheet, setSheet] = useState<PanelSheet>(null);
  const [panelMenu, setPanelMenu] = useState<{ id: ID; open: boolean } | null>(null);
  const active = useRef<Active | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const pinchStart = useRef(1);
  const panStart = useRef({ tx: 0, ty: 0 });

  useLastOpened(project.id, { screen: 'PanelLayout', chapterId: page.chapterId, pageId });

  const layout = page.layout;
  const webtoon = project.format === 'webtoon';
  const index = chapter.pageIds.indexOf(pageId);
  const total = chapter.pageIds.length;
  const selected = pickedPanel && page.panels[pickedPanel] ? pickedPanel : null;

  const draftPage = useMemo(
    () => (layout && drag ? { ...page, layout: setSplit(layout, drag.splitId, drag.t0, drag.t1) } : null),
    [page, layout, drag],
  );
  const draftShapes = useMemo(
    () => (draftPage ? computePanels(draftPage, size, { rtl }) : null),
    [draftPage, size, rtl],
  );
  const dividers = useMemo(
    () => (mode === 'panels' && tool === 'none' ? computeDividers(draftPage ?? page, size, { rtl }) : []),
    [draftPage, page, size, rtl, mode, tool],
  );

  const fit = fitScale(box, size, webtoon);
  const frame = pageFrame(box, size, view, fit, webtoon);
  const toPage = (x: number, y: number) => toPagePoint(frame, x, y);
  const clamped = (next: LayoutView) => clampView(next, box, size, fit, webtoon);

  /** Every edit below goes through updatePage or updatePanel, which file it under page:<pageId>. */
  const commit = (patch: PagePatch) => useStory.getState().updatePage(pageId, patch);

  const goTo = (target: number) => {
    const id = chapter.pageIds[target];
    if (id) {
      navigation.replace('PanelLayout', { pageId: id, mode });
    } else {
      toast(target < 0 ? 'This is the first page' : 'This is the last page');
    }
  };
  const goBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.replace('Storyboard', { chapterId: chapter.id });
  const pickTool = (next: Tool) => {
    setTool(tool === next ? 'none' : next);
    setPickedPanel(null);
    setPicked([]);
  };
  const changeMode = (next: 'panels' | 'art') => {
    setMode(next);
    setTool('none');
    setPickedPanel(null);
  };

  const edits = usePanelEdits({
    ctx,
    selected,
    commit,
    afterTemplate: () => {
      setTemplatesOpen(false);
      setPickedPanel(null);
    },
    clearSelection: () => setPickedPanel(null),
  });

  const tapPanel = (id: ID | null) => {
    if (mode === 'panels' && tool === 'merge' && id && selected && id !== selected) {
      edits.merge(selected, id);
    } else if (mode === 'panels' && tool === 'order' && id) {
      const next = picked.includes(id) ? picked.filter(item => item !== id) : [...picked, id];
      if (next.length === shapes.length) {
        commit({ order: next });
        setPicked([]);
        setTool('none');
        toast('Reading order set');
      } else {
        setPicked(next);
      }
    } else {
      setPickedPanel(id === selected ? null : id);
    }
  };

  const handlers: PanelGestureHandlers = {
    panStart: e => {
      const p = toPage(e.x - e.translationX, e.y - e.translationY);
      const hit = hitHandle(dividers, p, HANDLE_HIT_DP / frame.k);
      if (mode === 'panels' && tool === 'cut' && insidePage(p, size)) {
        active.current = { kind: 'cut', p0: p };
      } else if (hit) {
        active.current = { kind: 'handle', splitId: hit.divider.splitId, handle: hit.kind };
      } else if (!insidePage(p, size)) {
        active.current = { kind: 'swipe' };
      } else {
        active.current = { kind: 'view', tx: view.tx, ty: view.ty };
      }
    },
    panMove: e => {
      const a = active.current;
      if (a?.kind === 'cut') {
        setCutLine({ p0: a.p0, p1: toPage(e.x, e.y) });
      } else if (a?.kind === 'handle') {
        const base = computeDividers(page, size, { rtl }).find(item => item.splitId === a.splitId);
        if (base) {
          dragRef.current = {
            splitId: a.splitId,
            ...dragSplit(base, a.handle, e.translationX / frame.k, e.translationY / frame.k),
          };
          setDrag(dragRef.current);
        }
      } else if (a?.kind === 'view' && (webtoon || view.scale > 1)) {
        setView(clamped({ scale: view.scale, tx: a.tx + e.translationX, ty: a.ty + e.translationY }));
      }
    },
    panEnd: e => {
      const a = active.current;
      if (a?.kind === 'cut') {
        edits.cut(a.p0, toPage(e.x, e.y));
      } else if (a?.kind === 'handle' && dragRef.current && layout) {
        commit({ layout: setSplit(layout, a.splitId, dragRef.current.t0, dragRef.current.t1) });
      } else if (a?.kind === 'swipe') {
        const step = swipeStep(e.translationX, e.translationY, rtl);
        if (step) {
          goTo(index + step);
        }
      }
    },
    panFinish: () => {
      active.current = null;
      dragRef.current = null;
      setDrag(null);
      setCutLine(null);
    },
    pinchStart: () => {
      pinchStart.current = view.scale;
    },
    pinchMove: scale => setView(prev => clamped({ ...prev, scale: clampZoom(pinchStart.current * scale, webtoon) })),
    twoFingerStart: () => {
      panStart.current = { tx: view.tx, ty: view.ty };
    },
    twoFingerMove: (x, y) =>
      setView(prev => clamped({ ...prev, tx: panStart.current.tx + x, ty: panStart.current.ty + y })),
    tap: (x, y) => tapPanel(hitTestPanel(shapes, toPage(x, y))),
    doubleTap: (x, y) => {
      const id = hitTestPanel(shapes, toPage(x, y));
      if (mode === 'art' && id) {
        navigation.navigate('Canvas', { pageId, panelId: id });
      } else {
        setView(HOME_VIEW);
      }
    },
    hold: (x, y) => {
      const id = hitTestPanel(shapes, toPage(x, y));
      if (id && mode === 'panels' && tool === 'none') {
        setPanelMenu({ id, open: true });
      }
    },
  };

  return {
    ctx,
    chapter,
    pageId,
    page,
    layout,
    webtoon,
    index,
    total,
    mode,
    tool,
    box,
    frame,
    fit,
    selected,
    picked,
    drag,
    draftShapes,
    dividers,
    cutLine,
    safeGrid,
    templatesOpen,
    sheet,
    panelMenu,
    handlers,
    setBox,
    setView,
    setSheet,
    setSafeGrid,
    setTemplatesOpen,
    setPanelMenu,
    goTo,
    goBack,
    pickTool,
    changeMode,
    ...edits,
  };
}

export type PanelController = ReturnType<typeof usePanelController>;
