/**
 * The canvas for a timed turn (relay panel, battle drawing): the normal canvas with a small timer under
 * its top bar and, in a relay, the panel before as a small reference. The page stays the brightest thing.
 */
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScopedTheme } from 'uniwind';

import { t } from '../../../core/i18n';
import type { ID } from '../../../core/model/types';
import { usePageContext } from '../../../render/PageView';
import { useSettings } from '../../../state/useSettings';
import { Button, EmptyState, ICON, Icon, Screen, Text } from '../../../ui';
import { SendIcon, TimeIcon } from '../../../ui/icons';
import { CanvasEditor } from '../../canvas/CanvasScreen';

const TOP_BAR = 56;
const REF_WIDTH = 132;
/** The canvas tool rail: 8 margin + 4 padding + a 48 button + 4 padding, and a little air. */
const RAIL_CLEARANCE = 72;
const EDGE = 8;

/**
 * Where a bar over the canvas may sit: clear of the tool rail, which the canvas puts on the side away
 * from the drawing hand (CanvasScreen), starting at the same height as these bars.
 */
export function useRailClearance(): { left: number; right: number; railSide: 'left' | 'right' } {
  const handedness = useSettings(s => s.handedness);
  const railSide = handedness === 'left' ? 'right' : 'left';
  return {
    railSide,
    left: railSide === 'left' ? RAIL_CLEARANCE : EDGE,
    right: railSide === 'right' ? RAIL_CLEARANCE : EDGE,
  };
}

/** Re-renders on a steady tick, for countdowns. */
export function useNow(everyMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

export function clockText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export type TurnReference = { base64: string; label: string; ratio: number };

function TurnOverlay({
  endsAt,
  note,
  reference,
  onSend,
}: {
  endsAt: number;
  note: string;
  reference: TurnReference | null;
  onSend: () => void;
}) {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const left = endsAt - now;
  const top = insets.top + TOP_BAR + 8;
  const clear = useRailClearance();
  return (
    <>
      <View pointerEvents="box-none" className="absolute items-center" style={{ top, left: clear.left, right: clear.right }}>
        <View className="max-w-full flex-row items-center gap-2 rounded-full bg-raised py-1 pl-3 pr-1">
          <Icon icon={TimeIcon} size={ICON.sm} color={left < 30000 ? 'accent' : 'text-secondary'} />
          <Text variant="mono" tone={left < 30000 ? 'accent' : 'text'}>
            {clockText(left)}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-shrink">
            {note}
          </Text>
          <Button title={t('Send')} icon={SendIcon} small onPress={onSend} />
        </View>
      </View>
      {reference ? (
        <View
          pointerEvents="none"
          className="absolute overflow-hidden rounded-sm bg-raised p-1"
          style={[{ top: top + 56, width: REF_WIDTH }, clear.railSide === 'left' ? { right: EDGE } : { left: EDGE }]}
          accessibilityLabel={reference.label}
        >
          <Image
            source={{ uri: `data:image/jpeg;base64,${reference.base64}` }}
            style={{ width: REF_WIDTH - 8, height: (REF_WIDTH - 8) / reference.ratio }}
            resizeMode="contain"
          />
          <Text variant="caption" tone="secondary" numberOfLines={1} className="px-1 pt-1">
            {reference.label}
          </Text>
        </View>
      ) : null}
    </>
  );
}

export function DrawTurn({
  pageId,
  panelId,
  endsAt,
  note,
  reference,
  onSend,
}: {
  pageId: ID;
  panelId: ID;
  endsAt: number;
  note: string;
  reference: TurnReference | null;
  onSend: () => void;
}) {
  const ctx = usePageContext(pageId);
  const shape = ctx?.shapes.find(item => item.id === panelId);
  if (!ctx || !shape) {
    return (
      <Screen>
        <EmptyState title={t('Panel not found')} message={t('This panel no longer exists on the page.')} />
      </Screen>
    );
  }
  return (
    <ScopedTheme theme="dark">
      <CanvasEditor
        key={panelId}
        ctx={ctx}
        shape={shape}
        pageId={pageId}
        panelId={panelId}
        embed={{
          onDone: onSend,
          renderOverlay: () => <TurnOverlay endsAt={endsAt} note={note} reference={reference} onSend={onSend} />,
        }}
      />
    </ScopedTheme>
  );
}
