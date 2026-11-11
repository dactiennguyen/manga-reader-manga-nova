import { useMemo } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { BLOCK_LABEL, BLOCK_TYPES } from '../../core/model/constants';
import type { Character, ID, Scene } from '../../core/model/types';
import { formatDuration, scriptStats } from '../../core/script/scriptTools';
import { ProgressBar, Sheet, Text } from '../../ui';

function pagesValue(value: number): string {
  return `~${Number.isInteger(value) ? value : value.toFixed(1)}`;
}

export function StatsSheet({
  visible,
  onClose,
  title,
  scenes,
  characters,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  scenes: Scene[];
  characters: Record<ID, Character>;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Script statistics')} subtitle={title}>
      <StatsBody scenes={scenes} characters={characters} />
    </Sheet>
  );
}

function StatsBody({ scenes, characters }: { scenes: Scene[]; characters: Record<ID, Character> }) {
  const stats = useMemo(() => scriptStats(scenes, characters), [scenes, characters]);
  const tiles: [string, string][] = [
    [t('Words'), String(stats.words)],
    [t('Dialogue lines'), String(stats.dialogueLines)],
    [t('Scenes'), String(stats.scenes)],
    [t('Est. pages'), pagesValue(stats.pages)],
    [t('Reading time'), formatDuration(stats.readingSeconds)],
    [t('Written blocks'), String(stats.blocks)],
  ];
  const topLines = stats.speakers[0]?.lines ?? 0;
  return (
    <View className="gap-2 px-4 pb-4">
      <View className="flex-row flex-wrap gap-2">
        {tiles.map(([label, value]) => (
          <View key={label} className="grow basis-[30%] rounded-md bg-surface p-2">
            <Text variant="title" numberOfLines={1} adjustsFontSizeToFit>
              {value}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="heading" accessibilityRole="header" className="mt-3">
        {t('Blocks by type')}
      </Text>
      {BLOCK_TYPES.map(type => (
        <View key={type} className="flex-row items-center justify-between gap-3">
          <Text tone="secondary" className="shrink">
            {t(BLOCK_LABEL[type])}
          </Text>
          <Text variant="label">{stats.byType[type]}</Text>
        </View>
      ))}
      <Text variant="heading" accessibilityRole="header" className="mt-3">
        {t('Lines per character')}
      </Text>
      {stats.speakers.length === 0 && <Text tone="muted">{t('No dialogue written yet.')}</Text>}
      {stats.speakers.map((speaker, index) => (
        <View key={speaker.characterId ?? 'unassigned'} className="gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <Text tone="secondary" numberOfLines={1} className="shrink">
              {speaker.characterId && characters[speaker.characterId]?.name.trim() ? speaker.name : t(speaker.name)}
              {index === 0 && speaker.characterId && stats.speakers.length > 1 ? ` · ${t('talks most')}` : ''}
            </Text>
            <Text variant="label">
              {tn(speaker.lines, '{count} line', '{count} lines')} · {tn(speaker.words, '{count} word', '{count} words')}
            </Text>
          </View>
          <ProgressBar value={topLines ? speaker.lines / topLines : 0} />
        </View>
      ))}
      <Text variant="caption" tone="muted" className="mt-3">
        {t('Empty blocks are not counted. Reading time assumes 200 words a minute plus 6 seconds of art per page.')}
      </Text>
    </View>
  );
}
