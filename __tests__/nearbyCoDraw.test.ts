import { IdMap, layerFor, localCopyOf, onlyAppended, pageBundle, parsePage, readCoDrawMeta } from '../src/core/nearby/codraw';
import { createLoopbackPhones } from '../src/core/nearby/loopback';
import { collectPanelIds } from '../src/core/layout/layout';
import type { ID, Stroke } from '../src/core/model/types';
import { CoDrawSession } from '../src/features/nearby/codraw/coDrawSession';
import { canUndoArt, commitStroke, emptyArt, exportArt, loadArt, saveArt, undoArt } from '../src/state/artStore';
import { useStory } from '../src/state/useStory';

function line(x: number): Stroke {
  return { tool: 'gpen', color: '#000000', size: 4, opacity: 1, points: [x, 10, x + 5, 20] };
}

function makePage(): { pageId: ID; panels: ID[] } {
  const story = useStory.getState();
  const projectId = story.createProject({
    title: 'Mai story',
    genres: [],
    logline: '',
    format: 'manga',
    pageSize: 'B5',
    style: 'slice',
    color: false,
  });
  const chapterId = useStory.getState().projects[projectId].acts[0].chapterIds[0];
  const pageId = useStory.getState().addPage(chapterId, { templateId: 'g2-rows' });
  return { pageId, panels: collectPanelIds(useStory.getState().pages[pageId].layout) };
}

const layerNamed = (panelId: ID, name: string) => loadArt(panelId)?.layers.find(layer => layer.name === name);

describe('co-draw page data', () => {
  it('copies one page with fresh ids and maps the panels', () => {
    const { pageId, panels } = makePage();
    const art = saveArt(panels[0], emptyArt());
    commitStroke(panels[0], art.layers[0].id, line(1));
    const bundle = pageBundle(useStory.getState(), pageId, exportArt)!;
    const parsed = parsePage(JSON.stringify(bundle))!;
    const copy = localCopyOf(parsed);
    expect(copy.pageId).not.toBe(pageId);
    expect(Object.keys(copy.panels).sort()).toEqual([...panels].sort());
    expect(copy.bundle.art[copy.panels[panels[0]]]?.layers.some(layer => layer.strokes.length === 1)).toBe(true);
    expect(parsePage('{"version":1}')).toBeNull();
  });

  it('reads only well-formed meta and spots an append', () => {
    expect(readCoDrawMeta({ codraw: 'layer', pageId: 'p', panelId: 'a', layerKey: 'k' })).toMatchObject({ codraw: 'layer' });
    expect(readCoDrawMeta({ codraw: 'layer', pageId: 'p' })).toBeNull();
    const a = line(1);
    const b = line(2);
    expect(onlyAppended([a], [a, b])).toBe(true);
    expect(onlyAppended([a, b], [a])).toBe(false);
    expect(onlyAppended([a], [line(1)])).toBe(false);
  });

  it('finds a layer by key, then by name', () => {
    const art = { layers: [{ id: 'L1', name: 'Ken', visible: true, opacity: 1, locked: false, strokes: [] }] };
    expect(layerFor(art, 'L1', 'x')).toBe('L1');
    expect(layerFor(art, 'gone', 'Ken')).toBe('L1');
    expect(layerFor(art, undefined, 'Lan')).toBeNull();
    const map = new IdMap();
    map.set('h', 'l');
    expect([map.local('h'), map.host('l')]).toEqual(['l', 'h']);
  });
});

describe('co-draw on three phones', () => {
  it('routes strokes to the sender layer, keeps undo to your own strokes, and shares the page', async () => {
    const { phones, flush } = createLoopbackPhones(3);
    const [host, ken, lan] = phones;
    const address = await host.getState().hostRoom('Mai');
    await ken.getState().joinRoom(address, 'Ken');
    await flush();
    const sessions = phones.map(phone => new CoDrawSession(phone).start());
    const { pageId, panels } = makePage();
    await sessions[0].host(pageId);
    await flush();

    const kenView = sessions[1].getSnapshot();
    expect(kenView.hostPageId).toBe(pageId);
    expect(kenView.pageId).not.toBe(pageId);
    expect(useStory.getState().projects[kenView.projectId!].title).toBe('Mai story (2)');
    const kenPanel = collectPanelIds(useStory.getState().pages[kenView.pageId!].layout)[0];

    // Ken draws on his own layer: it lands in a layer named Ken on the host, outside the host's undo.
    const kenLayer = sessions[1].enterPanel(kenPanel)!;
    expect(loadArt(kenPanel)?.activeLayerId).toBe(kenLayer);
    commitStroke(kenPanel, kenLayer, line(1));
    await flush();
    expect(layerNamed(panels[0], 'Ken')?.strokes).toHaveLength(1);
    expect(layerNamed(panels[0], 'Ken')?.locked).toBe(true);
    expect(canUndoArt(panels[0])).toBe(false);

    // Mai draws too; Ken's next stroke arrives; Mai's undo takes back only her own stroke.
    const maiLayer = sessions[0].enterPanel(panels[0])!;
    commitStroke(panels[0], maiLayer, line(50));
    commitStroke(kenPanel, kenLayer, line(2));
    await flush();
    expect(layerNamed(panels[0], 'Ken')?.strokes).toHaveLength(2);
    expect(undoArt(panels[0])).toBe(true);
    expect(layerNamed(panels[0], 'Mai')?.strokes).toHaveLength(0);
    expect(layerNamed(panels[0], 'Ken')?.strokes).toHaveLength(2);
    expect(canUndoArt(panels[0])).toBe(false);
    // Mai's stroke and its undo reached Ken as a whole layer.
    await flush();
    expect(layerNamed(kenPanel, 'Mai')?.strokes).toHaveLength(0);

    // Ken undoes: his layer goes out whole and every copy follows.
    expect(undoArt(kenPanel)).toBe(true);
    await flush();
    expect(layerNamed(panels[0], 'Ken')?.strokes).toHaveLength(1);

    // The host sends the page again while Ken's canvas is open: his next stroke still goes out.
    await sessions[0].host(pageId);
    await flush();
    const refreshedLayer = loadArt(kenPanel)!.activeLayerId!;
    expect(loadArt(kenPanel)!.layers.find(layer => layer.id === refreshedLayer)?.name).toBe('Ken');
    commitStroke(kenPanel, refreshedLayer, line(3));
    await flush();
    expect(layerNamed(panels[0], 'Ken')?.strokes).toHaveLength(2);

    // Lan joins late and gets the page as it is now, Ken's strokes included.
    await lan.getState().joinRoom(address, 'Lan');
    await flush();
    await flush();
    const lanView = sessions[2].getSnapshot();
    expect(lanView.pageId).toBeTruthy();
    const lanPanel = collectPanelIds(useStory.getState().pages[lanView.pageId!].layout)[0];
    expect(layerNamed(lanPanel, 'Ken')?.strokes).toHaveLength(2);

    // The host ends: everyone keeps their copy, marked as finished.
    await sessions[0].end();
    await flush();
    expect(sessions[1].getSnapshot().ended).toBe(true);
    expect(sessions[2].getSnapshot().ended).toBe(true);
    expect(useStory.getState().pages[lanView.pageId!]).toBeTruthy();

    sessions.forEach(session => session.stop());
    phones.forEach(phone => phone.getState().leaveRoom());
  });
});
