import { collectGarbage } from '../src/data/gc';
import { collectPanelIds } from '../src/core/layout/layout';
import { LIMITS } from '../src/core/model/constants';
import { commitStroke, emptyArt, loadArt, saveArt, undoArt } from '../src/state/artStore';
import { undoStory, useStory } from '../src/state/useStory';
import { connectTestStorage, restart } from './helpers/storage';

const story = () => useStory.getState();

const DAY = 24 * 60 * 60 * 1000;

function drawnPage() {
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
  const pageId = story().addPage(chapterId, { templateId: 'g2-rows' });
  const panelIds = collectPanelIds(story().pages[pageId].layout);
  for (const panelId of panelIds) {
    const art = saveArt(panelId, emptyArt());
    commitStroke(panelId, art.layers[0].id, {
      tool: 'gpen',
      color: '#000000',
      size: 4,
      opacity: 1,
      points: [1, 2, 3, 4],
    });
  }
  return { projectId, pageId, panelIds };
}

describe('garbage collection dry run', () => {
  it('never reports art a live page points at', () => {
    const db = connectTestStorage();
    drawnPage();
    expect(collectGarbage(db, story(), Date.now()).orphanPanels).toEqual([]);
  });

  it('reports art only once no page points at it, and undo protects it first', () => {
    const db = connectTestStorage();
    const { pageId, panelIds } = drawnPage();
    story().applyTemplate(pageId, 'g1');
    expect(collectGarbage(db, story(), Date.now()).orphanPanels).toEqual([panelIds[1]]);
    undoStory(`page:${pageId}`);
    expect(collectGarbage(db, story(), Date.now()).orphanPanels).toEqual([]);
    expect(loadArt(panelIds[1])?.layers[0].strokes).toHaveLength(1);
  });

  it('changes nothing on disk', () => {
    const db = connectTestStorage();
    const { pageId, panelIds } = drawnPage();
    story().removePage(pageId);
    const count = () => db.query('SELECT COUNT(*) AS n FROM strokes')[0].n;
    const before = count();
    collectGarbage(db, story(), Date.now() + 365 * DAY);
    expect(count()).toBe(before);
    restart(db);
    expect(loadArt(panelIds[0])?.layers[0].strokes).toHaveLength(1);
  });

  it('counts the redo tail as stale without touching it', () => {
    const db = connectTestStorage();
    const { panelIds } = drawnPage();
    undoArt(panelIds[0]);
    expect(collectGarbage(db, story(), Date.now()).staleStrokes).toBe(1);
  });

  it('finds trash past its time limit only', () => {
    const db = connectTestStorage();
    const { projectId } = drawnPage();
    story().trashProject(projectId);
    const now = Date.now();
    expect(collectGarbage(db, story(), now).expiredProjects).toEqual([]);
    expect(collectGarbage(db, story(), now + (LIMITS.trashDays + 1) * DAY).expiredProjects).toEqual([projectId]);
  });

  it('refuses to run for real until phase 7', () => {
    const db = connectTestStorage();
    expect(() => collectGarbage(db, story(), Date.now(), false)).toThrow('phase 7');
  });
});
