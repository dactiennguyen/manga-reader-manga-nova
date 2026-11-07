import { LIMITS } from './constants';
import type { Block, ID, Scene, Shot } from './types';

export type PanelPlan = { description: string; shot?: Shot; blockIds: ID[] };

export type PagePlan = { panels: PanelPlan[] };

function shotFor(index: number, total: number, hasDialogue: boolean): Shot {
  if (index === 0) {
    return 'wide';
  }
  if (index === total - 1 && total > 2) {
    return 'close';
  }
  return hasDialogue ? 'medium' : index % 2 === 0 ? 'medium' : 'close';
}

function panelsOfScene(scene: Scene): { description: string; blocks: Block[] }[] {
  const panels: { description: string; blocks: Block[] }[] = [];
  let setting: Block | null = null;
  let current: { description: string; blocks: Block[] } | null = null;
  const open = (description: string) => {
    current = { description, blocks: setting ? [setting] : [] };
    setting = null;
    panels.push(current);
    return current;
  };
  for (const block of scene.blocks) {
    const text = block.text.trim();
    if (!text) {
      continue;
    }
    if (block.type === 'setting') {
      if (setting && current) {
        (current as { blocks: Block[] }).blocks.push(setting);
      }
      setting = block;
      continue;
    }
    const place: string = setting ? (setting as Block).text.trim() : '';
    if (block.type === 'action') {
      open(place ? `${text} (${place})` : text).blocks.push(block);
      continue;
    }
    const target: { description: string; blocks: Block[] } =
      current && !setting ? current : open(place || scene.description || '');
    const spoken = target.blocks.filter(b => b.type !== 'action' && b.type !== 'setting').length;
    if (spoken >= 3) {
      open(target.description).blocks.push(block);
    } else {
      target.blocks.push(block);
    }
  }
  if (setting) {
    if (current) {
      (current as { blocks: Block[] }).blocks.push(setting);
    } else {
      open((setting as Block).text.trim());
    }
  } else if (!panels.length && scene.description.trim()) {
    panels.push({ description: scene.description.trim(), blocks: [] });
  }
  return panels;
}

export function estimateScenePages(scene: Scene): number {
  const count = scene.blocks.filter(b => b.type !== 'setting' && b.text.trim()).length;
  return count === 0 ? 0 : Math.max(1, Math.ceil(count / LIMITS.blocksPerPage));
}

export function estimatePages(scenes: Scene[]): number {
  return scenes.reduce((sum, scene) => sum + estimateScenePages(scene), 0);
}

export function paginate(scenes: Scene[], options: { pages?: number; skipBlockIds?: Set<ID> } = {}): PagePlan[] {
  const skip = options.skipBlockIds;
  const all: PanelPlan[] = [];
  const sceneBreaks = new Set<number>();
  for (const scene of scenes) {
    const filtered: Scene = skip ? { ...scene, blocks: scene.blocks.filter(b => !skip.has(b.id)) } : scene;
    if (skip && !filtered.blocks.some(b => b.text.trim())) {
      continue;
    }
    const panels = panelsOfScene(filtered);
    if (!panels.length) {
      continue;
    }
    sceneBreaks.add(all.length);
    panels.forEach((panel, index) => {
      all.push({
        description: panel.description,
        shot: shotFor(
          index,
          panels.length,
          panel.blocks.some(b => b.type === 'dialogue'),
        ),
        blockIds: panel.blocks.map(b => b.id),
      });
    });
  }
  if (!all.length) {
    return [];
  }
  const auto = Math.max(1, Math.ceil(all.length / 4.5));
  const pageCount = Math.min(all.length, Math.max(1, Math.round(options.pages ?? auto)));
  const perPage = all.length / pageCount;
  const pages: PagePlan[] = [];
  let start = 0;
  for (let i = 0; i < pageCount; i++) {
    let end = i === pageCount - 1 ? all.length : Math.round(perPage * (i + 1));
    end = Math.max(start + 1, Math.min(end, all.length - (pageCount - 1 - i)));
    if (end - start > 7) {
      end = start + 7;
    }
    for (let k = end - 1; k <= end + 1; k++) {
      if (k > start && k < all.length && sceneBreaks.has(k) && k - start <= 7 && all.length - k >= pageCount - 1 - i) {
        end = k;
        break;
      }
    }
    pages.push({ panels: all.slice(start, end) });
    start = end;
  }
  if (start < all.length) {
    for (let k = start; k < all.length; k += 5) {
      pages.push({ panels: all.slice(k, k + 5) });
    }
  }
  return pages;
}
