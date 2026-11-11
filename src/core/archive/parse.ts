import { z } from 'zod';

import { msg, t } from '../i18n';
import type { ID, PanelArt } from '../model/types';
import type { ProjectBundle } from './bundle';

const INVALID_MESSAGE = msg("This file can't be read or isn't a Manganova project");

const id = z.string().min(1);
const ids = z.array(id).optional();
const entity = z.looseObject({ id });

const layoutNode: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.looseObject({ kind: z.literal('panel'), id }),
    z.looseObject({
      kind: z.literal('split'),
      id,
      dir: z.enum(['h', 'v']),
      t0: z.number(),
      t1: z.number(),
      a: layoutNode,
      b: layoutNode,
    }),
  ]),
);

const stroke = z
  .looseObject({
    tool: z.enum(['gpen', 'pencil', 'brush', 'eraser', 'line', 'rect', 'ellipse', 'fill']),
    color: z.string(),
    size: z.number(),
    opacity: z.number(),
    points: z.array(z.number()),
    pressure: z.boolean().optional(),
  })
  .refine(item => item.points.length % (item.pressure ? 3 : 2) === 0, 'points length does not match its stride');

const layer = z.looseObject({
  id,
  name: z.string(),
  visible: z.boolean(),
  opacity: z.number(),
  locked: z.boolean(),
  strokes: z.array(stroke),
});

const bundle = z.looseObject({
  version: z.literal(1),
  project: z.looseObject({
    id,
    title: z.string(),
    acts: z.array(z.looseObject({ id, title: z.string(), chapterIds: ids })),
  }),
  chapters: z.array(z.looseObject({ id, sceneIds: ids, pageIds: ids, characterIds: ids })),
  scenes: z.array(z.looseObject({ id, chapterId: id, blocks: z.array(entity).optional() })),
  characters: z.array(entity),
  relations: z.array(z.looseObject({ id, a: id, b: id })),
  world: z.array(entity),
  pages: z.array(
    z.looseObject({
      id,
      chapterId: id,
      layout: layoutNode.nullable().optional(),
      panels: z.record(z.string(), entity).optional(),
      bubbles: z.array(entity).optional(),
      effects: z.array(z.looseObject({ id, panelId: id })).optional(),
    }),
  ),
  art: z.record(z.string(), z.looseObject({ layers: z.array(layer) })).optional(),
});

export function parseProjectBundle(json: string): ProjectBundle {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error(t(INVALID_MESSAGE));
  }
  const parsed = bundle.safeParse(data);
  if (!parsed.success) {
    throw new Error(t(INVALID_MESSAGE));
  }
  const art: Record<ID, PanelArt> = {};
  for (const [panelId, value] of Object.entries(parsed.data.art ?? {})) {
    if (panelId !== '__proto__') {
      art[panelId] = value as unknown as PanelArt;
    }
  }
  const story = parsed.data as unknown as ProjectBundle;
  // Rows without a chapter were unreachable in the old app and would break the foreign keys here.
  const chapterIds = new Set(story.chapters.map(chapter => chapter.id));
  return {
    ...story,
    scenes: story.scenes.filter(scene => chapterIds.has(scene.chapterId)),
    pages: story.pages.filter(page => chapterIds.has(page.chapterId)),
    art,
  };
}
