/**
 * Dub together: a chapter's bubbles become lines to voice, in the order a reader meets them, each with
 * the role that speaks it. The host hands roles to the people in the room; everyone records their own
 * lines, and the clips come back to the host. It also works alone: the author voices every role.
 */
import { z } from 'zod';

import { computePanels, isRtl, pageSize, type PanelShape, type Rect } from '../layout/layout';
import { blockMapOf } from '../lettering/script';
import type { Bubble, BubbleType, ID, StoryData } from '../model/types';
import { speakableText } from '../studio/tableRead';
import type { DubLine, MemberId } from './types';

/** Narration boxes are one role, voiced by whoever the host picks. Ids from uid() never start with "_". */
export const NARRATOR_ROLE = '_narrator';
/** Speech bubbles with no character set share one role, so nobody's lines are lost. */
export const UNKNOWN_ROLE = '_someone';

/** Sound effects are drawn lettering, not lines anyone says. */
const VOICED: readonly BubbleType[] = ['speak', 'think', 'shout', 'whisper', 'machine', 'narration'];

/** A line in a dub: the shared DubLine plus what the screens need to show and assign it. */
export type DubItem = DubLine & { type: BubbleType; role: string; pageIndex: number };

export type DubSource = Pick<StoryData, 'projects' | 'chapters' | 'scenes' | 'pages'>;

const center = (r: Pick<Rect, 'x' | 'y' | 'w' | 'h'>) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function pointIn(rect: Rect, p: { x: number; y: number }): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

/** The panel a bubble reads with: the one holding its script block, else the one under it, else the nearest. */
function panelIndexOf(bubble: Bubble, shapes: PanelShape[], blockPanel: Map<ID, ID>): number {
  const linked = bubble.blockId ? blockPanel.get(bubble.blockId) : undefined;
  const byBlock = linked ? shapes.findIndex(shape => shape.id === linked) : -1;
  if (byBlock >= 0) {
    return byBlock;
  }
  const c = center(bubble);
  const under = shapes.findIndex(shape => pointIn(shape.bbox, c));
  if (under >= 0) {
    return under;
  }
  let best = shapes.length;
  let bestDistance = Infinity;
  shapes.forEach((shape, index) => {
    const s = center(shape.bbox);
    const distance = (s.x - c.x) ** 2 + (s.y - c.y) ** 2;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * Bubbles inside one panel, read row by row: a bubble joins a row when its middle sits within the height of
 * the row's first bubble. Rows go top to bottom; within a row, right to left in manga, left to right else.
 */
export function readRows<T extends Pick<Bubble, 'x' | 'y' | 'w' | 'h'>>(bubbles: T[], rtl: boolean): T[] {
  const byTop = [...bubbles].sort((a, b) => center(a).y - center(b).y);
  const rows: T[][] = [];
  for (const bubble of byTop) {
    const row = rows[rows.length - 1];
    const first = row?.[0];
    if (first && center(bubble).y <= first.y + first.h) {
      row.push(bubble);
    } else {
      rows.push([bubble]);
    }
  }
  const sign = rtl ? -1 : 1;
  return rows.flatMap(row => row.sort((a, b) => sign * (center(a).x - center(b).x)));
}

/** A page's bubbles in reading order: panel by panel, then row by row. */
export function bubblesInReadingOrder(
  page: StoryData['pages'][ID],
  project: Pick<StoryData['projects'][ID], 'format' | 'pageSize'>,
): Bubble[] {
  const rtl = isRtl(project);
  const shapes = page.layout ? computePanels(page, pageSize(project, page), { rtl }) : [];
  const blockPanel = new Map<ID, ID>();
  Object.entries(page.panels).forEach(([panelId, panel]) => panel.blockIds.forEach(id => blockPanel.set(id, panelId)));
  const groups = new Map<number, Bubble[]>();
  page.bubbles.forEach(bubble => {
    const index = panelIndexOf(bubble, shapes, blockPanel);
    groups.set(index, [...(groups.get(index) ?? []), bubble]);
  });
  return [...groups.keys()].sort((a, b) => a - b).flatMap(index => readRows(groups.get(index) ?? [], rtl));
}

/** The role that speaks a line: its character, the narrator, or "someone". */
export function roleOf(type: BubbleType, characterId: ID | undefined): string {
  if (type === 'narration') {
    return NARRATOR_ROLE;
  }
  return characterId ?? UNKNOWN_ROLE;
}

/** Every voiced bubble of a chapter, page by page in reading order. Empty and sound-effect bubbles are left out. */
export function dubLines(state: DubSource, chapterId: ID): DubItem[] {
  const chapter = state.chapters[chapterId];
  const project = chapter ? state.projects[chapter.projectId] : undefined;
  if (!chapter || !project) {
    return [];
  }
  const blocks = blockMapOf(chapter.sceneIds.map(id => state.scenes[id]));
  const lines: DubItem[] = [];
  chapter.pageIds.forEach((pageId, pageIndex) => {
    const page = state.pages[pageId];
    if (!page) {
      return;
    }
    for (const bubble of bubblesInReadingOrder(page, project)) {
      if (!VOICED.includes(bubble.type) || !speakableText(bubble.text)) {
        continue;
      }
      const characterId =
        bubble.type === 'narration' ? undefined : bubble.characterId ?? (bubble.blockId ? blocks[bubble.blockId]?.characterId : undefined);
      lines.push({
        bubbleId: bubble.id,
        pageId,
        text: bubble.text.trim(),
        characterId,
        type: bubble.type,
        role: roleOf(bubble.type, characterId),
        pageIndex,
      });
    }
  });
  return lines;
}

export type CastEntry = { role: string; characterId?: ID; lines: number };

/** The roles of a dub in the order they first speak, with how many lines each has. */
export function castOf(lines: Pick<DubItem, 'role' | 'characterId'>[]): CastEntry[] {
  const cast = new Map<string, CastEntry>();
  for (const line of lines) {
    const entry = cast.get(line.role);
    if (entry) {
      entry.lines += 1;
    } else {
      cast.set(line.role, { role: line.role, characterId: line.characterId, lines: 1 });
    }
  }
  return [...cast.values()];
}

/**
 * A first deal of roles: the biggest role goes to whoever has the fewest lines so far, so the work is
 * shared fairly. Ties go to the earlier member, which puts the host first. The host changes it freely.
 */
export function autoRoles(cast: CastEntry[], members: MemberId[]): Record<string, MemberId> {
  if (members.length === 0) {
    return {};
  }
  const load = new Map(members.map(id => [id, 0]));
  const roles: Record<string, MemberId> = {};
  [...cast]
    .sort((a, b) => b.lines - a.lines)
    .forEach(entry => {
      let pick = members[0];
      members.forEach(id => {
        if ((load.get(id) ?? 0) < (load.get(pick) ?? 0)) {
          pick = id;
        }
      });
      roles[entry.role] = pick;
      load.set(pick, (load.get(pick) ?? 0) + entry.lines);
    });
  return roles;
}

/** Who voices a role. A role nobody was given, or whose person left, falls to the host so no line is lost. */
export function voiceOf(roles: Record<string, MemberId>, role: string, hostId: MemberId, present?: MemberId[]): MemberId {
  const member = roles[role];
  return member && (!present || present.includes(member)) ? member : hostId;
}

/** The lines one person records. */
export function linesFor<T extends Pick<DubItem, 'role'>>(
  lines: T[],
  roles: Record<string, MemberId>,
  memberId: MemberId,
  hostId: MemberId,
  present?: MemberId[],
): T[] {
  return lines.filter(line => voiceOf(roles, line.role, hostId, present) === memberId);
}

/** Roles from the network: only known roles going to people in the room are kept. */
export function cleanRoles(raw: Record<string, string>, roles: Iterable<string>, members: Iterable<MemberId>): Record<string, MemberId> {
  const known = new Set(roles);
  const present = new Set(members);
  return Object.fromEntries(Object.entries(raw).filter(([role, member]) => known.has(role) && present.has(member)));
}

/** What guests need to record without the story: the lines and the role names. It rides in the room options. */
export type DubScript = {
  chapterId: ID;
  title: string;
  lines: DubItem[];
  /** Display names of the roles, so guests see "Aki" rather than an id. */
  names: Record<string, string>;
};

export const MAX_SCRIPT_LINES = 400;

const scriptSchema = z.object({
  chapterId: z.string().min(1).max(80),
  title: z.string().max(200),
  lines: z
    .array(
      z.object({
        bubbleId: z.string().min(1).max(80),
        pageId: z.string().min(1).max(80),
        text: z.string().max(1000),
        characterId: z.string().max(80).optional(),
        type: z.enum(['speak', 'think', 'shout', 'whisper', 'machine', 'narration', 'sfx']),
        role: z.string().min(1).max(80),
        pageIndex: z.number().int().min(0).max(10000),
      }),
    )
    .max(MAX_SCRIPT_LINES),
  names: z.record(z.string().max(80), z.string().max(80)),
});

/** The room options key the host puts the script under. */
export const SCRIPT_KEY = 'dub';

/** Reads the script out of the room options; null when it is missing or not shaped as expected. */
export function parseScript(options: Record<string, unknown> | undefined): DubScript | null {
  const result = scriptSchema.safeParse(options?.[SCRIPT_KEY]);
  return result.success ? result.data : null;
}

/** Long chapters are cut so the room message stays well inside a line. */
export function scriptOptions(script: DubScript): Record<string, unknown> {
  return { [SCRIPT_KEY]: { ...script, lines: script.lines.slice(0, MAX_SCRIPT_LINES) } };
}
