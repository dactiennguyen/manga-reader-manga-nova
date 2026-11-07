import { connectTestStorage } from './helpers/storage';
import { TEMPLATES, collectPanelIds } from '../src/core/layout/layout';
import { coalesceTag } from '../src/core/lettering/bubbleEdit';
import { createBubble } from '../src/core/lettering/bubbles';
import { createEffect } from '../src/core/lettering/effects';
import { clearWarning, droppedPanels, pasteWarning, templateWarning } from '../src/core/layout/templateChange';
import { loadArt, newLayer, saveArt } from '../src/state/artStore';
import type { NewProjectInput } from '../src/state/useStory';
import { redoStory, undoStory, undoable, useHistory, useStory } from '../src/state/useStory';
import type { Stroke } from '../src/core/model/types';

const story = () => useStory.getState();

const INPUT: NewProjectInput = {
  title: 'Strip',
  genres: ['Adventure'],
  logline: '',
  format: 'webtoon',
  pageSize: 'B5',
  style: 'shounen',
  color: false,
};

function setup(templateId = 'g3-rows', format: NewProjectInput['format'] = 'manga') {
  const projectId = story().createProject({ ...INPUT, format });
  const chapterId = story().addChapter(projectId);
  const pageId = story().addPage(chapterId, { templateId });
  return { projectId, chapterId, pageId, scope: `page:${pageId}` as const };
}

const page = (id: string) => story().pages[id];

const stroke = (): Stroke => ({ tool: 'gpen', color: '#000', size: 3, opacity: 1, points: [0, 0, 1, 1, 1, 1], pressure: true }) as unknown as Stroke;

beforeEach(() => {
  connectTestStorage();
});

describe('page history', () => {
  it('puts Extend and Shorten in the history, and Undo restores the height', () => {
    const { pageId, scope } = setup('s2', 'webtoon');
    const start = page(pageId).height;
    story().updatePage(pageId, { height: (start ?? 0) + 800 });
    story().updatePage(pageId, { height: (start ?? 0) + 1600 });
    expect(undoStory(scope)).toBe(true);
    expect(page(pageId).height).toBe((start ?? 0) + 800);
    expect(undoStory(scope)).toBe(true);
    expect(page(pageId).height).toBe(start);
    expect(redoStory(scope)).toBe(true);
    expect(page(pageId).height).toBe((start ?? 0) + 800);
  });

  it('brings effects back when a layout edit dropped them', () => {
    const { pageId, scope } = setup();
    const [first, second] = collectPanelIds(page(pageId).layout);
    const keep = createEffect('tone', first);
    const lost = createEffect('speed', second);
    story().updatePage(pageId, { effects: [keep, lost] });

    story().applyTemplate(pageId, 'g1');
    expect(page(pageId).effects).toEqual([keep]);

    undoStory(scope);
    expect(page(pageId).effects).toEqual([keep, lost]);
  });

  it('shares one history between layout and lettering', () => {
    const { pageId, scope } = setup();
    const bubble = createBubble('speak', { x: 100, y: 100 });
    story().updatePage(pageId, { bubbles: [bubble] });
    story().applyTemplate(pageId, 'g2-rows');
    story().updatePage(pageId, { bubbles: [{ ...bubble, x: 300 }] });

    undoStory(scope);
    expect(page(pageId).bubbles[0].x).toBe(bubble.x);
    expect(collectPanelIds(page(pageId).layout)).toHaveLength(2);
    undoStory(scope);
    expect(collectPanelIds(page(pageId).layout)).toHaveLength(3);
    expect(page(pageId).bubbles).toHaveLength(1);
    undoStory(scope);
    expect(page(pageId).bubbles).toHaveLength(0);
  });

  it('keeps each undo to the fields that edit touched', () => {
    const { pageId, scope } = setup();
    story().updatePage(pageId, { gutterH: 30 });
    undoable({}, () => story().updatePage(pageId, { done: true }));
    undoStory(scope);
    expect(page(pageId).gutterH).not.toBe(30);
    expect(page(pageId).done).toBe(true);
  });

  it('leaves page status out of the history', () => {
    const { pageId, scope } = setup();
    undoable({}, () => story().updatePage(pageId, { done: true }));
    expect(undoStory(scope)).toBe(false);
  });
});

describe('coalescing bubble edits', () => {
  const edit = (pageId: string, fontSize: number, tag: string) =>
    undoable({ undoScope: `page:${pageId}`, coalesceKey: tag, typing: true }, () => {
      const [bubble, ...rest] = page(pageId).bubbles;
      story().updatePage(pageId, { bubbles: [{ ...bubble, fontSize }, ...rest] });
    });

  function withBubble() {
    const ids = setup();
    story().updatePage(ids.pageId, { bubbles: [createBubble('speak', { x: 0, y: 0 }, { fontSize: 20 })] });
    return { ...ids, id: page(ids.pageId).bubbles[0].id };
  }

  it('folds a run of one property into one step', () => {
    const { pageId, scope, id } = withBubble();
    const past = () => useHistory.getState().history[scope]?.past.length;
    const before = past();
    [22, 24, 26].forEach(size => edit(pageId, size, coalesceTag(0, id, 'size')));
    expect(past()).toBe((before ?? 0) + 1);
    undoStory(scope);
    expect(page(pageId).bubbles[0].fontSize).toBe(20);
  });

  it('keeps different properties apart', () => {
    const { pageId, scope, id } = withBubble();
    edit(pageId, 22, coalesceTag(0, id, 'size'));
    edit(pageId, 24, coalesceTag(0, id, 'other'));
    undoStory(scope);
    expect(page(pageId).bubbles[0].fontSize).toBe(22);
  });

  it('starts a new step after an undo when the epoch moves', () => {
    const { pageId, scope, id } = withBubble();
    edit(pageId, 22, coalesceTag(0, id, 'size'));
    story().updatePage(pageId, { gutterH: 40 });
    undoStory(scope);
    edit(pageId, 30, coalesceTag(1, id, 'size'));
    undoStory(scope);
    expect(page(pageId).bubbles[0].fontSize).toBe(22);
  });
});

describe('dropping panels', () => {
  const template = (id: string) => TEMPLATES.find(item => item.id === id)!;

  function withArt() {
    const ids = setup();
    const panels = collectPanelIds(page(ids.pageId).layout);
    panels.forEach(id => saveArt(id, { layers: [{ ...newLayer('Ink'), strokes: [stroke()] }] }));
    return { ...ids, panels };
  }

  it('counts the panels a template drops, in reading order', () => {
    const { pageId, panels } = withArt();
    expect(droppedPanels(page(pageId), template('g1'), true)).toHaveLength(2);
    expect(droppedPanels(page(pageId), template('g3-rows'), true)).toHaveLength(0);
    expect(panels).toHaveLength(3);
  });

  it('says how many are dropped and that Undo restores them with their art', () => {
    const { pageId } = withArt();
    const { message } = templateWarning(page(pageId), template('g1'), true, () => true)!;
    expect(message).toContain('2 panels are dropped');
    expect(message).toContain('Undo restores them with their art');
    expect(templateWarning(page(pageId), template('g2-rows'), true, () => false)?.message).toContain('1 panel is dropped');
  });

  it('asks only about art when nothing is dropped, and not at all on a clean page', () => {
    const { pageId } = withArt();
    expect(templateWarning(page(pageId), template('g4-grid'), true, () => true)?.message).toBe(
      'Art stays where it was on the page.',
    );
    expect(templateWarning(page(pageId), template('g4-grid'), true, () => false)).toBeNull();
  });

  it('never claims Clear or Paste destroys art for good', () => {
    for (const warning of [clearWarning(3), pasteWarning(3)]) {
      expect(warning.message).toContain('3 panels are dropped');
      expect(warning.message).toContain('Undo restores them with their art');
    }
  });

  it('restores cleared panels with their art', () => {
    const { pageId, scope, panels } = withArt();
    story().updatePage(pageId, { layout: null, panels: {}, order: undefined });
    expect(page(pageId).layout).toBeNull();
    expect(loadArt(panels[0])?.layers[0].strokes).toHaveLength(1);
    undoStory(scope);
    expect(collectPanelIds(page(pageId).layout)).toEqual(panels);
    expect(loadArt(panels[2])?.layers[0].strokes).toHaveLength(1);
  });
});
