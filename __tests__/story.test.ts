import { connectTestStorage } from './helpers/storage';
import { loadArt, newLayer, saveArt } from '../src/state/artStore';
import { collectPanelIds } from '../src/core/layout/layout';
import {
  activeProjects,
  chapterIdsOf,
  chapterStatus,
  characterUsage,
  projectProgress,
  projectStatus,
  scriptOutdated,
  trashedProjects,
} from '../src/core/model/selectors';
import type { NewProjectInput } from '../src/state/useStory';
import { redoStory, undoStory, useStory } from '../src/state/useStory';

beforeEach(() => {
  connectTestStorage();
});

const INPUT: NewProjectInput = {
  title: 'The Delivery Boy',
  genres: ['Adventure'],
  logline: '',
  format: 'manga',
  pageSize: 'B5',
  style: 'shounen',
  color: false,
};

const story = () => useStory.getState();

function reset() {
  useStory.setState({ projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} });
}

function stroke() {
  return { tool: 'gpen' as const, color: '#16161A', size: 8, opacity: 1, points: [1, 2, 3, 4] };
}

beforeEach(reset);

describe('projects and chapters', () => {
  it('a new story has three acts and Chapter 1', () => {
    const projectId = story().createProject(INPUT);
    const project = story().projects[projectId];
    expect(project.acts).toHaveLength(3);
    const [chapterId] = chapterIdsOf(project);
    expect(story().chapters[chapterId].title).toBe('Chapter 1');
    expect(projectStatus(story(), projectId)).toBe('draft');
  });

  it('adding, moving and removing chapters keeps the order right', () => {
    const projectId = story().createProject(INPUT);
    const [act1, act2] = story().projects[projectId].acts;
    const second = story().addChapter(projectId, { actId: act1.id });
    const third = story().addChapter(projectId, { actId: act2.id });
    const first = chapterIdsOf(story().projects[projectId])[0];
    expect(chapterIdsOf(story().projects[projectId])).toEqual([first, second, third]);
    expect(story().chapters[third].title).toBe('Chapter 3');

    story().moveChapter(first, act2.id, 99);
    expect(chapterIdsOf(story().projects[projectId])).toEqual([second, third, first]);

    story().removeChapter(third);
    expect(chapterIdsOf(story().projects[projectId])).toEqual([second, first]);
    expect(story().chapters[third]).toBeUndefined();
  });

  it('does not remove an act with chapters unless a target act is given', () => {
    const projectId = story().createProject(INPUT);
    const [act1, act2] = story().projects[projectId].acts;
    story().removeAct(projectId, act1.id);
    expect(story().projects[projectId].acts).toHaveLength(3);
    story().removeAct(projectId, act1.id, act2.id);
    const acts = story().projects[projectId].acts;
    expect(acts).toHaveLength(2);
    expect(acts[0].chapterIds).toHaveLength(1);
  });

  it('trash: soft delete, restore, and purge after 30 days', () => {
    const keep = story().createProject(INPUT);
    const old = story().createProject({ ...INPUT, title: 'Old' });
    story().trashProject(keep);
    story().trashProject(old);
    expect(activeProjects(story())).toHaveLength(0);
    expect(trashedProjects(story())).toHaveLength(2);
    story().restoreProject(keep);
    expect(story().projects[keep].deletedAt).toBeUndefined();

    const chapterId = chapterIdsOf(story().projects[old])[0];
    story().purgeTrash(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(story().projects[old]).toBeUndefined();
    expect(story().chapters[chapterId]).toBeUndefined();
    expect(story().projects[keep]).toBeDefined();
  });
});

describe('script', () => {
  it('editing the script after pagination marks it as outdated', async () => {
    const projectId = story().createProject(INPUT);
    const chapterId = chapterIdsOf(story().projects[projectId])[0];
    const sceneId = story().addScene(chapterId, { blocks: [{ id: 'b1', type: 'action', text: 'Opening' }] });
    expect(chapterStatus(story(), chapterId)).toBe('writing');

    story().applyPagination(chapterId, [{ panels: [{ description: 'Opening', blockIds: ['b1'] }] }], 'append');
    expect(scriptOutdated(story().chapters[chapterId])).toBe(false);
    expect(chapterStatus(story(), chapterId)).toBe('drawing');

    await new Promise<void>(resolve => setTimeout(resolve, 5));
    story().updateScene(sceneId, { blocks: [{ id: 'b1', type: 'action', text: 'Opening, revised' }] });
    expect(scriptOutdated(story().chapters[chapterId])).toBe(true);
  });

  it('collapsing a scene does not count as a script edit', () => {
    const projectId = story().createProject(INPUT);
    const chapterId = chapterIdsOf(story().projects[projectId])[0];
    const sceneId = story().addScene(chapterId);
    const before = story().chapters[chapterId].scriptChangedAt;
    story().updateScene(sceneId, { collapsed: true });
    expect(story().chapters[chapterId].scriptChangedAt).toBe(before);
  });
});

describe('pages and panels', () => {
  function setup() {
    const projectId = story().createProject(INPUT);
    const chapterId = chapterIdsOf(story().projects[projectId])[0];
    return { projectId, chapterId };
  }

  it('creates a page from a plan and assigns descriptions in reading order', () => {
    const { chapterId } = setup();
    const pageId = story().addPage(chapterId, {
      plan: {
        panels: [
          { description: 'one', blockIds: ['a'] },
          { description: 'two', blockIds: ['b'] },
          { description: 'three', blockIds: [] },
        ],
      },
    });
    const page = story().pages[pageId];
    expect(collectPanelIds(page.layout)).toHaveLength(3);
    const described = Object.values(page.panels)
      .map(p => p.description)
      .sort();
    expect(described).toEqual(['one', 'three', 'two']);
  });

  it('changing the template keeps existing panels, and undo brings back surplus panels with their art', () => {
    const { chapterId } = setup();
    const pageId = story().addPage(chapterId, { templateId: 'g3-rows' });
    const before = collectPanelIds(story().pages[pageId].layout);
    for (const id of before) {
      saveArt(id, { layers: [{ ...newLayer('Ink'), strokes: [stroke()] }] });
    }

    story().applyTemplate(pageId, 'g2-rows');
    const after = collectPanelIds(story().pages[pageId].layout);
    expect(after).toEqual(before.slice(0, 2));
    expect(loadArt(before[0])).not.toBeNull();
    // The old app deleted this art here, so undo could not restore it. Art now outlives its panel until GC.
    expect(story().pages[pageId].panels[before[2]]).toBeUndefined();
    expect(undoStory(`page:${pageId}`)).toBe(true);
    expect(collectPanelIds(story().pages[pageId].layout)).toEqual(before);
    expect(loadArt(before[2])?.layers[0].strokes).toHaveLength(1);
    expect(redoStory(`page:${pageId}`)).toBe(true);

    story().applyTemplate(pageId, 'g4-grid');
    const grown = story().pages[pageId];
    expect(Object.keys(grown.panels)).toHaveLength(4);
    expect(before.slice(0, 2).every(id => !!grown.panels[id])).toBe(true);
  });

  it('duplicating a page creates new panels and copies the art', () => {
    const { chapterId } = setup();
    const pageId = story().addPage(chapterId, { templateId: 'g2-rows' });
    const [panelId] = collectPanelIds(story().pages[pageId].layout);
    saveArt(panelId, { layers: [{ ...newLayer('Ink'), strokes: [stroke()] }] });

    const copyId = story().duplicatePage(pageId)!;
    const copy = story().pages[copyId];
    const copyPanels = collectPanelIds(copy.layout);
    expect(copyPanels).toHaveLength(2);
    expect(copyPanels).not.toContain(panelId);
    expect(copyPanels.some(id => loadArt(id)?.layers[0].strokes.length === 1)).toBe(true);
    expect(story().chapters[chapterId].pageIds).toEqual([pageId, copyId]);
  });

  it('removing a page can be undone with its art', () => {
    const { chapterId } = setup();
    const pageId = story().addPage(chapterId, { templateId: 'g1' });
    const [panelId] = collectPanelIds(story().pages[pageId].layout);
    saveArt(panelId, { layers: [{ ...newLayer('Ink'), strokes: [stroke()] }] });
    story().removePage(pageId);
    expect(story().chapters[chapterId].pageIds).toEqual([]);
    expect(story().pages[pageId]).toBeUndefined();
    const projectId = story().chapters[chapterId].projectId;
    expect(undoStory(`project:${projectId}`)).toBe(true);
    expect(story().chapters[chapterId].pageIds).toEqual([pageId]);
    expect(loadArt(panelId)?.layers[0].strokes).toHaveLength(1);
  });

  it('story progress counts pages marked done', () => {
    const { projectId, chapterId } = setup();
    const a = story().addPage(chapterId, { templateId: 'g1' });
    story().addPage(chapterId, { templateId: 'g1' });
    story().updatePage(a, { done: true });
    expect(projectProgress(story(), projectId)).toEqual({ done: 1, total: 2, ratio: 0.5 });
    expect(projectStatus(story(), projectId)).toBe('active');
  });
});

describe('characters', () => {
  it('removing a character clears it from dialogue, bubbles, relations and chapters', () => {
    const projectId = story().createProject(INPUT);
    const chapterId = chapterIdsOf(story().projects[projectId])[0];
    const minh = story().addCharacter(projectId, { name: 'Minh' });
    const tu = story().addCharacter(projectId, { name: 'Mrs. Tu' });
    story().addRelation(projectId, minh, tu, 'neighbor');
    story().updateChapter(chapterId, { characterIds: [minh, tu] });
    const sceneId = story().addScene(chapterId, {
      blocks: [{ id: 'b1', type: 'dialogue', text: 'Hello', characterId: minh, kind: 'speak' }],
    });
    const pageId = story().addPage(chapterId, { templateId: 'g1' });
    story().updatePage(pageId, {
      bubbles: [
        {
          id: 'bb',
          type: 'speak',
          text: 'Hello',
          x: 0,
          y: 0,
          w: 100,
          h: 80,
          rotation: 0,
          tail: null,
          fontSize: 28,
          font: 'hand',
          bold: false,
          characterId: minh,
        },
      ],
    });
    expect(characterUsage(story(), minh)).toEqual({ dialogues: 1, bubbles: 1, chapterIds: [chapterId] });

    story().removeCharacter(minh);
    expect(story().characters[minh]).toBeUndefined();
    expect(Object.keys(story().relations)).toHaveLength(0);
    expect(story().chapters[chapterId].characterIds).toEqual([tu]);
    expect(story().scenes[sceneId].blocks[0].characterId).toBeUndefined();
    expect(story().pages[pageId].bubbles[0].characterId).toBeUndefined();
  });
});

describe('duplicating a story', () => {
  function build() {
    const projectId = story().createProject({ ...INPUT, coverUri: '/img/cover.jpg' });
    const chapterId = chapterIdsOf(story().projects[projectId])[0];
    const minh = story().addCharacter(projectId, {
      name: 'Minh',
      sheet: { face: '/img/face.jpg', expressions: { happy: '/img/happy.jpg' } },
    });
    const tu = story().addCharacter(projectId, { name: 'Mrs. Tu' });
    const relationId = story().addRelation(projectId, minh, tu, 'neighbor');
    const worldId = story().addWorldEntry(projectId, 'faction', {
      title: 'Couriers',
      images: ['/img/world.jpg'],
      characterIds: [minh],
      leaderId: tu,
    });
    story().updateChapter(chapterId, { characterIds: [minh, tu] });
    const sceneId = story().addScene(chapterId, {
      blocks: [{ id: 'b1', type: 'dialogue', text: 'Hello', characterId: minh, kind: 'speak' }],
    });
    const pageId = story().addPage(chapterId, { templateId: 'g2-rows' });
    const [panelId] = collectPanelIds(story().pages[pageId].layout);
    const page = story().pages[pageId];
    story().updatePage(pageId, {
      panels: { ...page.panels, [panelId]: { ...page.panels[panelId], blockIds: ['b1'] } },
      bubbles: [
        {
          id: 'bb',
          type: 'speak',
          text: 'Hello',
          x: 0,
          y: 0,
          w: 100,
          h: 80,
          rotation: 0,
          tail: null,
          fontSize: 28,
          font: 'hand',
          bold: false,
          characterId: minh,
          blockId: 'b1',
        },
      ],
      effects: [{ id: 'fx', panelId, type: 'speed', density: 1, angle: 0, cx: 0, cy: 0, opacity: 1 }],
    });
    saveArt(panelId, {
      layers: [{ ...newLayer('Ink'), strokes: [stroke()], image: { uri: '/img/layer.jpg', x: 0, y: 0, w: 10, h: 10 } }],
    });
    story().setLastOpened(projectId, { screen: 'Canvas', chapterId, pageId, panelId });
    return { projectId, chapterId, minh, tu, relationId, worldId, sceneId, pageId, panelId };
  }

  it('returns null for an unknown story', () => {
    expect(story().duplicateProject('missing')).toBeNull();
  });

  it('copies every entity under fresh ids and leaves the original untouched', () => {
    const source = build();
    const before = JSON.stringify(useStory.getState());
    const sourceArt = JSON.stringify(loadArt(source.panelId));

    const copyId = story().duplicateProject(source.projectId, path => path.replace('/img/', '/copy/'))!;

    expect(JSON.parse(JSON.stringify(story().projects[source.projectId]))).toEqual(
      JSON.parse(before).projects[source.projectId],
    );
    for (const key of ['chapters', 'scenes', 'characters', 'relations', 'world', 'pages'] as const) {
      expect(JSON.parse(JSON.stringify(story()[key]))).toMatchObject(JSON.parse(before)[key]);
    }
    expect(JSON.stringify(loadArt(source.panelId))).toBe(sourceArt);

    const copy = story().projects[copyId];
    expect(copyId).not.toBe(source.projectId);
    expect(copy.title).toBe('The Delivery Boy (copy)');
    expect(copy.coverUri).toBe('/copy/cover.jpg');
    expect(copy.deletedAt).toBeUndefined();
    expect(copy.acts).toHaveLength(3);
    const sourceActIds = story().projects[source.projectId].acts.map(act => act.id);
    copy.acts.forEach(act => expect(sourceActIds).not.toContain(act.id));

    const [chapterId] = chapterIdsOf(copy);
    const chapter = story().chapters[chapterId];
    expect(chapterId).not.toBe(source.chapterId);
    expect(chapter.projectId).toBe(copyId);

    const characters = Object.values(story().characters).filter(character => character.projectId === copyId);
    const minh = characters.find(character => character.name === 'Minh')!;
    const tu = characters.find(character => character.name === 'Mrs. Tu')!;
    expect(characters).toHaveLength(2);
    expect([minh.id, tu.id]).not.toContain(source.minh);
    expect([minh.id, tu.id]).not.toContain(source.tu);
    expect(chapter.characterIds).toEqual([minh.id, tu.id]);
    expect(minh.sheet).toEqual({ face: '/copy/face.jpg', body: undefined, expressions: { happy: '/copy/happy.jpg' } });

    const [relation] = Object.values(story().relations).filter(item => item.projectId === copyId);
    expect(relation.id).not.toBe(source.relationId);
    expect([relation.a, relation.b]).toEqual([minh.id, tu.id]);

    const [entry] = Object.values(story().world).filter(item => item.projectId === copyId);
    expect(entry.id).not.toBe(source.worldId);
    expect(entry.characterIds).toEqual([minh.id]);
    expect(entry.leaderId).toBe(tu.id);
    expect(entry.images).toEqual(['/copy/world.jpg']);

    expect(chapter.sceneIds).toHaveLength(1);
    const scene = story().scenes[chapter.sceneIds[0]];
    expect(scene.id).not.toBe(source.sceneId);
    expect(scene.chapterId).toBe(chapterId);
    const [block] = scene.blocks;
    expect(block.id).not.toBe('b1');
    expect(block.characterId).toBe(minh.id);

    expect(chapter.pageIds).toHaveLength(1);
    const page = story().pages[chapter.pageIds[0]];
    expect(page.id).not.toBe(source.pageId);
    expect(page.chapterId).toBe(chapterId);
    const panelIds = collectPanelIds(page.layout);
    expect(panelIds).toHaveLength(2);
    expect(panelIds).not.toContain(source.panelId);
    expect(Object.keys(page.panels).sort()).toEqual([...panelIds].sort());
    const panel = Object.values(page.panels).find(item => item.blockIds.length > 0)!;
    expect(panel.blockIds).toEqual([block.id]);
    expect(page.bubbles[0].id).not.toBe('bb');
    expect(page.bubbles[0].characterId).toBe(minh.id);
    expect(page.bubbles[0].blockId).toBe(block.id);
    expect(page.effects[0].id).not.toBe('fx');
    expect(page.effects[0].panelId).toBe(panel.id);
    expect(copy.lastOpened).toEqual({ screen: 'Canvas', chapterId, pageId: page.id, panelId: panel.id });

    const art = loadArt(panel.id)!;
    expect(art).not.toBe(loadArt(source.panelId));
    expect(art.layers[0].strokes).toHaveLength(1);
    expect(art.layers[0].strokes).not.toBe(loadArt(source.panelId)!.layers[0].strokes);
    expect(art.layers[0].image?.uri).toBe('/copy/layer.jpg');
  });

  it('drops image references when no file mapper is given so files are never shared', () => {
    const source = build();
    const copyId = story().duplicateProject(source.projectId)!;
    const copy = story().projects[copyId];
    expect(copy.coverUri).toBeUndefined();
    const page = story().pages[story().chapters[chapterIdsOf(copy)[0]].pageIds[0]];
    const withArt = collectPanelIds(page.layout).find(id => loadArt(id));
    expect(loadArt(withArt!)!.layers[0].image).toBeUndefined();
    expect(loadArt(withArt!)!.layers[0].strokes).toHaveLength(1);
    expect(story().projects[source.projectId].coverUri).toBe('/img/cover.jpg');
    expect(loadArt(source.panelId)!.layers[0].image?.uri).toBe('/img/layer.jpg');
  });

  it('deleting the copy keeps the original and its art', () => {
    const source = build();
    const copyId = story().duplicateProject(source.projectId)!;
    story().deleteProjectForever(copyId);
    expect(story().projects[copyId]).toBeUndefined();
    expect(story().projects[source.projectId]).toBeDefined();
    expect(Object.keys(story().chapters)).toHaveLength(1);
    expect(Object.keys(story().characters)).toHaveLength(2);
    expect(Object.keys(story().relations)).toHaveLength(1);
    expect(Object.keys(story().world)).toHaveLength(1);
    expect(Object.keys(story().pages)).toEqual([source.pageId]);
    expect(loadArt(source.panelId)!.layers[0].strokes).toHaveLength(1);
  });
});
