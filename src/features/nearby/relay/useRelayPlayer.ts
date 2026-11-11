/**
 * This phone's part in a relay: a scratch page in "Relay pages" to draw its panels on, sending a panel
 * (by hand or when time is up), the panel before it as a reference, and keeping the finished page.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { templatePreview } from '../../../core/layout/layout';
import type { ID } from '../../../core/model/types';
import { previousPanel, readRelaySetup, relayTemplate } from '../../../core/nearby/relay';
import { useRoom } from '../../../state/useRoom';
import { toast } from '../../../ui';
import { t } from '../../../core/i18n';
import { RELAY_PAGES, addStoryPage, dropPage, ensureStory } from '../draw/drawStories';
import type { TurnReference } from '../draw/DrawTurn';
import { useMemberNames } from '../draw/members';
import { bumpPage, panelAt, placePanelImage, renderPanelJpeg } from '../draw/panelImage';
import { RELAY_PAGE } from '../draw/RelayPage';
import { relaySession, useRelay } from '../draw/sessions';

export function useRelayPlayer() {
  const snapshot = useRelay();
  const { state, images, deadline } = snapshot;
  const room = useRoom(s => s.room);
  const me = useRoom(s => s.me);
  const nameOf = useMemberNames();
  const setup = readRelaySetup(room?.options);
  const template = setup ? relayTemplate(setup.templateId) : undefined;
  const turn = state.turn;

  const [pageId, setPageId] = useState<ID | null>(null);
  const [sent, setSent] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [kept, setKept] = useState(false);
  const firstTurn = useRef<object | null>(null);
  const latest = useRef({ pageId, kept });
  latest.current = { pageId, kept };

  // A new relay (its first turn) starts from a clean slate; a scratch page nobody kept goes away.
  useEffect(() => {
    if (turn?.panelIndex === 0 && firstTurn.current !== turn) {
      firstTurn.current = turn;
      setSent([]);
      setKept(false);
      // Story writes stay out of the state updater: React may run updaters while rendering.
      if (latest.current.pageId && !latest.current.kept) {
        dropPage(latest.current.pageId);
      }
      setPageId(null);
    }
  }, [turn]);

  const myTurn = state.phase === 'turn' && !!turn && turn.member === me?.id && !sent.includes(turn.panelIndex);

  useEffect(() => {
    if (myTurn && !pageId && template) {
      setPageId(addStoryPage(ensureStory(RELAY_PAGES), template.id));
    }
  }, [myTurn, pageId, template]);

  const panelId = myTurn && pageId && turn ? panelAt(pageId, turn.panelIndex) : null;

  const send = useCallback(async () => {
    if (!turn || sending || sent.includes(turn.panelIndex)) {
      return;
    }
    setSending(true);
    try {
      const jpeg = pageId && panelId ? await renderPanelJpeg(pageId, panelId) : null;
      await relaySession.submit(turn.panelIndex, jpeg ?? '');
      setSent(list => [...list, turn.panelIndex]);
    } catch {
      toast(t("Couldn't send the panel. Check the Wi-Fi and try again."));
    } finally {
      setSending(false);
    }
  }, [pageId, panelId, sending, sent, turn]);

  // Time is up: whatever is drawn goes out, so nobody waits.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (!myTurn || deadline === null) {
      return;
    }
    const timer = setTimeout(() => sendRef.current(), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [deadline, myTurn]);

  const reference = useMemo((): TurnReference | null => {
    const before = turn ? previousPanel(state, turn.panelIndex) : null;
    const base64 = before ? images[before.blobId] : undefined;
    if (!before || !base64) {
      return null;
    }
    const ratio = template ? shapeRatio(template.id, before.panelIndex) : 1;
    return { base64, ratio, label: t('Panel {n} by {name}', { n: before.panelIndex + 1, name: nameOf(before.from) }) };
  }, [images, nameOf, state, template, turn]);

  const pictures = useMemo(() => {
    const out: Record<number, string> = {};
    Object.entries(state.done).forEach(([index, panel]) => {
      const base64 = images[panel.blobId];
      if (base64) {
        out[Number(index)] = base64;
      }
    });
    return out;
  }, [images, state.done]);

  const keep = useCallback(async () => {
    if (!template || kept) {
      return;
    }
    const target = pageId ?? addStoryPage(ensureStory(RELAY_PAGES), template.id);
    if (!target) {
      return;
    }
    for (const [index, panel] of Object.entries(state.done)) {
      const base64 = images[panel.blobId];
      // Panels drawn on this phone keep their strokes; the others come in as pictures.
      if (base64 && (panel.from !== me?.id || !pageId)) {
        await placePanelImage(target, Number(index), base64, nameOf(panel.from));
      }
    }
    bumpPage(target);
    setPageId(target);
    setKept(true);
    toast(t('Saved to “{story}”', { story: t(RELAY_PAGES) }));
  }, [images, kept, me?.id, nameOf, pageId, state.done, template]);

  // Leaving without keeping it: the scratch page is not left behind in the library.
  useEffect(
    () => () => {
      if (latest.current.pageId && !latest.current.kept) {
        dropPage(latest.current.pageId);
      }
    },
    [],
  );

  return { snapshot, setup, template, me, nameOf, myTurn, pageId, panelId, send, sending, sent, reference, pictures, keep, kept };
}

/** Width over height of a panel in the relay layout, for the reference picture. */
function shapeRatio(templateId: string, panelIndex: number): number {
  const template = relayTemplate(templateId);
  const shape = template ? templatePreview(template, RELAY_PAGE, true).find(item => item.index === panelIndex) : undefined;
  return shape ? shape.bbox.w / Math.max(1, shape.bbox.h) : 1;
}
