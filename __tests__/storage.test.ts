import { parseProjectBundle } from '../src/core/archive/parse';
import { migrate, userVersion, MIGRATIONS } from '../src/data/migrations';
import { collectPanelIds } from '../src/core/layout/layout';
import type { Stroke } from '../src/core/model/types';
import {
  addLayer,
  commitStroke,
  editLayer,
  emptyArt,
  loadArt,
  mergeLayers,
  newLayer,
  panelHasArt,
  redoArt,
  removeLayer,
  rewriteLayer,
  saveArt,
  undoArt,
} from '../src/state/artStore';
import {
  connectStory,
  flushStory,
  importEntities,
  redoStory,
  undoStory,
  undoable,
  useHistory,
  useStory,
} from '../src/state/useStory';
import { createStoryRepo } from '../src/data/storyRepo';
import { createNodeDb } from './helpers/nodeDb';
import { connectTestStorage, restart } from './helpers/storage';

const story = () => useStory.getState();

const stroke = (x = 1): Stroke => ({ tool: 'gpen', color: '#000000', size: 4, opacity: 1, points: [x, 2, 3, 4] });

function newStory() {
  const projectId = story().createProject({
    title: 'T',
    genres: [],
    logline: '',
    format: 'manga',
    pageSize: 'B5',
    style: 'shounen',
    color: false,
  });
  const chapterId = story().projects[projectId].acts[0].chapterIds[0];
  return { projectId, chapterId };
}

function drawablePanel() {
  const { chapterId } = newStory();
  const pageId = story().addPage(chapterId, { templateId: 'g1' });
  const [panelId] = collectPanelIds(story().pages[pageId].layout);
  const art = saveArt(panelId, emptyArt());
  return { pageId, panelId, layerId: art.layers[0].id };
}

describe('story rows on disk', () => {
  it('reads back exactly what was written after a cold start', () => {
    const db = connectTestStorage();
    const { projectId, chapterId } = newStory();
    const sceneId = story().addScene(chapterId, { description: 'Rooftop' });
    story().updateScene(sceneId, { blocks: [{ id: 'b1', type: 'action', text: 'Rain falls' }] });
    const before = { project: story().projects[projectId], scene: story().scenes[sceneId] };
    restart(db);
    expect(story().projects[projectId]).toEqual(before.project);
    expect(story().scenes[sceneId]).toEqual(before.scene);
  });

  it('writes only the rows that changed', () => {
    const db = connectTestStorage();
    const { chapterId } = newStory();
    const sceneId = story().addScene(chapterId);
    const other = story().addScene(chapterId);
    flushStory();
    const stamp = () => db.query('SELECT doc FROM scenes WHERE id = ?', [other])[0].doc;
    const untouched = stamp();
    story().updateScene(sceneId, { description: 'changed' });
    flushStory();
    expect(stamp()).toBe(untouched);
    expect(db.query('SELECT doc FROM scenes WHERE id = ?', [sceneId])[0].doc).toContain('changed');
  });

  it('holds typing back until the flush, and never loses it', () => {
    const db = connectTestStorage();
    const { chapterId } = newStory();
    const sceneId = story().addScene(chapterId);
    story().updateScene(sceneId, { description: 'typing' });
    expect(db.query('SELECT doc FROM scenes WHERE id = ?', [sceneId])[0].doc).not.toContain('typing');
    flushStory();
    expect(db.query('SELECT doc FROM scenes WHERE id = ?', [sceneId])[0].doc).toContain('typing');
  });

  it('soft deletes rows and revives them on undo', () => {
    const db = connectTestStorage();
    const { projectId, chapterId } = newStory();
    const pageId = story().addPage(chapterId);
    story().removePage(pageId);
    expect(db.query('SELECT deleted_at FROM pages WHERE id = ?', [pageId])[0].deleted_at).not.toBeNull();
    restart(db);
    expect(story().pages[pageId]).toBeUndefined();

    const second = story().addPage(chapterId);
    story().removePage(second);
    undoStory(`project:${projectId}`);
    expect(db.query('SELECT deleted_at FROM pages WHERE id = ?', [second])[0].deleted_at).toBeNull();
  });

  it('touches the project on every content change', () => {
    connectTestStorage();
    const { projectId, chapterId } = newStory();
    useStory.setState({ projects: { ...story().projects, [projectId]: { ...story().projects[projectId], updatedAt: 1 } } });
    story().moveScene(chapterId, 0, 0);
    expect(story().projects[projectId].updatedAt).toBeGreaterThan(1);
  });

  it('does not let opening a screen reorder the library', () => {
    connectTestStorage();
    const { projectId } = newStory();
    useStory.setState({ projects: { ...story().projects, [projectId]: { ...story().projects[projectId], updatedAt: 1 } } });
    story().setLastOpened(projectId, { screen: 'Outline' });
    expect(story().projects[projectId].updatedAt).toBe(1);
  });
});

describe('telling the app a story is gone', () => {
  function watchDeletes() {
    const db = connectTestStorage();
    const deleted: string[] = [];
    connectStory(createStoryRepo(db), undefined, id => deleted.push(id));
    return { db, deleted };
  }

  it('fires for a story deleted for good, and not for Trash', () => {
    const { deleted } = watchDeletes();
    const { projectId } = newStory();
    story().trashProject(projectId);
    story().restoreProject(projectId);
    expect(deleted).toEqual([]);
    story().deleteProjectForever(projectId);
    expect(deleted).toEqual([projectId]);
  });

  it('fires for each story the trash purge removes', () => {
    const { deleted } = watchDeletes();
    const first = newStory().projectId;
    const second = newStory().projectId;
    const kept = newStory().projectId;
    story().trashProject(first);
    story().trashProject(second);
    story().purgeTrash(Date.now() + 365 * 24 * 3600 * 1000);
    expect(deleted.sort()).toEqual([first, second].sort());
    expect(story().projects[kept]).toBeDefined();
  });

  it('stays quiet when the whole state is swapped out', () => {
    const { db, deleted } = watchDeletes();
    newStory();
    flushStory();
    connectStory(null, undefined, id => deleted.push(id));
    expect(story().projects).toEqual({});
    connectStory(createStoryRepo(db), undefined, id => deleted.push(id));
    expect(Object.keys(story().projects)).toHaveLength(1);
    expect(deleted).toEqual([]);
  });
});

describe('undo scopes', () => {
  it('merges typing in one scene into one step', () => {
    connectTestStorage();
    const { chapterId } = newStory();
    const sceneId = story().addScene(chapterId);
    story().updateScene(sceneId, { description: 'a' });
    story().updateScene(sceneId, { description: 'ab' });
    story().updateScene(sceneId, { description: 'abc' });
    undoStory(`script:${chapterId}`);
    expect(story().scenes[sceneId].description).toBe('');
    redoStory(`script:${chapterId}`);
    expect(story().scenes[sceneId].description).toBe('abc');
  });

  it('restores effects and height with the layout, which the old app lost', () => {
    connectTestStorage();
    const { chapterId } = newStory();
    const pageId = story().addPage(chapterId, { templateId: 'g2-rows' });
    const [panelId] = collectPanelIds(story().pages[pageId].layout);
    const effect = { id: 'e', panelId, type: 'tone' as const, density: 1, angle: 0, cx: 0, cy: 0, opacity: 1 };
    story().updatePage(pageId, { effects: [effect], height: 900 });
    story().applyTemplate(pageId, 'g1');
    undoStory(`page:${pageId}`);
    expect(story().pages[pageId].effects).toEqual([effect]);
    expect(story().pages[pageId].height).toBe(900);
  });

  it('keeps art revisions moving forward through undo', () => {
    connectTestStorage();
    const { chapterId } = newStory();
    const pageId = story().addPage(chapterId, { templateId: 'g2-rows' });
    story().applyTemplate(pageId, 'g1');
    story().bumpArt(pageId);
    undoStory(`page:${pageId}`);
    expect(story().pages[pageId].artRev).toBe(1);
  });

  it('keeps pages when script undo crosses a project change on the same chapter', () => {
    connectTestStorage();
    const { chapterId } = newStory();
    const sceneId = story().addScene(chapterId);
    const pageId = story().addPage(chapterId);
    undoStory(`script:${chapterId}`);
    expect(story().chapters[chapterId].sceneIds).toEqual([]);
    expect(story().chapters[chapterId].pageIds).toEqual([pageId]);
    redoStory(`script:${chapterId}`);
    expect(story().chapters[chapterId].sceneIds).toEqual([sceneId]);
    expect(story().chapters[chapterId].pageIds).toEqual([pageId]);
  });

  it('keeps scenes when project undo crosses a script change on the same chapter', () => {
    connectTestStorage();
    const { projectId, chapterId } = newStory();
    story().addPage(chapterId);
    const sceneId = story().addScene(chapterId);
    undoStory(`project:${projectId}`);
    expect(story().chapters[chapterId].pageIds).toEqual([]);
    expect(story().chapters[chapterId].sceneIds).toEqual([sceneId]);
  });

  it('counts a group of actions as one step', () => {
    connectTestStorage();
    const { chapterId } = newStory();
    undoable({ undoScope: `script:${chapterId}` }, () => {
      story().addScene(chapterId);
      story().addScene(chapterId);
    });
    expect(useHistory.getState().history[`script:${chapterId}`]?.past).toHaveLength(1);
    undoStory(`script:${chapterId}`);
    expect(story().chapters[chapterId].sceneIds).toEqual([]);
  });

  it('clears script history when removing a character rewrites its blocks', () => {
    connectTestStorage();
    const { projectId, chapterId } = newStory();
    const characterId = story().addCharacter(projectId, { name: 'A' });
    const sceneId = story().addScene(chapterId);
    story().updateScene(sceneId, { blocks: [{ id: 'b', type: 'dialogue', text: 'x', characterId }] });
    story().removeCharacter(characterId);
    expect(useHistory.getState().history[`script:${chapterId}`]).toBeUndefined();
  });

  it('drops the redo stack on a new edit and caps the stack', () => {
    connectTestStorage();
    const { projectId } = newStory();
    for (let i = 0; i < 25; i++) {
      story().addCharacter(projectId);
    }
    expect(useHistory.getState().history[`project:${projectId}`]?.past).toHaveLength(20);
    undoStory(`project:${projectId}`);
    story().addCharacter(projectId);
    expect(useHistory.getState().history[`project:${projectId}`]?.future).toHaveLength(0);
  });
});

describe('art', () => {
  it('has a stroke on disk as soon as it is committed', () => {
    const db = connectTestStorage();
    const { panelId, layerId } = drawablePanel();
    commitStroke(panelId, layerId, stroke());
    restart(db);
    expect(loadArt(panelId)?.layers[0].strokes).toEqual([stroke()]);
    expect(panelHasArt(panelId)).toBe(true);
  });

  it('keeps pressure and tone through the blob format', () => {
    const db = connectTestStorage();
    const { panelId, layerId } = drawablePanel();
    const rich: Stroke = { ...stroke(), points: [1, 2, 0.5, 3, 4, 0.25], pressure: true, tone: { density: 0.5 } };
    commitStroke(panelId, layerId, rich);
    restart(db);
    expect(loadArt(panelId)?.layers[0].strokes[0]).toEqual(rich);
  });

  it('undoes and redoes strokes by moving head, across restarts of the cache', () => {
    connectTestStorage();
    const { panelId, layerId } = drawablePanel();
    commitStroke(panelId, layerId, stroke(1));
    commitStroke(panelId, layerId, stroke(2));
    undoArt(panelId);
    expect(loadArt(panelId)?.layers[0].strokes).toEqual([stroke(1)]);
    redoArt(panelId);
    expect(loadArt(panelId)?.layers[0].strokes).toEqual([stroke(1), stroke(2)]);
  });

  it('overwrites the redo tail when drawing after an undo', () => {
    const db = connectTestStorage();
    const { panelId, layerId } = drawablePanel();
    commitStroke(panelId, layerId, stroke(1));
    commitStroke(panelId, layerId, stroke(2));
    undoArt(panelId);
    commitStroke(panelId, layerId, stroke(3));
    expect(redoArt(panelId)).toBe(false);
    restart(db);
    expect(loadArt(panelId)?.layers[0].strokes).toEqual([stroke(1), stroke(3)]);
  });

  it('undoes a layer rewrite by pointing back at the old generation', () => {
    const db = connectTestStorage();
    const { panelId, layerId } = drawablePanel();
    commitStroke(panelId, layerId, stroke(1));
    rewriteLayer(panelId, layerId, [stroke(9), stroke(8)]);
    expect(loadArt(panelId)?.layers[0].strokes).toHaveLength(2);
    undoArt(panelId);
    expect(loadArt(panelId)?.layers[0].strokes).toEqual([stroke(1)]);
    redoArt(panelId);
    restart(db);
    expect(loadArt(panelId)?.layers[0].strokes).toEqual([stroke(9), stroke(8)]);
  });

  it('restores a removed layer with its strokes', () => {
    const db = connectTestStorage();
    const { panelId, layerId } = drawablePanel();
    commitStroke(panelId, layerId, stroke(1));
    removeLayer(panelId, layerId);
    expect(loadArt(panelId)?.layers).toHaveLength(1);
    undoArt(panelId);
    restart(db);
    const layers = loadArt(panelId)!.layers;
    expect(layers[0].id).toBe(layerId);
    expect(layers[0].strokes).toEqual([stroke(1)]);
  });

  it('puts a restored layer back in its place, on screen and on disk', () => {
    const db = connectTestStorage();
    const { panelId } = drawablePanel();
    const names = () => loadArt(panelId)?.layers.map(layer => layer.name);
    const middle = addLayer(panelId, 'Middle');
    addLayer(panelId, 'Top');
    expect(names()).toEqual(['Sketch', 'Ink', 'Middle', 'Top']);
    removeLayer(panelId, middle);
    undoArt(panelId);
    expect(names()).toEqual(['Sketch', 'Ink', 'Middle', 'Top']);
    restart(db);
    expect(names()).toEqual(['Sketch', 'Ink', 'Middle', 'Top']);
  });

  it('keeps the stack order when a layer is added after a removal', () => {
    const db = connectTestStorage();
    const { panelId, layerId } = drawablePanel();
    const names = () => loadArt(panelId)?.layers.map(layer => layer.name);
    removeLayer(panelId, layerId);
    addLayer(panelId, 'New');
    restart(db);
    expect(names()).toEqual(['Ink', 'New']);
  });

  it('undoes adding a layer and editing one', () => {
    connectTestStorage();
    const { panelId, layerId } = drawablePanel();
    editLayer(panelId, layerId, { opacity: 0.5 });
    const added = addLayer(panelId, 'New');
    undoArt(panelId);
    expect(loadArt(panelId)?.layers.some(layer => layer.id === added)).toBe(false);
    undoArt(panelId);
    expect(loadArt(panelId)?.layers[0].opacity).toBe(1);
  });

  it('accepts the same layer id in two panels, which old files contain', () => {
    connectTestStorage();
    const layer = { id: 'same', name: 'Ink', visible: true, opacity: 1, locked: false, strokes: [stroke()] };
    saveArt('p1', { layers: [layer], activeLayerId: 'same' });
    saveArt('p2', { layers: [layer], activeLayerId: 'same' });
    expect(loadArt('p1')?.layers[0].strokes).toHaveLength(1);
    expect(loadArt('p2')?.layers[0].strokes).toHaveLength(1);
    expect(loadArt('p1')?.layers[0].id).not.toBe(loadArt('p2')?.layers[0].id);
    expect(loadArt('p2')?.activeLayerId).toBe(loadArt('p2')?.layers[0].id);
  });
});

describe('importing a story', () => {
  const rows = (id: string, chapterId: string) => ({
    projects: { [id]: { id, title: 'Imported', acts: [] } as never },
    chapters: {},
    scenes: { [`${id}-s`]: { id: `${id}-s`, chapterId, description: '', blocks: [] } },
  });

  it('leaves nothing behind and keeps saving when the rows break a foreign key', () => {
    const db = connectTestStorage();
    const { chapterId } = newStory();
    expect(() => importEntities(rows('bad', 'no-such-chapter'))).toThrow();
    expect(story().projects.bad).toBeUndefined();
    const sceneId = story().addScene(chapterId, { description: 'still saved' });
    flushStory();
    restart(db);
    expect(story().scenes[sceneId].description).toBe('still saved');
    expect(story().projects.bad).toBeUndefined();
  });

  it('writes valid rows before showing them', () => {
    const db = connectTestStorage();
    const { chapterId } = newStory();
    importEntities(rows('good', chapterId));
    restart(db);
    expect(story().projects.good.title).toBe('Imported');
  });
});

describe('plans larger than the template', () => {
  it('keeps every block of a 7 panel plan on a webtoon strip', () => {
    connectTestStorage();
    const projectId = story().createProject({
      title: 'W',
      genres: [],
      logline: '',
      format: 'webtoon',
      pageSize: 'B5',
      style: 'shounen',
      color: false,
    });
    const chapterId = story().projects[projectId].acts[0].chapterIds[0];
    const panels = Array.from({ length: 7 }, (_, index) => ({ description: `p${index}`, blockIds: [`b${index}`] }));
    const pageId = story().addPage(chapterId, { plan: { panels } as never });
    const kept = Object.values(story().pages[pageId].panels).flatMap(panel => panel.blockIds);
    expect(kept.sort()).toEqual(['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
  });
});

describe('migrations', () => {
  it('stops at the last good version when a step fails', () => {
    const db = createNodeDb();
    migrate(db);
    const top = userVersion(db);
    expect(top).toBe(MIGRATIONS[MIGRATIONS.length - 1].version);
    const broken = [
      {
        version: top + 1,
        up: () => {
          db.run('CREATE TABLE half_done (id TEXT)');
          throw new Error('boom');
        },
      },
    ];
    expect(() => migrate(db, broken)).toThrow('boom');
    expect(userVersion(db)).toBe(top);
    expect(db.query("SELECT name FROM sqlite_master WHERE name = 'half_done'")).toEqual([]);
  });

  it('does nothing the second time', () => {
    const db = createNodeDb();
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
  });
});

describe('.mangaka files', () => {
  const minimal = {
    version: 1,
    project: { id: 'p', title: 'T', acts: [] },
    chapters: [],
    scenes: [],
    characters: [],
    relations: [],
    world: [],
    pages: [],
  };
  const withArt = (points: number[], pressure?: boolean) =>
    JSON.stringify({
      ...minimal,
      art: {
        a: {
          layers: [
            {
              id: 'l',
              name: 'Ink',
              visible: true,
              opacity: 1,
              locked: false,
              strokes: [{ tool: 'gpen', color: '#000', size: 1, opacity: 1, points, pressure }],
            },
          ],
        },
      },
    });

  it('accepts a well formed file', () => {
    expect(parseProjectBundle(withArt([1, 2, 3, 4])).project.id).toBe('p');
    expect(Object.keys(parseProjectBundle(withArt([1, 2, 3], true)).art)).toEqual(['a']);
  });

  it('rejects points that do not match the stride', () => {
    expect(() => parseProjectBundle(withArt([1, 2, 3]))).toThrow("isn't a Mangaka project");
    expect(() => parseProjectBundle(withArt([1, 2, 3, 4], true))).toThrow("isn't a Mangaka project");
  });

  it('drops rows whose chapter is missing instead of failing later', () => {
    const json = JSON.stringify({
      ...minimal,
      chapters: [{ id: 'c' }],
      scenes: [
        { id: 'keep', chapterId: 'c' },
        { id: 'lost', chapterId: 'gone' },
      ],
      pages: [{ id: 'lost', chapterId: 'gone' }],
    });
    const bundle = parseProjectBundle(json);
    expect(bundle.scenes.map(scene => scene.id)).toEqual(['keep']);
    expect(bundle.pages).toEqual([]);
  });

  it('rejects a broken layout tree below the top level', () => {
    const json = JSON.stringify({
      ...minimal,
      pages: [{ id: 'g', chapterId: 'c', layout: { kind: 'split', id: 's', dir: 'x', t0: 0, t1: 1 } }],
    });
    expect(() => parseProjectBundle(json)).toThrow("isn't a Mangaka project");
  });
});

describe('canvas layer operations', () => {
  const panelId = 'canvas-panel';
  const names = () => (loadArt(panelId)?.layers ?? []).map(layer => layer.name);

  let db: ReturnType<typeof connectTestStorage>;

  beforeEach(() => {
    db = connectTestStorage();
    saveArt(panelId, { layers: [newLayer('A'), newLayer('B'), newLayer('C')] });
  });

  it('inserts a layer in the middle and undoes it in one step', () => {
    const id = addLayer(panelId, 'New', {}, 1);
    expect(names()).toEqual(['A', 'New', 'B', 'C']);
    expect(loadArt(panelId)?.activeLayerId).toBe(id);
    restart(db);
    expect(names()).toEqual(['A', 'New', 'B', 'C']);
  });

  it('undoes a middle insert with the order intact', () => {
    addLayer(panelId, 'New', {}, 1);
    expect(undoArt(panelId)).toBe(true);
    expect(names()).toEqual(['A', 'B', 'C']);
    expect(redoArt(panelId)).toBe(true);
    expect(names()).toEqual(['A', 'New', 'B', 'C']);
  });

  it('merges two layers as one undo step', () => {
    const [a, b] = loadArt(panelId)?.layers ?? [];
    commitStroke(panelId, a.id, stroke(1));
    commitStroke(panelId, b.id, stroke(2));
    const lower = loadArt(panelId)?.layers[0];
    const upper = loadArt(panelId)?.layers[1];
    mergeLayers(panelId, b.id, a.id, { strokes: [...(lower?.strokes ?? []), ...(upper?.strokes ?? [])] });
    expect(names()).toEqual(['A', 'C']);
    expect(loadArt(panelId)?.layers[0].strokes).toHaveLength(2);
    expect(undoArt(panelId)).toBe(true);
    expect(names()).toEqual(['A', 'B', 'C']);
    expect(loadArt(panelId)?.layers[0].strokes).toHaveLength(1);
    expect(loadArt(panelId)?.layers[1].strokes).toHaveLength(1);
  });
});
