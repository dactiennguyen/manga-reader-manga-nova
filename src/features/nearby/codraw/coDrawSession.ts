/**
 * Drawing one page together, on this phone. Runs for the whole room, not just while the screen is open,
 * so a page or a stroke that arrives during navigation is not lost.
 *
 * Out: this person's own layer is watched; new strokes go out one message each, and any other change to
 * it (undo, clear, move) sends the whole layer again. In: other people's strokes land on their layers
 * through the foreign art calls, so undo on this phone only ever takes back this person's strokes.
 */
import type { StoreApi } from 'zustand';

import type { ProjectBundle } from '../../../core/archive/bundle';
import {
  CURSOR_STALE_MS,
  REACTION_MS,
  cursorDue,
  identityMap,
  isReaction,
  onlyAppended,
  pageBundle,
  parseLayerPayload,
  parsePage,
  readCoDrawMeta,
  type Cursor,
  type IdMap,
} from '../../../core/nearby/codraw';
import { base64ToJson, base64ToText, jsonToBase64 } from '../../../core/nearby/drawPayload';
import type { RoomStoreState } from '../../../core/nearby/room';
import { realClock, type Clock } from '../../../core/nearby/transport';
import type { MemberId, Message, RoomBlob } from '../../../core/nearby/types';
import type { ID, Stroke } from '../../../core/model/types';
import { collectPanelIds } from '../../../core/layout/layout';
import { exportArt, loadArt, subscribeArt } from '../../../state/artStore';
import { useStory } from '../../../state/useStory';
import { LayerBook, importSharedPage, refreshSharedPage } from './coDrawPage';

/** Page thumbnails follow other people's drawing at most this often. */
const THUMB_EVERY_MS = 2000;

export type Reaction = { id: number; member: MemberId; emoji: string; at: number };

export type CoDrawSnapshot = {
  /** The page as the room knows it (the host's id) and as it is stored on this phone. */
  hostPageId: ID | null;
  pageId: ID | null;
  projectId: ID | null;
  /** Other people's pens, by member, in this phone's panel ids. */
  cursors: Record<MemberId, Cursor>;
  reactions: Reaction[];
  /** The host ended the session; the page is kept in the library. */
  ended: boolean;
};

const EMPTY: CoDrawSnapshot = { hostPageId: null, pageId: null, projectId: null, cursors: {}, reactions: [], ended: false };

type RoomStore = Pick<StoreApi<RoomStoreState>, 'getState' | 'subscribe'>;

export class CoDrawSession {
  private snapshot = EMPTY;
  private listeners = new Set<() => void>();
  private offs: (() => void)[] = [];
  private map: IdMap | null = null;
  private layers = new LayerBook();
  private watch: { panelId: ID; layerId: ID; sent: readonly Stroke[] } | null = null;
  private sendingLayer = false;
  private cursorAt = 0;
  private reactionId = 0;
  private members = new Set<MemberId>();
  private thumbDirty = false;
  private thumbTimer: unknown = null;

  constructor(private readonly room: RoomStore, private readonly clock: Clock = realClock) {}

  start(): this {
    const api = this.room.getState();
    this.offs.push(
      api.onMessage('*', (message, from) => this.onMessage(message, from)),
      api.onBlob(blob => {
        this.onBlob(blob).catch(() => {});
      }),
      this.room.subscribe(state => this.onRoom(state)),
      subscribeArt(() => this.checkMine()),
    );
    return this;
  }

  stop(): void {
    this.offs.forEach(off => off());
    this.offs = [];
    this.reset();
  }

  getSnapshot = (): CoDrawSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Host: share this page (from the host's own story) with everyone in the room. */
  async host(pageId: ID): Promise<void> {
    const api = this.room.getState();
    const page = useStory.getState().pages[pageId];
    if (!api.me?.host || !page) {
      return;
    }
    const chapter = useStory.getState().chapters[page.chapterId];
    this.reset();
    this.map = identityMap(collectPanelIds(page.layout));
    this.members = new Set(api.room?.members.map(member => member.id) ?? []);
    this.update({ hostPageId: pageId, pageId, projectId: chapter?.projectId ?? null });
    api.setActivity('codraw', { codraw: { pageId } });
    await this.sendPage(false);
  }

  /** Host: everyone gets the finished page and the session closes; the room stays here until the host leaves. */
  async end(): Promise<void> {
    const api = this.room.getState();
    if (!api.me?.host || !this.snapshot.hostPageId) {
      return;
    }
    await this.sendPage(true);
    api.send({ t: 'codraw.end' });
  }

  /** Opening a panel: this person's layer there, made on first use and active. */
  enterPanel(panelId: ID): ID | null {
    const me = this.room.getState().me;
    if (!me) {
      return null;
    }
    const layerId = this.layers.mine(panelId, me.id, me.name);
    const layer = loadArt(panelId)?.layers.find(item => item.id === layerId);
    this.watch = { panelId, layerId, sent: layer?.strokes ?? [] };
    return layerId;
  }

  leavePanel(): void {
    this.checkMine();
    this.watch = null;
    this.flushThumb();
  }

  cursor(panelId: ID, x: number, y: number, force = false): void {
    const api = this.room.getState();
    const hostPanel = this.map?.host(panelId);
    const now = this.clock.now();
    if (!api.me || !hostPanel || (!force && !cursorDue(this.cursorAt, now))) {
      return;
    }
    this.cursorAt = now;
    api.send({ t: 'codraw.cursor', from: api.me.id, panelId: hostPanel, x, y });
  }

  react(emoji: string): void {
    const me = this.room.getState().me;
    if (me && isReaction(emoji)) {
      this.room.getState().send({ t: 'codraw.react', from: me.id, emoji });
    }
  }

  reset(): void {
    this.map = null;
    this.watch = null;
    this.layers.clear();
    this.members.clear();
    this.flushThumb();
    this.update(EMPTY);
  }

  private update(next: Partial<CoDrawSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach(listener => listener());
  }

  private nameOf(member: MemberId): string {
    return this.room.getState().room?.members.find(item => item.id === member)?.name ?? member;
  }

  private async sendPage(final: boolean, to?: MemberId): Promise<void> {
    const pageId = this.snapshot.hostPageId;
    const bundle = pageId ? pageBundle(useStory.getState(), pageId, exportArt) : null;
    if (!bundle || !pageId) {
      return;
    }
    const data = await jsonToBase64(bundle);
    await this.room.getState().sendBlob('page', data, { codraw: 'page', pageId, final }, to);
  }

  /** Host: someone joined in the middle, so they get the page as it is now. */
  private onRoom(state: RoomStoreState): void {
    if (!state.me?.host || !this.snapshot.hostPageId || state.room?.activity !== 'codraw') {
      return;
    }
    const ids = state.room.members.map(member => member.id);
    const fresh = ids.filter(id => !this.members.has(id));
    this.members = new Set(ids);
    fresh.forEach(id => {
      this.sendPage(false, id).catch(() => {});
    });
  }

  private async onBlob(blob: RoomBlob): Promise<void> {
    const meta = readCoDrawMeta(blob.meta);
    const api = this.room.getState();
    if (blob.kind !== 'page' || !meta || blob.from === api.me?.id) {
      return;
    }
    if (meta.codraw === 'layer') {
      // A layer always belongs to whoever sent it.
      const strokes = parseLayerPayload(await base64ToJson(blob.data));
      const panel = this.map?.local(meta.panelId);
      if (strokes && panel && meta.layerKey === blob.from && meta.pageId === this.snapshot.hostPageId) {
        this.layers.replace(panel, blob.from, this.nameOf(blob.from), strokes);
        this.markThumb();
      }
      return;
    }
    const host = api.room?.members.find(member => member.host);
    const text = host && blob.from === host.id && !api.me?.host ? await base64ToText(blob.data) : null;
    const parsed = text ? parsePage(text) : null;
    if (parsed) {
      this.receivePage(meta.pageId, parsed, meta.final === true);
    }
  }

  private receivePage(hostPageId: ID, parsed: ProjectBundle, final: boolean): void {
    if (this.map && this.snapshot.hostPageId === hostPageId) {
      // The host's copy replaces this one; nothing here is this person's new drawing to send back.
      const open = this.watch?.panelId;
      this.watch = null;
      refreshSharedPage(parsed, this.map);
      this.layers.clear();
      // The canvas stays open over the new art: watch this person's layer in it again (the host's copy
      // has new layer ids), or the strokes they draw next would never leave this phone.
      if (open && !final) {
        this.enterPanel(open);
      }
      this.flushThumb();
      if (final) {
        this.update({ ended: true });
      }
      return;
    }
    const copy = importSharedPage(parsed);
    this.map = copy.map;
    this.layers.clear();
    this.update({ ...EMPTY, hostPageId, pageId: copy.pageId, projectId: copy.projectId, ended: final });
  }

  private onMessage(message: Message, from: MemberId): void {
    const me = this.room.getState().me?.id;
    switch (message.t) {
      case 'codraw.stroke': {
        const { item } = message;
        const panel = this.map?.local(item.panelId);
        // Only into the sender's own layer; our own strokes come back to the host and are skipped.
        if (from === me || !panel || item.layerKey !== from || item.pageId !== this.snapshot.hostPageId) {
          return;
        }
        this.layers.addStroke(panel, from, this.nameOf(from), item.stroke);
        this.markThumb();
        return;
      }
      case 'codraw.cursor': {
        const panelId = this.map?.local(message.panelId);
        if (from === me || !panelId) {
          return;
        }
        const now = this.clock.now();
        const cursors = Object.fromEntries(
          Object.entries(this.snapshot.cursors).filter(([, cursor]) => now - cursor.at < CURSOR_STALE_MS),
        );
        this.update({ cursors: { ...cursors, [from]: { member: from, panelId, x: message.x, y: message.y, at: now } } });
        return;
      }
      case 'codraw.react': {
        if (!isReaction(message.emoji)) {
          return;
        }
        const now = this.clock.now();
        const reactions = this.snapshot.reactions.filter(item => now - item.at < REACTION_MS).slice(-11);
        this.update({ reactions: [...reactions, { id: ++this.reactionId, member: from, emoji: message.emoji, at: now }] });
        return;
      }
      case 'codraw.end':
        if (this.snapshot.hostPageId) {
          this.update({ ended: true });
        }
        return;
      case 'bye': {
        const cursors = { ...this.snapshot.cursors };
        delete cursors[from];
        this.update({ cursors });
        return;
      }
      default:
    }
  }

  /** Sends what changed on this person's layer since the last look. */
  private checkMine(): void {
    const watch = this.watch;
    const api = this.room.getState();
    const hostPanel = watch && this.map?.host(watch.panelId);
    if (!watch || !hostPanel || !api.me || this.sendingLayer) {
      return;
    }
    const layer = loadArt(watch.panelId)?.layers.find(item => item.id === watch.layerId);
    // A layer that is gone was replaced by the host's copy of the page, not emptied by this person.
    const strokes = layer?.strokes;
    if (!strokes || strokes === watch.sent) {
      return;
    }
    const pageId = this.snapshot.hostPageId as ID;
    const layerKey = api.me.id;
    if (onlyAppended(watch.sent, strokes)) {
      const fresh = strokes.slice(watch.sent.length);
      watch.sent = strokes;
      fresh.forEach(stroke =>
        api.send({ t: 'codraw.stroke', from: layerKey, item: { pageId, panelId: hostPanel, layerKey, stroke } }),
      );
      return;
    }
    watch.sent = strokes;
    this.sendingLayer = true;
    jsonToBase64({ strokes })
      .then(data => api.sendBlob('page', data, { codraw: 'layer', pageId, panelId: hostPanel, layerKey }))
      .catch(() => {})
      .finally(() => {
        this.sendingLayer = false;
        // Strokes drawn while the layer was on its way go out now, after it.
        this.checkMine();
      });
  }

  private markThumb(): void {
    this.thumbDirty = true;
    if (this.thumbTimer === null) {
      this.thumbTimer = this.clock.setTimeout(() => {
        this.thumbTimer = null;
        this.flushThumb();
      }, THUMB_EVERY_MS);
    }
  }

  private flushThumb(): void {
    if (this.thumbTimer !== null) {
      this.clock.clearTimeout(this.thumbTimer);
      this.thumbTimer = null;
    }
    const pageId = this.snapshot.pageId;
    if (this.thumbDirty && pageId && useStory.getState().pages[pageId]) {
      useStory.getState().bumpArt(pageId);
    }
    this.thumbDirty = false;
  }
}
