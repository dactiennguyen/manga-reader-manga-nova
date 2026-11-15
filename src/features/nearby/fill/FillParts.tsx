/** The pieces of Fill the bubbles around the panel: setup, the turn bar, bubble tools, the lines form and the result list. */
import { useState } from 'react';
import { View } from 'react-native';

import { msg, t, tn } from '../../../core/i18n';
import { BUBBLE_TYPE_LABEL } from '../../../core/model/constants';
import {
  BUBBLE_KINDS,
  FILL_BUBBLES_MAX,
  FILL_DRAW_SECONDS,
  FILL_LINE_MAX,
  FILL_ROUNDS,
  FILL_WRITE_SECONDS,
  bubbleSize,
  resizeBubble,
  type BubbleKind,
  type FillBubble,
  type FillVersion,
} from '../../../core/nearby/fill';
import type { MemberId } from '../../../core/nearby/types';
import { Button, Chip, ChipRow, Icon, ICON, IconButton, Pressable, SectionHeader, Segmented, Text, TextField } from '../../../ui';
import { CheckIcon, DeleteIcon, PlayIcon, PlusIcon, SendIcon, StarIcon, TimeIcon } from '../../../ui/icons';
import { clockText } from '../draw/DrawTurn';

type NameOf = (id: MemberId | null | undefined) => string;

/** What the game is, for the setup and for guests waiting for it to start. */
export const FILL_BLURB = msg('One player draws a panel with empty bubbles. The others write the lines in secret, then everyone votes for the funniest.');

export function FillSetup({ players, onStart }: { players: number; onStart: (rounds: number, drawSeconds: number, writeSeconds: number) => void }) {
  const [rounds, setRounds] = useState<number>(FILL_ROUNDS[0]);
  const [drawSeconds, setDrawSeconds] = useState<number>(FILL_DRAW_SECONDS[1]);
  const [writeSeconds, setWriteSeconds] = useState<number>(FILL_WRITE_SECONDS[1]);
  const enough = players >= 2;
  return (
    <View className="gap-4">
      <Text tone="secondary">{t(FILL_BLURB)}</Text>
      <View className="gap-2">
        <SectionHeader>{t('Rounds')}</SectionHeader>
        <ChipRow>
          {FILL_ROUNDS.map(value => (
            <Chip key={value} label={String(value)} selected={value === rounds} onPress={() => setRounds(value)} />
          ))}
        </ChipRow>
      </View>
      <View className="gap-2">
        <SectionHeader>{t('Drawing time')}</SectionHeader>
        <ChipRow>
          {FILL_DRAW_SECONDS.map(value => (
            <Chip key={value} label={t('{n} s', { n: value })} selected={value === drawSeconds} onPress={() => setDrawSeconds(value)} />
          ))}
        </ChipRow>
      </View>
      <View className="gap-2">
        <SectionHeader>{t('Writing time')}</SectionHeader>
        <ChipRow>
          {FILL_WRITE_SECONDS.map(value => (
            <Chip key={value} label={t('{n} s', { n: value })} selected={value === writeSeconds} onPress={() => setWriteSeconds(value)} />
          ))}
        </ChipRow>
      </View>
      <Button
        title={enough ? t('Start the game') : t('Waiting for a second person')}
        icon={PlayIcon}
        disabled={!enough}
        onPress={() => onStart(rounds, drawSeconds, writeSeconds)}
      />
    </View>
  );
}

/** Round, what is happening, and the time left when there is a clock. */
export function TurnBar({ round, rounds, left, note }: { round: number; rounds: number; left?: number; note?: string }) {
  const urgent = left !== undefined && left < 10000;
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between">
        <Text variant="caption" tone="secondary">
          {t('Round {n} of {total}', { n: round, total: rounds })}
        </Text>
        {left !== undefined ? (
          <View className="flex-row items-center gap-1" accessibilityLabel={t('{time} left', { time: clockText(left) })}>
            <Icon icon={TimeIcon} size={ICON.sm} color={urgent ? 'accent' : 'text-secondary'} />
            <Text variant="mono" tone={urgent ? 'accent' : 'text'}>
              {clockText(left)}
            </Text>
          </View>
        ) : null}
      </View>
      {note ? <Text variant="heading">{note}</Text> : null}
    </View>
  );
}

/** Adding bubbles, and for the one picked on the board: its size, or taking it away. Kept short, so the board and the tools fit without scrolling. */
export function BubbleTools({
  bubbles,
  selected,
  onAdd,
  onChange,
  onRemove,
}: {
  bubbles: readonly FillBubble[];
  selected: number;
  onAdd: (kind: BubbleKind) => void;
  onChange: (index: number, bubble: FillBubble) => void;
  onRemove: (index: number) => void;
}) {
  const chosen = bubbles[selected];
  const full = bubbles.length >= FILL_BUBBLES_MAX;
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {BUBBLE_KINDS.map(kind => (
          <Button key={kind} small variant="secondary" icon={PlusIcon} title={t(BUBBLE_TYPE_LABEL[kind])} disabled={full} onPress={() => onAdd(kind)} />
        ))}
      </View>
      {chosen ? (
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Segmented
              options={[
                { value: 'small', label: t('Small') },
                { value: 'large', label: t('Large') },
              ]}
              value={bubbleSize(chosen)}
              onChange={size => onChange(selected, resizeBubble(chosen, size))}
            />
          </View>
          <IconButton icon={DeleteIcon} onPress={() => onRemove(selected)} accessibilityLabel={t('Remove the bubble')} />
        </View>
      ) : null}
      <Text variant="caption" tone="secondary">
        {full ? t('Three bubbles is the most a panel can have.') : t('Drag a bubble to move it, or the tip of its tail to point it.')}
      </Text>
    </View>
  );
}

/** One field per bubble, numbered like the bubbles on the panel. */
export function LinesForm({
  draft,
  sent,
  onLine,
  onSend,
}: {
  draft: readonly string[];
  sent: readonly string[] | null;
  onLine: (index: number, text: string) => void;
  onSend: () => void;
}) {
  const ready = draft.some(line => line.trim());
  const changed = !sent || draft.some((line, index) => line.replace(/\s+/g, ' ').trim() !== (sent[index] ?? ''));
  return (
    <View className="gap-2">
      <Text variant="heading">{t('Write the lines')}</Text>
      <Text variant="caption" tone="secondary">
        {t('Only you see them until the reveal. Names stay hidden until the vote is over.')}
      </Text>
      {draft.map((line, index) => (
        <TextField
          key={index}
          value={line}
          onChangeText={text => onLine(index, text)}
          placeholder={t('Bubble {n}', { n: index + 1 })}
          accessibilityLabel={t('Bubble {n}', { n: index + 1 })}
          maxLength={FILL_LINE_MAX}
          returnKeyType={index === draft.length - 1 ? 'send' : 'next'}
          onSubmitEditing={index === draft.length - 1 ? onSend : undefined}
        />
      ))}
      {sent && !changed ? (
        <View className="min-h-12 flex-row items-center gap-2">
          <Icon icon={CheckIcon} size={ICON.md} color="success" weight="bold" />
          <Text variant="label" className="flex-1">
            {t('Sent. You can change them until time is up.')}
          </Text>
        </View>
      ) : (
        <Button title={sent ? t('Send the new lines') : t('Send my lines')} icon={SendIcon} disabled={!ready} onPress={onSend} />
      )}
    </View>
  );
}

/** Numbered chips to look at each version. */
export function VersionChips({ versions, shown, mine, onShow }: { versions: readonly FillVersion[]; shown: number; mine: string | null; onShow: (index: number) => void }) {
  return (
    <ChipRow>
      {versions.map((version, index) => (
        <Chip
          key={version.id}
          label={version.id === mine ? t('{n} (yours)', { n: index + 1 }) : String(index + 1)}
          selected={index === shown}
          onPress={() => onShow(index)}
        />
      ))}
    </ChipRow>
  );
}

/** Every version after the vote: who wrote it, its votes, and the winners marked. */
export function ResultList({
  ranked,
  authors,
  winners,
  shown,
  onShow,
  nameOf,
}: {
  ranked: { version: FillVersion; votes: number }[];
  authors: Record<string, MemberId>;
  winners: readonly string[];
  shown: string | null;
  onShow: (id: string) => void;
  nameOf: NameOf;
}) {
  return (
    <View className="gap-2">
      {ranked.map(({ version, votes }) => {
        const won = winners.includes(version.id);
        const selected = version.id === shown;
        return (
          <Pressable
            key={version.id}
            onPress={() => onShow(version.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`min-h-12 flex-row items-center gap-3 rounded-md px-3 py-2 ${selected ? 'bg-accent/15' : 'bg-surface'}`}
          >
            <Icon icon={StarIcon} size={ICON.md} color={won ? 'accent' : 'text-muted'} weight={won ? 'fill' : 'regular'} />
            <View className="flex-1">
              <Text variant="label" numberOfLines={1}>
                {t('Written by {name}', { name: nameOf(authors[version.id]) })}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {version.lines.filter(Boolean).join(' / ')}
              </Text>
            </View>
            <Text variant="caption" tone={won ? 'accent' : 'secondary'}>
              {tn(votes, '{count} vote', '{count} votes')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
