import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { t, tn } from '../../core/i18n';
import { topCharacters } from '../../core/stats/characters';
import { formatFullDate, formatNumber } from '../../core/stats/format';
import {
  METRIC_LABEL,
  beforeRecording,
  drawingSummary,
  metricAmount,
  metricTotal,
  statsRecords,
  type StatMetric,
} from '../../core/stats/overview';
import { periodOf, type PeriodKind } from '../../core/stats/period';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { useStats } from '../../state/useStats';
import { useStory } from '../../state/useStory';
import { Avatar, Card, EmptyState, ListItem, Section, SectionHeader, Tabs, Text, type IconGlyph } from '../../ui';
import {
  AddPageIcon,
  BrushIcon,
  BubbleIcon,
  ChapterIcon,
  CharactersIcon,
  DoneIcon,
  EventIcon,
  PanelsIcon,
  ScriptIcon,
  StarIcon,
  StreakIcon,
} from '../../ui/icons';
import { StudioPage } from '../studio/StudioPage';
import { BarChart, barShortName, chartBars, peakBar } from './BarChart';
import { DrawTimeCard } from './DrawTimeCard';
import { PERIOD_TABS, PeriodNavigator, StatTile } from './parts';
import { useStatsData } from './useStatsData';

const CHART_HEIGHT = 112;

const MADE: readonly { metric: StatMetric; icon: IconGlyph }[] = [
  { metric: 'pagesDone', icon: DoneIcon },
  { metric: 'pages', icon: AddPageIcon },
  { metric: 'panels', icon: PanelsIcon },
  { metric: 'words', icon: ScriptIcon },
  { metric: 'bubbles', icon: BubbleIcon },
  { metric: 'chapters', icon: ChapterIcon },
];

/** Creation statistics: drawing, what was made, when the person draws, who appears most and records. */
export function StatsScreen() {
  const navigation = useAppNavigation();
  const route = useAppRoute<'Stats'>();
  const [kind, setKind] = useState<PeriodKind>(route.params?.period ?? 'week');
  const [offset, setOffset] = useState(0);
  const { source, today, weekStart, firstDay } = useStatsData();
  const sessions = useStats(s => s.sessions);
  const projects = useStory(s => s.projects);
  const chapters = useStory(s => s.chapters);
  const scenes = useStory(s => s.scenes);
  const pages = useStory(s => s.pages);
  const characters = useStory(s => s.characters);

  const period = useMemo(() => periodOf(kind, today, offset, weekStart, firstDay), [kind, today, offset, weekStart, firstDay]);
  const drawing = useMemo(() => drawingSummary(source, period), [source, period]);
  const bars = useMemo(() => chartBars(period, drawing.buckets, today), [period, drawing.buckets, today]);
  const records = useMemo(() => statsRecords(source, today), [source, today]);
  const cast = useMemo(
    () => topCharacters({ projects, chapters, scenes, pages, characters }),
    [projects, chapters, scenes, pages, characters],
  );

  const peak = peakBar(bars);
  const strokes = metricAmount('strokes', drawing.strokes);
  const chartSummary = peak
    ? t('{metric}: {amount}. Most on {day}: {best}.', {
        metric: t(METRIC_LABEL.strokes),
        amount: strokes,
        day: peak.name,
        best: metricAmount('strokes', peak.value),
      })
    : t('{metric}: {amount}.', { metric: t(METRIC_LABEL.strokes), amount: strokes });
  const collecting = beforeRecording(source, 'pages', period) && period.kind !== 'all';
  const open = (metric: StatMetric) =>
    navigation.navigate('StatsMetric', { metric, period: period.kind === 'all' ? 'month' : period.kind });

  return (
    <StudioPage title={t('Statistics')}>
      <Tabs
        stretch
        tabs={PERIOD_TABS.map(tab => ({ key: tab.key, label: t(tab.label) }))}
        value={kind}
        onChange={next => {
          setKind(next);
          setOffset(0);
        }}
      />
      <PeriodNavigator period={period} offset={offset} firstDay={firstDay} onChange={setOffset} />

      <Card onPress={() => open('strokes')} accessibilityLabel={chartSummary} className="gap-3 p-4">
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1">
            <Text variant="caption" tone="secondary">
              {t(METRIC_LABEL.strokes)}
            </Text>
            <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
              {formatNumber(drawing.strokes)}
            </Text>
          </View>
          {!!peak && (
            <Text variant="caption" tone="muted" className="text-right">
              {t('Most on {day}', { day: barShortName(period, peak) })}
            </Text>
          )}
        </View>
        <BarChart bars={bars} summary={chartSummary} height={CHART_HEIGHT} />
      </Card>

      <View className="flex-row flex-wrap gap-3">
        <StatTile
          icon={EventIcon}
          label={t('Days drawn')}
          value={formatNumber(drawing.daysDrawn)}
          note={drawing.bestRun > 1 ? t('Longest run here: {days}', { days: metricAmount('days', drawing.bestRun) }) : undefined}
          onPress={() => open('strokes')}
        />
        <StatTile
          icon={StreakIcon}
          label={t('Drawing streak')}
          value={metricAmount('days', records.streak)}
          note={t('Best: {days}', { days: metricAmount('days', records.bestStreak) })}
          onPress={() => open('strokes')}
        />
      </View>

      <View className="gap-2">
        <SectionHeader>{t('What you made')}</SectionHeader>
        <Text variant="caption" tone="muted">
          {period.kind === 'all'
            ? t('All time shows what your stories hold now.')
            : collecting && source.progress.since
              ? t('Counted from {date}, when statistics started. Earlier days show as zero.', {
                  date: formatFullDate(source.progress.since),
                })
              : t('Counts what you added. Stories you import or receive do not count.')}
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {MADE.map(item => (
            <StatTile
              key={item.metric}
              icon={item.icon}
              label={t(METRIC_LABEL[item.metric])}
              value={formatNumber(metricTotal(source, item.metric, period))}
              onPress={() => open(item.metric)}
            />
          ))}
        </View>
      </View>

      <View className="gap-2">
        <SectionHeader>{t('When you draw')}</SectionHeader>
        <DrawTimeCard sessions={sessions} since={source.progress.since} weekStart={weekStart} />
      </View>

      <Section
        title={t('Who appears most')}
        footer={t('Counted from script lines and page bubbles tied to a character, across all your stories.')}
      >
        {cast.length === 0 ? (
          <EmptyState
            icon={CharactersIcon}
            title={t('No one has spoken yet')}
            message={t('Pick a speaker for a script line or a bubble, and they show up here.')}
          />
        ) : (
          cast.map((entry, index) => {
            const character = characters[entry.characterId];
            const detail = [
              tn(entry.lines, '{count} line', '{count} lines', { count: formatNumber(entry.lines) }),
              metricAmount('bubbles', entry.bubbles),
            ].join(' · ');
            return (
              <ListItem
                key={entry.characterId}
                left={<Avatar character={character} />}
                title={t('{n}. {name}', { n: index + 1, name: character?.name.trim() || t('Unnamed') })}
                subtitle={detail}
                chevron
                onPress={() => navigation.navigate('Character', { characterId: entry.characterId })}
              />
            );
          })
        )}
      </Section>

      <Section title={t('Personal records')}>
        <ListItem
          icon={StreakIcon}
          title={t('Longest streak')}
          right={<Text tone="secondary">{metricAmount('days', records.bestStreak)}</Text>}
        />
        <ListItem
          icon={BrushIcon}
          title={t('Best drawing day')}
          subtitle={records.bestDay ? formatFullDate(records.bestDay.day) : t('Not yet')}
          right={records.bestDay ? <Text tone="secondary">{metricAmount('strokes', records.bestDay.value)}</Text> : undefined}
        />
        <ListItem
          icon={StarIcon}
          title={t('Most pages finished in a day')}
          subtitle={records.bestPagesDay ? formatFullDate(records.bestPagesDay.day) : t('Not yet')}
          right={records.bestPagesDay ? <Text tone="secondary">{formatNumber(records.bestPagesDay.value)}</Text> : undefined}
        />
        <ListItem
          icon={ScriptIcon}
          title={t('Most words in a day')}
          subtitle={records.bestWordsDay ? formatFullDate(records.bestWordsDay.day) : t('Not yet')}
          right={records.bestWordsDay ? <Text tone="secondary">{formatNumber(records.bestWordsDay.value)}</Text> : undefined}
        />
      </Section>
    </StudioPage>
  );
}
