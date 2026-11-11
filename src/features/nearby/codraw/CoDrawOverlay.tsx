/**
 * Over the shared canvas: where the others' pens are (a small dot with their name, in their ink),
 * a row of reactions, and reactions floating up. Kept small so the page stays the brightest thing.
 */
import { memo, useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import type { ViewState } from '../../../core/art/tools';
import { t } from '../../../core/i18n';
import { REACTIONS, REACTION_MS, liveCursors, type Cursor } from '../../../core/nearby/codraw';
import type { ID } from '../../../core/model/types';
import type { Member } from '../../../core/nearby/types';
import { Pressable, Text } from '../../../ui';
import type { CanvasEngine } from '../../canvas/useCanvasEngine';
import { useNow, useRailClearance } from '../draw/DrawTurn';
import { inkOf } from '../draw/members';
import type { Reaction } from './coDrawSession';

const TOP_BAR = 56;
const DOT = 12;

/** The inverse of screenToPage (core/art/tools): page units to screen points under the current view. */
function pageToScreen(view: ViewState, pageW: number, x: number, y: number): { x: number; y: number } {
  'worklet';
  const px = (view.flip ? pageW - x : x) * view.scale;
  const py = y * view.scale;
  const cos = Math.cos(view.rot);
  const sin = Math.sin(view.rot);
  return { x: px * cos - py * sin + view.tx, y: px * sin + py * cos + view.ty };
}

const CursorDot = memo(function CursorDotInner({
  cursor,
  name,
  ink,
  view,
  pageW,
}: {
  cursor: Cursor;
  name: string;
  ink: string;
  view: SharedValue<ViewState>;
  pageW: number;
}) {
  const { x, y } = cursor;
  const place = useAnimatedStyle(() => {
    const at = pageToScreen(view.value, pageW, x, y);
    return { transform: [{ translateX: at.x - DOT / 2 }, { translateY: at.y - DOT / 2 }] };
  });
  return (
    <Animated.View pointerEvents="none" className="absolute left-0 top-0 flex-row items-center gap-1" style={place}>
      <View className="rounded-full border-2 border-paper" style={{ width: DOT, height: DOT, backgroundColor: ink }} />
      <View className="rounded-sm px-1.5 py-0.5" style={{ backgroundColor: ink }}>
        <Text variant="caption" className="text-paper" numberOfLines={1}>
          {name}
        </Text>
      </View>
    </Animated.View>
  );
});

function Floating({ reaction, index }: { reaction: Reaction; index: number }) {
  const reduced = useReducedMotion();
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withTiming(1, { duration: REACTION_MS });
  }, [rise]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - rise.value * rise.value,
    transform: [{ translateY: reduced ? 0 : -140 * rise.value }, { translateX: ((index % 5) - 2) * 18 }],
  }));
  return (
    <Animated.View pointerEvents="none" className="absolute bottom-0" style={style}>
      <Text variant="display">{reaction.emoji}</Text>
    </Animated.View>
  );
}

export function CoDrawOverlay({
  engine,
  panelId,
  pageW,
  members,
  cursors,
  reactions,
  onCursor,
  onReact,
}: {
  engine: CanvasEngine;
  panelId: ID;
  pageW: number;
  members: Member[];
  cursors: Record<string, Cursor>;
  reactions: Reaction[];
  onCursor: (x: number, y: number, force: boolean) => void;
  onReact: (emoji: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const now = useNow(500);
  const clear = useRailClearance();

  // The pen's position, read on the UI thread and passed to JS; the session sends ten a second at most.
  useAnimatedReaction(
    () => engine.cursor.value,
    (next, previous) => {
      if (next) {
        scheduleOnRN(onCursor, next.x, next.y, false);
      } else if (previous) {
        scheduleOnRN(onCursor, previous.x, previous.y, true);
      }
    },
    [onCursor],
  );

  const shown = liveCursors(cursors, panelId, now);
  const floating = reactions.filter(item => now - item.at < REACTION_MS);
  return (
    <>
      {shown.map(cursor => {
        const member = members.find(item => item.id === cursor.member);
        return member ? (
          <CursorDot key={cursor.member} cursor={cursor} name={member.name} ink={inkOf(member)} view={engine.view} pageW={pageW} />
        ) : null;
      })}
      <View pointerEvents="none" className="absolute left-0 right-0 items-center" style={{ bottom: insets.bottom + 200 }}>
        {floating.map((reaction, index) => (
          <Floating key={reaction.id} reaction={reaction} index={index} />
        ))}
      </View>
      <View
        pointerEvents="box-none"
        className="absolute items-center"
        style={{ top: insets.top + TOP_BAR + 8, left: clear.left, right: clear.right }}
      >
        {/* Scrolls when a narrow phone cannot fit every reaction beside the tool rail. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="max-w-full flex-grow-0 rounded-full bg-raised"
          contentContainerClassName="px-1"
        >
          {REACTIONS.map(emoji => (
            <Pressable
              key={emoji}
              onPress={() => onReact(emoji)}
              accessibilityLabel={t('Send {emoji}', { emoji })}
              className="h-12 w-12 items-center justify-center"
            >
              <Text variant="title">{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </>
  );
}
