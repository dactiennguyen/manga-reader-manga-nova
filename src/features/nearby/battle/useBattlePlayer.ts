/**
 * This phone's part in a speed battle: a blank single-panel page in "Speed battles" to draw on, sending
 * the drawing when time is up (or earlier), voting, and keeping the drawing afterwards.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { t } from '../../../core/i18n';
import { battlePhase } from '../../../core/nearby/battle';
import type { ID } from '../../../core/model/types';
import type { MemberId } from '../../../core/nearby/types';
import { useRoom } from '../../../state/useRoom';
import { toast } from '../../../ui';
import { SPEED_BATTLES, addStoryPage, dropPage, ensureStory } from '../draw/drawStories';
import { useNow } from '../draw/DrawTurn';
import { useMemberNames } from '../draw/members';
import { bumpPage, panelAt, renderPanelJpeg } from '../draw/panelImage';
import { battleSession, useBattle } from '../draw/sessions';

export function useBattlePlayer() {
  const snapshot = useBattle();
  const { state, images } = snapshot;
  const me = useRoom(s => s.me);
  const nameOf = useMemberNames();
  const now = useNow(200);
  const phase = battlePhase(state, now);

  const [pageId, setPageId] = useState<ID | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [kept, setKept] = useState(false);
  const [vote, setVote] = useState<MemberId | null>(null);
  const started = useRef(0);
  const latest = useRef({ pageId, kept });
  latest.current = { pageId, kept };

  // A new battle: a fresh blank page; an old one nobody kept goes away.
  useEffect(() => {
    if (state.started && state.startsAt !== started.current && Date.now() < state.endsAt) {
      started.current = state.startsAt;
      setSent(false);
      setKept(false);
      setVote(null);
      // Story writes stay out of the state updater: React may run updaters while rendering.
      if (latest.current.pageId && !latest.current.kept) {
        dropPage(latest.current.pageId);
      }
      setPageId(state.players.includes(me?.id ?? '') ? addStoryPage(ensureStory(SPEED_BATTLES), 'g1') : null);
    }
  }, [me?.id, state.endsAt, state.players, state.started, state.startsAt]);

  const panelId = pageId ? panelAt(pageId, 0) : null;

  const send = useCallback(async () => {
    if (sent || sending || !pageId || !panelId) {
      return;
    }
    setSending(true);
    try {
      await battleSession.submit((await renderPanelJpeg(pageId, panelId)) ?? '');
      setSent(true);
    } catch {
      toast(t("Couldn't send your drawing. Check the Wi-Fi and try again."));
    } finally {
      setSending(false);
    }
  }, [pageId, panelId, sending, sent]);

  // Time is up: the drawing goes out as it is.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (!state.started || sent || !pageId) {
      return;
    }
    const timer = setTimeout(() => sendRef.current(), Math.max(0, state.endsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [pageId, sent, state.endsAt, state.started]);

  const castVote = useCallback((target: MemberId) => {
    if (battleSession.vote(target)) {
      setVote(target);
    }
  }, []);

  const drawings = useMemo(
    () =>
      Object.entries(state.submissions)
        .map(([member, blobId]) => ({ member, base64: images[blobId] }))
        .filter((item): item is { member: MemberId; base64: string } => !!item.base64),
    [images, state.submissions],
  );

  const keep = useCallback(() => {
    if (pageId && !kept) {
      bumpPage(pageId);
      setKept(true);
      toast(t('Saved to “{story}”', { story: t(SPEED_BATTLES) }));
    }
  }, [kept, pageId]);

  useEffect(
    () => () => {
      if (latest.current.pageId && !latest.current.kept) {
        dropPage(latest.current.pageId);
      }
    },
    [],
  );

  return { state, phase, now, me, nameOf, pageId, panelId, send, sent, sending, vote, castVote, drawings, keep, kept };
}
