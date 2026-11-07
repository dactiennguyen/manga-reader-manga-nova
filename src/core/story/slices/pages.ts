import {
  DEFAULT_GUTTER_H,
  DEFAULT_GUTTER_V,
  TEMPLATES,
  WEBTOON_DEFAULT_H,
  buildTemplate,
  collectPanelIds,
  panelOrder,
} from '../../layout/layout';
import type { ID, LayoutNode, Page, Panel } from '../../model/types';
import { uid } from '../../util/id';
import { moveItem, omit, touchProject } from './helpers';
import { newPanel, panelsFromPlan } from './panels';
import type { PageActions, StoryArt, StoryGet, StorySet } from './types';

export function createPageActions(set: StorySet, get: StoryGet, art: StoryArt): PageActions {
  return {
    addPage: (chapterId, init = {}) => {
      const pageId = uid();
      set(state => {
        const chapter = state.chapters[chapterId];
        const project = chapter ? state.projects[chapter.projectId] : undefined;
        if (!chapter || !project) {
          return state;
        }
        const now = Date.now();
        const { layout, panels } = panelsFromPlan(project.format, init.plan, init.templateId);
        const page: Page = {
          id: pageId,
          chapterId,
          layout,
          panels,
          gutterH: DEFAULT_GUTTER_H,
          gutterV: DEFAULT_GUTTER_V,
          height: project.format === 'webtoon' ? init.height ?? WEBTOON_DEFAULT_H : undefined,
          done: false,
          bubbles: [],
          effects: [],
          artRev: 0,
          updatedAt: now,
        };
        const pageIds = [...chapter.pageIds];
        pageIds.splice(init.index ?? pageIds.length, 0, pageId);
        return {
          pages: { ...state.pages, [pageId]: page },
          chapters: { ...state.chapters, [chapterId]: { ...chapter, pageIds, updatedAt: now } },
          projects: touchProject(state.projects, project.id, now),
        };
      });
      return pageId;
    },

    updatePage: (pageId, patch) =>
      set(state => {
        const page = state.pages[pageId];
        if (!page) {
          return state;
        }
        const now = Date.now();
        const next: Page = { ...page, ...patch, updatedAt: now };
        if (patch.layout !== undefined || patch.panels !== undefined) {
          const alive = new Set(collectPanelIds(next.layout));
          const panels: Record<ID, Panel> = {};
          for (const id of alive) {
            panels[id] = next.panels[id] ?? newPanel(id);
          }
          next.panels = panels;
          next.effects = next.effects.filter(effect => alive.has(effect.panelId));
          if (next.order && !(next.order.length === alive.size && next.order.every(id => alive.has(id)))) {
            next.order = undefined;
          }
        }
        const projectId = state.chapters[page.chapterId]?.projectId;
        return {
          pages: { ...state.pages, [pageId]: next },
          projects: touchProject(state.projects, projectId, now),
        };
      }),

    updatePanel: (pageId, panelId, patch) =>
      set(state => {
        const page = state.pages[pageId];
        const panel = page?.panels[panelId];
        if (!page || !panel) {
          return state;
        }
        return {
          pages: {
            ...state.pages,
            [pageId]: {
              ...page,
              panels: { ...page.panels, [panelId]: { ...panel, ...patch } },
              updatedAt: Date.now(),
            },
          },
        };
      }),

    applyTemplate: (pageId, templateId) => {
      const state = get();
      const page = state.pages[pageId];
      const project = page ? state.projects[state.chapters[page.chapterId]?.projectId] : undefined;
      const template = TEMPLATES.find(t => t.id === templateId);
      if (!page || !project || !template) {
        return;
      }
      const rtl = project.format === 'manga';
      const existing = panelOrder(page, rtl);
      const built = buildTemplate(template, uid);
      const slots = panelOrder({ layout: built.layout }, rtl);
      const remap = new Map<ID, ID>();
      slots.forEach((slotId, index) => {
        if (existing[index]) {
          remap.set(slotId, existing[index]);
        }
      });
      const rename = (node: LayoutNode): LayoutNode =>
        node.kind === 'panel'
          ? { kind: 'panel', id: remap.get(node.id) ?? node.id }
          : { ...node, a: rename(node.a), b: rename(node.b) };
      const panels: Record<ID, Panel> = {};
      slots.forEach(slotId => {
        const id = remap.get(slotId) ?? slotId;
        panels[id] = page.panels[id] ?? newPanel(id, { bleed: built.bleedIds.includes(slotId) });
      });
      state.updatePage(pageId, { layout: rename(built.layout), panels, order: undefined });
    },

    bumpArt: pageId =>
      set(state => {
        const page = state.pages[pageId];
        if (!page) {
          return state;
        }
        const now = Date.now();
        const projectId = state.chapters[page.chapterId]?.projectId;
        return {
          pages: { ...state.pages, [pageId]: { ...page, artRev: page.artRev + 1, updatedAt: now } },
          projects: touchProject(state.projects, projectId, now),
        };
      }),

    movePage: (chapterId, from, to) =>
      set(state => {
        const chapter = state.chapters[chapterId];
        if (!chapter) {
          return state;
        }
        return {
          chapters: {
            ...state.chapters,
            [chapterId]: { ...chapter, pageIds: moveItem(chapter.pageIds, from, to), updatedAt: Date.now() },
          },
        };
      }),

    duplicatePage: pageId => {
      const state = get();
      const source = state.pages[pageId];
      const chapter = source ? state.chapters[source.chapterId] : undefined;
      if (!source || !chapter) {
        return null;
      }
      const idMap = new Map<ID, ID>();
      const mapId = (id: ID) => {
        if (!idMap.has(id)) {
          idMap.set(id, uid());
        }
        return idMap.get(id)!;
      };
      const cloneNode = (node: LayoutNode): LayoutNode =>
        node.kind === 'panel'
          ? { kind: 'panel', id: mapId(node.id) }
          : { ...node, id: uid(), a: cloneNode(node.a), b: cloneNode(node.b) };
      const layout = source.layout ? cloneNode(source.layout) : null;
      const panels: Record<ID, Panel> = {};
      for (const panel of Object.values(source.panels)) {
        const id = mapId(panel.id);
        panels[id] = { ...panel, id, blockIds: [] };
        art.copyArt(panel.id, id);
      }
      const newPageId = uid();
      const now = Date.now();
      const page: Page = {
        ...source,
        id: newPageId,
        layout,
        panels,
        order: source.order?.map(mapId),
        done: false,
        flag: undefined,
        bubbles: source.bubbles.map(bubble => ({ ...bubble, id: uid(), blockId: undefined })),
        effects: source.effects.map(effect => ({ ...effect, id: uid(), panelId: mapId(effect.panelId) })),
        artRev: 0,
        updatedAt: now,
      };
      const pageIds = [...chapter.pageIds];
      pageIds.splice(pageIds.indexOf(pageId) + 1, 0, newPageId);
      set(current => ({
        pages: { ...current.pages, [newPageId]: page },
        chapters: { ...current.chapters, [chapter.id]: { ...current.chapters[chapter.id], pageIds, updatedAt: now } },
      }));
      return newPageId;
    },

    removePage: pageId =>
      set(state => {
        const page = state.pages[pageId];
        if (!page) {
          return state;
        }
        const chapter = state.chapters[page.chapterId];
        return {
          pages: omit(state.pages, [pageId]),
          chapters: chapter
            ? {
                ...state.chapters,
                [chapter.id]: {
                  ...chapter,
                  pageIds: chapter.pageIds.filter(id => id !== pageId),
                  updatedAt: Date.now(),
                },
              }
            : state.chapters,
        };
      }),

    applyPagination: (chapterId, plans, mode) => {
      const chapter = get().chapters[chapterId];
      if (!chapter) {
        return [];
      }
      if (mode === 'replace') {
        [...chapter.pageIds].forEach(id => get().removePage(id));
      }
      const ids = plans.map(plan => get().addPage(chapterId, { plan }));
      set(state => {
        const current = state.chapters[chapterId];
        return current
          ? { chapters: { ...state.chapters, [chapterId]: { ...current, paginatedAt: Date.now() } } }
          : state;
      });
      return ids;
    },
  };
}
