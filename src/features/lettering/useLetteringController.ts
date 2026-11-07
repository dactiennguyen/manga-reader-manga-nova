import { useMemo, useReducer, useRef } from 'react';

import { bubblesInOrder, bubblesInPanel, coalesceTag, duplicateBubble, moveInStack, patchItem, scriptSync } from '../../core/lettering/bubbleEdit';
import { fitBubbleText, fitTranslatedText } from '../../core/lettering/fit';
import { INITIAL_LETTERING, letteringReducer, stageOf } from '../../core/lettering/letteringState';
import { autoPlace, blockMapOf, pageBlocksOf, placeBlock, type PageBlock } from '../../core/lettering/script';
import { hasTranslation, localizeBubble, setTranslation, translatableBubbles } from '../../core/lettering/translation';
import type { Bubble, Chapter, Effect, ID, Page } from '../../core/model/types';
import { plural } from '../../core/util/format';
import { bubbleMeasure } from '../../render/drawBubble';
import type { PageContext } from '../../render/drawPage';
import { useEngineFonts } from '../../render/fonts';
import { panelHasArt, useArtVersion } from '../../state/artStore';
import { useCharacters, useLastOpened } from '../../state/hooks';
import { redoStory, undoStory, undoable, useStory, useUndoState } from '../../state/useStory';
import { toast } from '../../ui';
import { useActiveLanguage } from './useActiveLanguage';

export function useLetteringController({ ctx, chapter }: { ctx: PageContext; chapter: Chapter }) {
  const { page, project, size, shapes, rtl } = ctx;
  const pageId = page.id;
  const scope = `page:${pageId}` as const;
  const [state, dispatch] = useReducer(letteringReducer, INITIAL_LETTERING);
  const [lang, setLang] = useActiveLanguage(project);
  const { canUndo, canRedo } = useUndoState(scope);
  const fonts = useEngineFonts();
  const artVersion = useArtVersion();
  const scenes = useStory(s => s.scenes);
  const characters = useCharacters(project.id);
  const epoch = useRef(0);
  useLastOpened(project.id, { screen: 'Lettering', chapterId: page.chapterId, pageId });

  const { bubbles, effects } = page;
  const measure = useMemo(() => (fonts ? bubbleMeasure(fonts) : null), [fonts]);
  const blockMap = useMemo(() => blockMapOf(chapter.sceneIds.map(id => scenes[id])), [chapter.sceneIds, scenes]);
  const pageBlocks = useMemo(() => pageBlocksOf(page, blockMap, rtl), [page, blockMap, rtl]);
  const unplaced = pageBlocks.filter(item => !item.placed);
  const orphans = useMemo(() => bubbles.filter(bubble => bubble.blockId && !blockMap[bubble.blockId]), [bubbles, blockMap]);
  const warned = useMemo(
    () =>
      measure
        ? bubbles.filter(bubble => {
            const shown = localizeBubble(bubble, lang);
            if (!shown.text.trim()) {
              return false;
            }
            return (shown === bubble ? fitBubbleText(bubble, measure) : fitTranslatedText(bubble, shown, measure)).overflow;
          })
        : [],
    [bubbles, measure, lang],
  );
  const order = useMemo(() => bubblesInOrder(bubbles, shapes, rtl), [bubbles, shapes, rtl]);
  const untranslated = useMemo(
    () => (lang ? translatableBubbles(bubbles, lang).filter(bubble => !hasTranslation(bubble, lang)) : []),
    [bubbles, lang],
  );
  const noArt = useMemo(
    () => shapes.length > 0 && !shapes.some(shape => panelHasArt(shape.id)),
    // Art is not in React state: artVersion is what says it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shapes, artVersion],
  );

  const { selection, draft, draftCenter } = state;
  const stored = selection?.kind === 'bubble' ? bubbles.find(bubble => bubble.id === selection.id) ?? null : null;
  const selectedBubble = draft && stored && draft.id === stored.id ? draft : stored;
  const selectedEffect = selection?.kind === 'effect' ? effects.find(effect => effect.id === selection.id) ?? null : null;
  const effectShape = selectedEffect ? shapes.find(shape => shape.id === selectedEffect.panelId) ?? null : null;
  const effectCenter =
    selectedEffect?.type === 'focus' && effectShape
      ? draftCenter ?? {
          x: effectShape.bbox.x + effectShape.bbox.w * selectedEffect.cx,
          y: effectShape.bbox.y + effectShape.bbox.h * selectedEffect.cy,
        }
      : null;
  const stage = useMemo(() => stageOf(state.box, size), [state.box, size]);
  const view = state.view ?? stage.fit;
  const k = stage.scale * view.z;

  const current = (): Page | undefined => useStory.getState().pages[pageId];

  /** Tagged edits are a run of one property: one undo step, written after the pause like typing. */
  const commit = (patch: Partial<Pick<Page, 'bubbles' | 'effects'>>, tag?: string) =>
    undoable({ undoScope: scope, coalesceKey: tag, typing: !!tag }, () => useStory.getState().updatePage(pageId, patch));

  const tagOf = (id: ID, property: string | undefined) => (property ? coalesceTag(epoch.current, id, property) : undefined);

  const changeBubble = (id: ID, patch: Partial<Bubble>, tag?: string) => {
    const list = current()?.bubbles;
    const next = list && patchItem(list, id, patch);
    if (next && next !== list) {
      commit({ bubbles: next }, tagOf(id, tag));
    }
  };
  const changeEffect = (id: ID, patch: Partial<Effect>, tag?: string) => {
    const list = current()?.effects;
    const next = list && patchItem(list, id, patch);
    if (next && next !== list) {
      commit({ effects: next }, tagOf(id, tag));
    }
  };
  const replaceBubble = (bubble: Bubble) =>
    commit({ bubbles: (current()?.bubbles ?? []).map(item => (item.id === bubble.id ? bubble : item)) });
  const addBubbles = (created: Bubble[]) => commit({ bubbles: [...(current()?.bubbles ?? []), ...created] });
  const addEffect = (effect: Effect) => commit({ effects: [...(current()?.effects ?? []), effect] });
  const removeBubble = (id: ID) => {
    commit({ bubbles: (current()?.bubbles ?? []).filter(bubble => bubble.id !== id) });
    dispatch({ type: 'select', selection: null });
  };
  const removeEffect = (id: ID) => {
    commit({ effects: (current()?.effects ?? []).filter(effect => effect.id !== id) });
    dispatch({ type: 'select', selection: null });
  };
  const reorder = (id: ID, step: number) => {
    const list = current()?.bubbles;
    const next = list && moveInStack(list, id, step);
    if (next && next !== list) {
      commit({ bubbles: next });
    }
  };
  const duplicate = (id: ID) => {
    const source = current()?.bubbles.find(bubble => bubble.id === id);
    if (source) {
      const created = duplicateBubble(source);
      addBubbles([created]);
      dispatch({ type: 'select', selection: { kind: 'bubble', id: created.id } });
    }
  };
  const changeTranslation = (id: ID, text: string) => {
    if (lang) {
      commit(
        { bubbles: (current()?.bubbles ?? []).map(item => (item.id === id ? setTranslation(item, lang, text) : item)) },
        tagOf(id, `lang:${lang}`),
      );
    }
  };
  const applyTranslations = (entries: Record<ID, string>) => {
    if (lang) {
      commit({
        bubbles: (current()?.bubbles ?? []).map(item =>
          entries[item.id] !== undefined ? setTranslation(item, lang, entries[item.id]) : item,
        ),
      });
    }
  };

  /** The script only follows the original text, never a translation. */
  const closeEditor = () => {
    const editedOriginal = state.originalOpen;
    dispatch({ type: 'closeSheet' });
    if (lang && !editedOriginal) {
      return;
    }
    const story = useStory.getState();
    const bubble = story.pages[pageId]?.bubbles.find(item => item.id === selection?.id);
    const sync = scriptSync(bubble, chapter.sceneIds.map(id => story.scenes[id]));
    if (sync) {
      story.updateScene(sync.sceneId, { blocks: sync.blocks });
    }
  };

  const placeFromList = (item: PageBlock) => {
    const shape = shapes.find(entry => entry.id === item.panelId);
    if (!shape) {
      return;
    }
    const inPanel = bubblesInPanel(bubbles, shapes, shape.id);
    const bottom = inPanel.reduce((max, bubble) => Math.max(max, bubble.y + bubble.h * 0.72), shape.bbox.y + 20);
    const created = placeBlock(item, shape.bbox, inPanel.length, { y: bottom }, rtl, measure);
    addBubbles([created]);
    dispatch({ type: 'select', selection: { kind: 'bubble', id: created.id } });
    dispatch({ type: 'closeSheet' });
  };
  const runAutoPlace = () => {
    const created = autoPlace(pageBlocks, shapes, rtl, measure);
    if (created.length) {
      addBubbles(created);
      dispatch({ type: 'showBubbles' });
      toast(`Placed ${plural(created.length, 'bubble')}`);
    }
  };
  const moved = () => {
    epoch.current += 1;
    dispatch({ type: 'dragEnd' });
  };
  const undo = () => {
    undoStory(scope);
    moved();
  };
  const redo = () => {
    redoStory(scope);
    moved();
  };

  const panelNumber = (panelId: ID) => shapes.findIndex(shape => shape.id === panelId) + 1;

  return {
    ctx,
    chapter,
    pageId,
    page,
    project,
    state,
    dispatch,
    lang,
    setLang,
    canUndo,
    canRedo,
    undo,
    redo,
    fonts,
    characters,
    pageBlocks,
    unplaced,
    orphans,
    warned,
    order,
    untranslated,
    noArt,
    stored,
    selectedBubble,
    selectedEffect,
    effectShape,
    effectCenter,
    stage,
    view,
    k,
    changeBubble,
    changeEffect,
    replaceBubble,
    addBubbles,
    addEffect,
    removeBubble,
    removeEffect,
    reorder,
    duplicate,
    changeTranslation,
    applyTranslations,
    closeEditor,
    placeFromList,
    runAutoPlace,
    panelNumber,
  };
}

export type LetteringController = ReturnType<typeof useLetteringController>;
