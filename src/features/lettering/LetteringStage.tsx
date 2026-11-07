import { useRef, useState } from 'react';
import { View } from 'react-native';
import { ChecklistIcon, TranslateIcon } from '../../ui/icons';

import { defaultTail } from '../../core/lettering/bubbleEdit';
import { plural } from '../../core/util/format';
import { PageView } from '../../render/PageView';
import { Button, Chip, Text, useColor } from '../../ui';
import { LetteringGestureLayer } from './LetteringGestures';
import { progressLabel } from './Languages';
import { Overlay } from './Overlay';
import { BubbleCard, EffectCard } from './PropertyCard';
import { useCardLift } from './useCardLift';
import type { LetteringController } from './useLetteringController';
import { useLetteringTouch } from './useLetteringTouch';

const MARK_OFFSET = 8;
const CARD_INSET = 8;

export function LetteringStage({ c }: { c: LetteringController }) {
  const { state, dispatch, stage, view, k, ctx, lang, page, stored, pageId, project } = c;
  const { box, draft, hideBubbles, pending, guides } = state;
  const handlers = useLetteringTouch(c);
  const live = useRef(handlers);
  live.current = handlers;
  const [cardHeight, setCardHeight] = useState(0);
  useCardLift(c, cardHeight);
  const accent = useColor('accent');
  const warning = useColor('warning');
  const danger = useColor('danger');
  const { bw, bh, scale } = stage;
  const languages = project.languages ?? [];
  const speaker = c.characters.find(character => character.id === stored?.characterId)?.name;
  const isOrphan = !!stored && c.orphans.some(bubble => bubble.id === stored.id);

  return (
    <View
      testID="lettering-stage"
      className="flex-1 overflow-hidden bg-bg"
      onLayout={event =>
        dispatch({ type: 'layout', box: { w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height } })
      }
    >
      {box.w > 0 && (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Page with ${plural(page.bubbles.length, 'bubble')}`}
          className="absolute"
          style={{
            left: (box.w - bw) / 2,
            top: (box.h - bh) / 2,
            width: bw,
            height: bh,
            transform: [{ translateX: view.tx }, { translateY: view.ty }, { scale: view.z }],
          }}
        >
          <PageView
            pageId={pageId}
            width={bw}
            options={{ bubbles: !hideBubbles, skipBubbleId: draft ? draft.id : undefined, lang: lang ?? undefined }}
          >
            <Overlay
              scale={scale}
              k={k}
              size={ctx.size}
              fonts={c.fonts}
              lang={lang}
              selected={hideBubbles ? null : c.selectedBubble}
              floating={!!draft}
              guides={guides}
              warned={hideBubbles ? [] : c.warned.filter(bubble => bubble.id !== draft?.id)}
              orphans={hideBubbles ? [] : c.orphans.filter(bubble => bubble.id !== draft?.id)}
              effectBox={c.effectShape?.bbox ?? null}
              effectCenter={c.effectCenter}
              accent={accent}
              warning={warning}
              danger={danger}
            />
          </PageView>
          {!hideBubbles &&
            !draft &&
            c.untranslated.map(bubble => (
              <View
                key={`untranslated-${bubble.id}`}
                pointerEvents="none"
                className="absolute h-3.5 w-3.5 rounded-full bg-warning"
                style={{ left: (bubble.x + bubble.w) * scale - MARK_OFFSET, top: bubble.y * scale - MARK_OFFSET }}
              />
            ))}
          {state.showOrder &&
            !hideBubbles &&
            c.order.map((bubble, index) => (
              <View
                key={bubble.id}
                pointerEvents="none"
                className="absolute h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1"
                style={{ left: bubble.x * scale - MARK_OFFSET, top: bubble.y * scale - MARK_OFFSET }}
              >
                <Text variant="caption" tone="onAccent" maxFontSizeMultiplier={1.3}>
                  {index + 1}
                </Text>
              </View>
            ))}
        </View>
      )}
      <LetteringGestureLayer live={live} />
      <View pointerEvents="box-none" className="absolute inset-x-2 top-2 items-center gap-2">
        {languages.length > 0 && !pending && (
          <View pointerEvents="box-none" className="flex-row flex-wrap justify-center gap-2">
            <Chip
              label={lang ?? 'Original'}
              icon={TranslateIcon}
              selected={!!lang}
              onPress={() => dispatch({ type: 'openSheet', sheet: 'language' })}
            />
            {!!lang && (
              <Chip label={progressLabel(page.bubbles, lang)} onPress={() => dispatch({ type: 'openSheet', sheet: 'translate' })} />
            )}
          </View>
        )}
        {pending ? (
          <Chip
            label={pending.kind === 'bubble' ? 'Tap the page to place · Cancel' : 'Tap a panel to apply · Cancel'}
            selected
            onPress={() => dispatch({ type: 'pend', pending: null })}
          />
        ) : c.unplaced.length > 0 ? (
          <Button
            small
            variant="secondary"
            icon={ChecklistIcon}
            title={`Auto-place dialogue (${c.unplaced.length})`}
            onPress={c.runAutoPlace}
          />
        ) : null}
      </View>
      <View
        pointerEvents="box-none"
        className="absolute inset-x-2 gap-1"
        style={{ bottom: CARD_INSET }}
        onLayout={event => {
          // The card hides during a drag. Keeping its last height stops the page moving on release.
          const { height } = event.nativeEvent.layout;
          if (height > 0) {
            setCardHeight(height + CARD_INSET);
          }
        }}
      >
        {isOrphan && stored && (
          <View className="min-h-12 flex-row items-center gap-2 rounded-md bg-raised px-2 py-1">
            <Text variant="label" tone="danger" className="flex-1">
              No longer in script
            </Text>
            <Button small variant="ghost" title="Keep" onPress={() => c.changeBubble(stored.id, { blockId: undefined })} />
            <Button small variant="danger" title="Delete" onPress={() => c.removeBubble(stored.id)} />
          </View>
        )}
        {stored && !draft && !hideBubbles && (
          <BubbleCard
            bubble={stored}
            speaker={speaker}
            lang={lang}
            onChange={(patch, tag) => c.changeBubble(stored.id, patch, tag)}
            onEdit={() => dispatch({ type: 'openEditor' })}
            onDelete={() => c.removeBubble(stored.id)}
            onToggleTail={() => c.changeBubble(stored.id, { tail: stored.tail ? null : defaultTail(stored) })}
            onPickSpeaker={() => dispatch({ type: 'openSheet', sheet: 'speaker' })}
          />
        )}
        {c.selectedEffect && (
          <EffectCard
            effect={c.selectedEffect}
            panelNumber={c.panelNumber(c.selectedEffect.panelId)}
            onChange={(patch, tag) => c.selectedEffect && c.changeEffect(c.selectedEffect.id, patch, tag)}
            onDelete={() => c.selectedEffect && c.removeEffect(c.selectedEffect.id)}
          />
        )}
      </View>
    </View>
  );
}
