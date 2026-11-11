/** The pieces of Guess the drawing around the board: setup, word choice, the clue bar, pens, guesses, scores. */
import { useState } from 'react';
import { View } from 'react-native';

import { t } from '../../../core/i18n';
import { GUESS_ROUNDS, GUESS_SECONDS, GUESS_TEXT_MAX, INK_COLORS, INK_SIZES, displayWord, guessRanking, type FeedItem } from '../../../core/nearby/guess';
import type { GuessWord } from '../../../core/nearby/guessSession';
import type { MemberId } from '../../../core/nearby/types';
import { Button, Card, Chip, ChipRow, Icon, ICON, IconButton, Pressable, SectionHeader, Text, TextField } from '../../../ui';
import { CheckIcon, DeleteIcon, PlayIcon, SendIcon, TimeIcon, UndoIcon } from '../../../ui/icons';
import { clockText } from '../draw/DrawTurn';

type NameOf = (id: MemberId | null | undefined) => string;

export function GuessSetup({ players, onStart }: { players: number; onStart: (rounds: number, seconds: number) => void }) {
  const [rounds, setRounds] = useState<number>(GUESS_ROUNDS[1]);
  const [seconds, setSeconds] = useState<number>(GUESS_SECONDS[1]);
  const enough = players >= 2;
  return (
    <View className="gap-4">
      <Text tone="secondary">{t('Take turns drawing a secret word. Everyone else types guesses: the faster you get it, the more points.')}</Text>
      <View className="gap-2">
        <SectionHeader>{t('Rounds')}</SectionHeader>
        <ChipRow>
          {GUESS_ROUNDS.map(value => (
            <Chip key={value} label={String(value)} selected={value === rounds} onPress={() => setRounds(value)} />
          ))}
        </ChipRow>
      </View>
      <View className="gap-2">
        <SectionHeader>{t('Time to draw')}</SectionHeader>
        <ChipRow>
          {GUESS_SECONDS.map(value => (
            <Chip key={value} label={t('{n} s', { n: value })} selected={value === seconds} onPress={() => setSeconds(value)} />
          ))}
        </ChipRow>
      </View>
      <Button
        title={enough ? t('Start the game') : t('Waiting for a second person')}
        icon={PlayIcon}
        disabled={!enough}
        onPress={() => onStart(rounds, seconds)}
      />
    </View>
  );
}

export function WordChoices({ choices, left, onPick }: { choices: GuessWord[]; left: number; onPick: (word: GuessWord) => void }) {
  return (
    <View className="gap-3">
      <Text variant="heading">{t('Pick a word to draw')}</Text>
      <Text tone="secondary">{t('Only you can see it. {time} left to choose.', { time: clockText(left) })}</Text>
      {choices.map(word => (
        <Button key={word.english} title={displayWord(word.entry)} variant="secondary" onPress={() => onPick(word)} />
      ))}
    </View>
  );
}

/** Round, time left and the word's shape: one letter per box, so its length can be counted. */
export function ClueBar({
  round,
  rounds,
  left,
  mask,
  word,
  wordLabel,
}: {
  round: number;
  rounds: number;
  /** Time left; none once the turn is over. */
  left?: number;
  mask: string;
  word?: string;
  /** Said above the word, e.g. "The word was". */
  wordLabel?: string;
}) {
  const urgent = left !== undefined && left < 15000;
  return (
    <View className="gap-2">
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
      {word ? (
        <View className="items-center">
          {wordLabel ? (
            <Text variant="caption" tone="secondary">
              {wordLabel}
            </Text>
          ) : null}
          <Text variant="title" className="text-center">
            {word}
          </Text>
        </View>
      ) : (
        <View
          className="flex-row flex-wrap justify-center gap-1"
          accessibilityLabel={t('{n} letters', { n: Array.from(mask.replace(/[\s-]/g, '')).length })}
        >
          {Array.from(mask).map((char, index) =>
            char === '_' ? (
              <View key={index} className="h-8 w-6 border-b-2 border-text" />
            ) : (
              <View key={index} className="h-8 w-3 items-center justify-end">
                <Text variant="heading">{char === '-' ? '-' : ''}</Text>
              </View>
            ),
          )}
        </View>
      )}
    </View>
  );
}

export function PenTools({
  size,
  color,
  onSize,
  onColor,
  onUndo,
  onClear,
}: {
  size: number;
  color: string;
  onSize: (size: number) => void;
  onColor: (color: string) => void;
  onUndo: () => void;
  onClear: () => void;
}) {
  return (
    <View className="flex-row flex-wrap items-center justify-center gap-1">
      {INK_SIZES.map(value => {
        const selected = value === size;
        return (
          <Pressable
            key={value}
            onPress={() => onSize(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={value === INK_SIZES[0] ? t('Thin pen') : value === INK_SIZES[1] ? t('Medium pen') : t('Thick pen')}
            className={`h-12 w-12 items-center justify-center rounded-md ${selected ? 'bg-accent/15' : ''}`}
          >
            <View className="rounded-full" style={{ width: 6 + value / 2, height: 6 + value / 2, backgroundColor: color }} />
          </Pressable>
        );
      })}
      <View className="mx-1 h-8 w-px bg-divider" />
      {INK_COLORS.map((value, index) => {
        const selected = value === color;
        return (
          <Pressable
            key={value}
            onPress={() => onColor(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={[t('Black ink'), t('Red ink'), t('Blue ink')][index]}
            className={`h-12 w-12 items-center justify-center rounded-md ${selected ? 'bg-accent/15' : ''}`}
          >
            <View className={`h-7 w-7 items-center justify-center rounded-full ${selected ? 'border-2 border-accent' : ''}`} style={{ backgroundColor: value }}>
              {selected ? <Icon icon={CheckIcon} size={ICON.xs} color="paper" weight="bold" /> : null}
            </View>
          </Pressable>
        );
      })}
      <View className="mx-1 h-8 w-px bg-divider" />
      <IconButton icon={UndoIcon} onPress={onUndo} accessibilityLabel={t('Undo')} />
      <IconButton icon={DeleteIcon} onPress={onClear} accessibilityLabel={t('Clear the board')} />
    </View>
  );
}

export function GuessInput({ onGuess, done, close }: { onGuess: (text: string) => void; done: boolean; close: boolean }) {
  const [text, setText] = useState('');
  const send = () => {
    if (text.trim()) {
      onGuess(text);
      setText('');
    }
  };
  if (done) {
    return (
      <Card className="flex-row items-center gap-2 p-3">
        <Icon icon={CheckIcon} size={ICON.md} color="success" weight="bold" />
        <Text variant="label">{t('You got it! Waiting for the others…')}</Text>
      </Card>
    );
  }
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <TextField
            value={text}
            onChangeText={setText}
            placeholder={t('Type your guess')}
            maxLength={GUESS_TEXT_MAX}
            returnKeyType="send"
            onSubmitEditing={send}
            blurOnSubmit={false}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={t('Your guess')}
          />
        </View>
        <IconButton icon={SendIcon} color="accent" onPress={send} disabled={!text.trim()} accessibilityLabel={t('Send guess')} />
      </View>
      {close ? (
        <Text variant="caption" tone="accent" accessibilityLiveRegion="polite">
          {t('So close! One letter off.')}
        </Text>
      ) : null}
    </View>
  );
}

/** Guesses so far, newest first. A right answer shows who got it, never what they typed. */
export function GuessFeed({ feed, nameOf }: { feed: FeedItem[]; nameOf: NameOf }) {
  if (!feed.length) {
    return null;
  }
  return (
    <View className="gap-1" accessibilityLiveRegion="polite">
      {feed
        .slice(-8)
        .reverse()
        .map((item, index) =>
          item.kind === 'hit' ? (
            <View key={`h${index}`} className="flex-row items-center gap-2 rounded-md bg-success/15 px-3 py-2">
              <Icon icon={CheckIcon} size={ICON.sm} color="success" weight="bold" />
              <Text variant="label">{t('{name} guessed it!', { name: nameOf(item.member) })}</Text>
            </View>
          ) : (
            <Text key={`m${index}`} variant="bodySmall" tone="secondary" className="px-3">
              <Text variant="bodySmall" tone="text">
                {nameOf(item.member)}:
              </Text>{' '}
              {item.text}
            </Text>
          ),
        )}
    </View>
  );
}

export function Scoreboard({ scores, gained, me, nameOf, title }: { scores: Record<MemberId, number>; gained?: Record<MemberId, number>; me?: MemberId; nameOf: NameOf; title: string }) {
  return (
    <View className="gap-2">
      <SectionHeader>{title}</SectionHeader>
      {guessRanking(scores).map(({ member, score, rank }) => (
        <View key={member} className={`min-h-12 flex-row items-center gap-3 rounded-md px-3 ${member === me ? 'bg-accent/15' : 'bg-surface'}`}>
          <Text variant="mono" tone="secondary" className="w-6">
            {rank}
          </Text>
          <Text variant="label" className="flex-1" numberOfLines={1}>
            {nameOf(member)}
          </Text>
          {gained?.[member] ? (
            <Text variant="caption" tone="success">
              +{gained[member]}
            </Text>
          ) : null}
          <Text variant="mono">{score}</Text>
        </View>
      ))}
    </View>
  );
}
