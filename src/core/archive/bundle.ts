import type {
  Chapter,
  Character,
  ID,
  LayoutNode,
  Page,
  Panel,
  PanelArt,
  Project,
  Relation,
  Scene,
  StoryData,
  WorldEntry,
} from '../model/types';
import { uid } from '../util/id';

export const ARCHIVE_EXTENSION = 'mangaka';

export type ProjectBundle = {
  version: 1;
  app: 'mangaka';
  exportedAt: number;
  project: Project;
  chapters: Chapter[];
  scenes: Scene[];
  characters: Character[];
  relations: Relation[];
  world: WorldEntry[];
  pages: Page[];
  art: Record<ID, PanelArt>;
};

type PathMapper = (path: string) => string | undefined;

function collectLayoutPanelIds(node: LayoutNode | null, out: ID[]): void {
  if (!node) {
    return;
  }
  if (node.kind === 'panel') {
    out.push(node.id);
    return;
  }
  collectLayoutPanelIds(node.a, out);
  collectLayoutPanelIds(node.b, out);
}

export function buildProjectBundle(
  state: StoryData,
  projectId: ID,
  exportArt: (panelIds: ID[]) => Record<ID, PanelArt>,
): ProjectBundle | null {
  const project = state.projects[projectId];
  if (!project) {
    return null;
  }
  const chapters = Object.values(state.chapters).filter(chapter => chapter.projectId === projectId);
  const chapterIds = new Set(chapters.map(chapter => chapter.id));
  const scenes = Object.values(state.scenes).filter(scene => chapterIds.has(scene.chapterId));
  const pages = Object.values(state.pages).filter(page => chapterIds.has(page.chapterId));
  const panelIds: ID[] = [];
  for (const page of pages) {
    const ids = Object.keys(page.panels);
    collectLayoutPanelIds(page.layout, ids);
    panelIds.push(...ids);
  }
  return {
    version: 1,
    app: 'mangaka',
    exportedAt: Date.now(),
    project,
    chapters,
    scenes,
    characters: Object.values(state.characters).filter(character => character.projectId === projectId),
    relations: Object.values(state.relations).filter(relation => relation.projectId === projectId),
    world: Object.values(state.world).filter(entry => entry.projectId === projectId),
    pages,
    art: exportArt([...new Set(panelIds)]),
  };
}

export function mapBundleImages(bundle: ProjectBundle, mapPath: PathMapper): ProjectBundle {
  const optional = (path: string | undefined) => (path ? mapPath(path) : undefined);
  const art: Record<ID, PanelArt> = {};
  for (const [panelId, panelArt] of Object.entries(bundle.art)) {
    art[panelId] = {
      ...panelArt,
      layers: panelArt.layers.map(layer => {
        if (!layer.image) {
          return layer;
        }
        const uri = mapPath(layer.image.uri);
        const { image, ...rest } = layer;
        return uri ? { ...rest, image: { ...image, uri } } : rest;
      }),
    };
  }
  return {
    ...bundle,
    project: { ...bundle.project, coverUri: optional(bundle.project.coverUri) },
    characters: bundle.characters.map(character => {
      const expressions: Character['sheet']['expressions'] = {};
      for (const [name, path] of Object.entries(character.sheet?.expressions ?? {})) {
        const mapped = optional(path);
        if (mapped) {
          expressions[name as keyof typeof expressions] = mapped;
        }
      }
      return {
        ...character,
        sheet: { face: optional(character.sheet?.face), body: optional(character.sheet?.body), expressions },
      };
    }),
    world: bundle.world.map(entry => ({
      ...entry,
      images: (entry.images ?? []).map(mapPath).filter((path): path is string => !!path),
    })),
    art,
  };
}

function remapLayout(node: LayoutNode | null, map: (id: ID) => ID): LayoutNode | null {
  if (!node) {
    return null;
  }
  if (node.kind === 'panel') {
    return { kind: 'panel', id: map(node.id) };
  }
  return {
    ...node,
    id: map(node.id),
    a: remapLayout(node.a, map) as LayoutNode,
    b: remapLayout(node.b, map) as LayoutNode,
  };
}

export function remapBundleIds(bundle: ProjectBundle, newId: () => ID = uid): ProjectBundle {
  const table = new Map<ID, ID>();
  const map = (id: ID): ID => {
    let next = table.get(id);
    if (!next) {
      next = newId();
      table.set(id, next);
    }
    return next;
  };
  const optional = (id: ID | undefined): ID | undefined => (id ? map(id) : undefined);
  const list = (ids: ID[] | undefined): ID[] => (ids ?? []).map(map);

  const project: Project = {
    ...bundle.project,
    id: map(bundle.project.id),
    acts: (bundle.project.acts ?? []).map(act => ({ ...act, id: map(act.id), chapterIds: list(act.chapterIds) })),
    lastOpened: bundle.project.lastOpened
      ? {
          ...bundle.project.lastOpened,
          chapterId: optional(bundle.project.lastOpened.chapterId),
          pageId: optional(bundle.project.lastOpened.pageId),
          panelId: optional(bundle.project.lastOpened.panelId),
        }
      : undefined,
  };

  const chapters = bundle.chapters.map(chapter => ({
    ...chapter,
    id: map(chapter.id),
    projectId: project.id,
    characterIds: list(chapter.characterIds),
    sceneIds: list(chapter.sceneIds),
    pageIds: list(chapter.pageIds),
  }));

  const scenes = bundle.scenes.map(scene => ({
    ...scene,
    id: map(scene.id),
    chapterId: map(scene.chapterId),
    blocks: (scene.blocks ?? []).map(block => ({
      ...block,
      id: map(block.id),
      characterId: optional(block.characterId),
    })),
  }));

  const characters = bundle.characters.map(character => ({
    ...character,
    id: map(character.id),
    projectId: project.id,
  }));

  const relations = bundle.relations.map(relation => ({
    ...relation,
    id: map(relation.id),
    projectId: project.id,
    a: map(relation.a),
    b: map(relation.b),
  }));

  const world = bundle.world.map(entry => ({
    ...entry,
    id: map(entry.id),
    projectId: project.id,
    characterIds: list(entry.characterIds),
    leaderId: optional(entry.leaderId),
    anchor: entry.anchor === 'before' || entry.anchor === 'after' ? entry.anchor : optional(entry.anchor),
  }));

  const pages = bundle.pages.map(page => {
    const panels: Record<ID, Panel> = {};
    for (const [panelId, panel] of Object.entries(page.panels ?? {})) {
      const id = map(panelId);
      panels[id] = { ...panel, id, blockIds: list(panel.blockIds) };
    }
    return {
      ...page,
      id: map(page.id),
      chapterId: map(page.chapterId),
      layout: remapLayout(page.layout, map),
      panels,
      order: page.order ? list(page.order) : undefined,
      bubbles: (page.bubbles ?? []).map(bubble => ({
        ...bubble,
        id: map(bubble.id),
        blockId: optional(bubble.blockId),
        characterId: optional(bubble.characterId),
      })),
      effects: (page.effects ?? []).map(effect => ({ ...effect, id: map(effect.id), panelId: map(effect.panelId) })),
    };
  });

  const art: Record<ID, PanelArt> = {};
  for (const [panelId, panelArt] of Object.entries(bundle.art ?? {})) {
    art[map(panelId)] = panelArt;
  }

  return { ...bundle, project, chapters, scenes, characters, relations, world, pages, art };
}

export function uniqueTitle(title: string, taken: Iterable<string>): string {
  const names = new Set(taken);
  if (!names.has(title)) {
    return title;
  }
  let n = 2;
  while (names.has(`${title} (${n})`)) {
    n++;
  }
  return `${title} (${n})`;
}
