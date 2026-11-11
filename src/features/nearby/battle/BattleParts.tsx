/** The pieces of a speed battle between drawing: the host's setup, the vote, and the results. */
import { useState } from 'react';
import { Image, View, useWindowDimensions } from 'react-native';

import { t, tn } from '../../../core/i18n';
import { BATTLE_MINUTES, battlePrompts, cleanPrompt, ranking } from '../../../core/nearby/battle';
import type { MemberId } from '../../../core/nearby/types';
import { Button, Card, Chip, ChipRow, FieldLabel, Icon, ICON, IconButton, Pressable, SectionHeader, Text, TextField } from '../../../ui';
import { CheckIcon, PlayIcon, RefreshIcon } from '../../../ui/icons';
import { InkBurst } from './InkBurst';

const SHOWN_PROMPTS = 4;

function shuffled(list: string[]): string[] {
  return [...list].sort(() => Math.random() - 0.5);
}

export function BattleSetup({ players, onStart }: { players: number; onStart: (prompt: string, minutes: number) => void }) {
  const [prompts, setPrompts] = useState(() => shuffled(battlePrompts()).slice(0, SHOWN_PROMPTS));
  const [picked, setPicked] = useState<string | null>(prompts[0] ?? null);
  const [typed, setTyped] = useState('');
  const [minutes, setMinutes] = useState<number>(BATTLE_MINUTES[0]);
  const prompt = cleanPrompt(typed) || picked || '';
  const enough = players >= 2;
  return (
    <View className="gap-4">
      <View className="gap-2">
        <SectionHeader
          right={
            <IconButton
              icon={RefreshIcon}
              onPress={() => setPrompts(shuffled(battlePrompts()).slice(0, SHOWN_PROMPTS))}
              accessibilityLabel={t('Other prompts')}
            />
          }
        >
          {t('Prompt')}
        </SectionHeader>
        {prompts.map(item => {
          const selected = !typed.trim() && item === picked;
          return (
            <Pressable
              key={item}
              onPress={() => {
                setPicked(item);
                setTyped('');
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`min-h-12 flex-row items-center gap-3 rounded-md px-3 py-2 ${selected ? 'bg-accent' : 'bg-surface'}`}
            >
              <Text variant="bodySmall" tone={selected ? 'onAccent' : 'text'} className="flex-1">
                {t(item)}
              </Text>
              {selected ? <Icon icon={CheckIcon} size={ICON.md} color="on-accent" weight="fill" /> : null}
            </Pressable>
          );
        })}
        <FieldLabel>{t('Or write your own')}</FieldLabel>
        <TextField value={typed} onChangeText={setTyped} placeholder={t('Draw…')} maxLength={200} returnKeyType="done" />
      </View>
      <View className="gap-2">
        <SectionHeader>{t('Time')}</SectionHeader>
        <ChipRow>
          {BATTLE_MINUTES.map(value => (
            <Chip key={value} label={t('{n} min', { n: value })} selected={value === minutes} onPress={() => setMinutes(value)} />
          ))}
        </ChipRow>
      </View>
      <Button
        title={enough ? t('Start the battle') : t('Waiting for a second person')}
        icon={PlayIcon}
        disabled={!enough || !prompt}
        onPress={() => onStart(prompt, minutes)}
      />
    </View>
  );
}

type Drawing = { member: MemberId; base64: string };

function DrawingImage({ base64, size }: { base64: string; size: number }) {
  return (
    <Image
      source={{ uri: `data:image/jpeg;base64,${base64}` }}
      style={{ width: size, height: size }}
      resizeMode="contain"
      className="rounded-sm bg-paper"
    />
  );
}

function useTile(): number {
  const { width } = useWindowDimensions();
  return Math.floor((Math.min(width, 480) - 32 - 12) / 2);
}

export function BattleVote({
  drawings,
  me,
  vote,
  nameOf,
  onVote,
}: {
  drawings: Drawing[];
  me: MemberId | undefined;
  vote: MemberId | null;
  nameOf: (id: MemberId) => string;
  onVote: (member: MemberId) => void;
}) {
  const tile = useTile();
  return (
    <View className="flex-row flex-wrap gap-3">
      {drawings.map(({ member, base64 }) => {
        const mine = member === me;
        const selected = vote === member;
        return (
          <Pressable
            key={member}
            disabled={mine}
            onPress={() => onVote(member)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: mine }}
            accessibilityLabel={mine ? t('Your drawing') : t('Vote for {name}', { name: nameOf(member) })}
            className={`gap-1 rounded-md p-1.5 ${selected ? 'bg-accent' : 'bg-surface'}`}
          >
            <DrawingImage base64={base64} size={tile} />
            <View className="h-8 flex-row items-center gap-1 px-1">
              {selected ? <Icon icon={CheckIcon} size={ICON.sm} color="on-accent" weight="fill" /> : null}
              <Text variant="label" tone={selected ? 'onAccent' : mine ? 'muted' : 'text'} numberOfLines={1} className="flex-1">
                {mine ? t('Yours') : nameOf(member)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BattleResults({
  scores,
  drawings,
  me,
  nameOf,
}: {
  scores: Record<MemberId, number>;
  drawings: Drawing[];
  me: MemberId | undefined;
  nameOf: (id: MemberId) => string;
}) {
  const places = ranking(scores);
  const winners = places.filter(place => place.rank === 1 && place.score > 0);
  const tile = useTile();
  return (
    <View className="gap-4">
      <InkBurst>
        <Text variant="caption" tone="onPaper">
          {winners.length > 1 ? t('A tie for first place') : t('First place')}
        </Text>
        <Text variant="display" tone="onPaper" className="px-6 text-center" accessibilityLiveRegion="polite">
          {winners.length ? winners.map(place => nameOf(place.member)).join(' · ') : t('Nobody got a vote')}
        </Text>
      </InkBurst>
      {places.map(place => {
        const drawing = drawings.find(item => item.member === place.member);
        return (
          <Card key={place.member} className="flex-row items-center gap-3 p-3">
            <View className={`h-10 w-10 items-center justify-center rounded-full ${place.rank === 1 ? 'bg-accent' : 'bg-overlay'}`}>
              <Text variant="heading" tone={place.rank === 1 ? 'onAccent' : 'text'}>
                {place.rank}
              </Text>
            </View>
            {drawing ? <DrawingImage base64={drawing.base64} size={Math.min(96, tile / 2)} /> : null}
            <View className="flex-1 gap-0.5">
              <Text variant="label" numberOfLines={1}>
                {place.member === me ? t('You') : nameOf(place.member)}
              </Text>
              <Text variant="caption" tone="secondary">
                {tn(place.score, '{count} vote', '{count} votes')}
              </Text>
            </View>
          </Card>
        );
      })}
    </View>
  );
}
