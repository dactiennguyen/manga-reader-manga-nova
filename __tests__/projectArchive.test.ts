import { connectTestStorage } from './helpers/storage';
import { exportArt, loadArt, newLayer, saveArt } from '../src/state/artStore';
import { collectPanelIds } from '../src/core/layout/layout';
import { buildProjectBundle as buildBundle, mapBundleImages, remapBundleIds } from '../src/core/archive/bundle';
import { parseProjectBundle } from '../src/core/archive/parse';
import { chapterIdsOf } from '../src/core/model/selectors';
import { useStory } from '../src/state/useStory';

beforeEach(() => {
  connectTestStorage();
});

const buildProjectBundle = (projectId: string) => buildBundle(useStory.getState(), projectId, exportArt);

const story = () => useStory.getState();

function seed() {
  useStory.setState({ projects: {}, chapters: {}, scenes: {}, characters: {}, relations: {}, world: {}, pages: {} });
  const projectId = story().createProject({
    title: 'The Delivery Boy',
    genres: ['Adventure'],
    logline: '',
    format: 'manga',
    pageSize: 'B5',
    style: 'shounen',
    color: false,
    coverUri: '/data/app/mangaka/images/cover.png',
  });
  const chapterId = chapterIdsOf(story().projects[projectId])[0];
  const minh = story().addCharacter(projectId, {
    name: 'Minh',
    sheet: { face: '/data/app/face.png', expressions: {} },
  });
  const tu = story().addCharacter(projectId, { name: 'Mrs. Tu' });
  story().addRelation(projectId, minh, tu, 'neighbor');
  story().updateChapter(chapterId, { characterIds: [minh] });
  story().addWorldEntry(projectId, 'event', {
    title: 'The fire',
    anchor: chapterId,
    characterIds: [tu],
    leaderId: minh,
  });
  story().addScene(chapterId, {
    blocks: [
      { id: 'block-action', type: 'action', text: 'Minh stops his bike' },
      { id: 'block-line', type: 'dialogue', text: 'Not again…', characterId: minh, kind: 'think' },
    ],
  });
  const [pageId] = story().applyPagination(
    chapterId,
    [
      {
        panels: [
          { description: 'Minh stops his bike', blockIds: ['block-action', 'block-line'] },
          { description: '', blockIds: [] },
        ],
      },
    ],
    'append',
  );
  const [panelId] = collectPanelIds(story().pages[pageId].layout);
  saveArt(panelId, {
    layers: [
      { ...newLayer('Ink'), strokes: [{ tool: 'gpen', color: '#16161A', size: 8, opacity: 1, points: [1, 2, 3, 4] }] },
    ],
  });
  story().updatePage(pageId, {
    order: [...collectPanelIds(story().pages[pageId].layout)].reverse(),
    bubbles: [
      {
        id: 'bubble-1',
        type: 'think',
        text: 'Not again…',
        x: 100,
        y: 100,
        w: 200,
        h: 120,
        rotation: 0,
        tail: null,
        fontSize: 28,
        font: 'hand',
        bold: false,
        characterId: minh,
        blockId: 'block-line',
      },
    ],
    effects: [{ id: 'fx-1', panelId, type: 'speed', density: 0.5, angle: 0, cx: 0.5, cy: 0.5, opacity: 1 }],
  });
  story().setLastOpened(projectId, { screen: 'Canvas', chapterId, pageId, panelId });
  return { projectId, chapterId, pageId, panelId, minh, tu };
}

describe('project archive', () => {
  it('collects every entity and the panel art of a story', () => {
    const { projectId, panelId } = seed();
    const bundle = buildProjectBundle(projectId)!;
    expect(bundle.chapters).toHaveLength(1);
    expect(bundle.scenes).toHaveLength(1);
    expect(bundle.characters).toHaveLength(2);
    expect(bundle.relations).toHaveLength(1);
    expect(bundle.world).toHaveLength(1);
    expect(bundle.pages).toHaveLength(1);
    expect(Object.keys(bundle.art)).toEqual([panelId]);
    expect(buildProjectBundle('missing')).toBeNull();
  });

  it('gives every entity a new id and keeps all references consistent', () => {
    const ids = seed();
    const original = buildProjectBundle(ids.projectId)!;
    const before = JSON.stringify(original);
    let counter = 0;
    const copy = remapBundleIds(original, () => `new${counter++}`);
    expect(JSON.stringify(original)).toBe(before);

    const text = JSON.stringify(copy);
    for (const oldId of [
      ids.projectId,
      ids.chapterId,
      ids.pageId,
      ids.panelId,
      ids.minh,
      ids.tu,
      'block-line',
      'bubble-1',
      'fx-1',
    ]) {
      expect(text).not.toContain(`"${oldId}"`);
    }

    const [chapter] = copy.chapters;
    const [page] = copy.pages;
    const [scene] = copy.scenes;
    const characterIds = copy.characters.map(character => character.id);
    const panelIds = collectPanelIds(page.layout);
    expect(chapter.projectId).toBe(copy.project.id);
    expect(copy.project.acts.flatMap(act => act.chapterIds)).toEqual([chapter.id]);
    expect(chapter.sceneIds).toEqual([scene.id]);
    expect(chapter.pageIds).toEqual([page.id]);
    expect(scene.chapterId).toBe(chapter.id);
    expect(page.chapterId).toBe(chapter.id);
    expect(Object.keys(page.panels).sort()).toEqual([...panelIds].sort());
    expect([...page.order!].sort()).toEqual([...panelIds].sort());
    expect(Object.keys(copy.art)).toHaveLength(1);
    expect(panelIds).toContain(Object.keys(copy.art)[0]);
    expect(panelIds).toContain(page.effects[0].panelId);

    const blockIds = scene.blocks.map(block => block.id);
    const linked = Object.values(page.panels).flatMap(panel => panel.blockIds);
    expect(linked).toEqual(blockIds);
    expect(page.bubbles[0].blockId).toBe(blockIds[1]);
    expect(characterIds).toContain(page.bubbles[0].characterId);
    expect(characterIds).toContain(scene.blocks[1].characterId);
    expect(chapter.characterIds.every(id => characterIds.includes(id))).toBe(true);
    expect(characterIds).toEqual(expect.arrayContaining([copy.relations[0].a, copy.relations[0].b]));
    expect(copy.world[0].anchor).toBe(chapter.id);
    expect(characterIds).toContain(copy.world[0].leaderId);
    expect(copy.project.lastOpened).toMatchObject({ chapterId: chapter.id, pageId: page.id });
    expect(panelIds).toContain(copy.project.lastOpened?.panelId);
  });

  it('rewrites image paths through the mapper and drops unmapped ones', () => {
    const { projectId } = seed();
    const bundle = buildProjectBundle(projectId)!;
    const mapped = mapBundleImages(bundle, path => (path.endsWith('cover.png') ? 'images/cover.png' : undefined));
    expect(mapped.project.coverUri).toBe('images/cover.png');
    expect(mapped.characters.find(character => character.name === 'Minh')?.sheet.face).toBeUndefined();
    expect(bundle.project.coverUri).toBe('/data/app/mangaka/images/cover.png');
  });

  it('keeps language versions and bubble translations through export and import', () => {
    const { projectId, pageId } = seed();
    story().addLanguage(projectId, 'Vietnamese');
    const [first, ...rest] = story().pages[pageId].bubbles;
    story().updatePage(pageId, { bubbles: [{ ...first, translations: { Vietnamese: 'Otra vez no…' } }, ...rest] });
    const bundle = parseProjectBundle(JSON.stringify(buildProjectBundle(projectId)!));
    let counter = 0;
    const copy = remapBundleIds(bundle, () => `lang${counter++}`);
    expect(copy.project.languages).toEqual(['Vietnamese']);
    expect(copy.pages[0].bubbles[0].translations).toEqual({ Vietnamese: 'Otra vez no…' });
    expect(copy.pages[0].bubbles[0].text).toBe('Not again…');
  });

  it('round-trips through JSON and rejects files that are not a story', () => {
    const { projectId } = seed();
    const bundle = buildProjectBundle(projectId)!;
    expect(parseProjectBundle(JSON.stringify(bundle)).project.title).toBe('The Delivery Boy');
    expect(() => parseProjectBundle('not json')).toThrow("isn't a Mangaka project");
    expect(() => parseProjectBundle(JSON.stringify({ version: 1, app: 'other' }))).toThrow("isn't a Mangaka project");
    expect(() => parseProjectBundle(JSON.stringify({ ...bundle, version: 99 }))).toThrow();
  });

  it('keeps art readable after ids change', () => {
    const { projectId, panelId } = seed();
    const copy = remapBundleIds(buildProjectBundle(projectId)!);
    const [newPanelId] = Object.keys(copy.art);
    expect(newPanelId).not.toBe(panelId);
    expect(copy.art[newPanelId].layers[0].strokes).toHaveLength(1);
    expect(loadArt(panelId)?.layers[0].strokes).toHaveLength(1);
  });
});
