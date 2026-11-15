import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { msg, t } from '../../core/i18n';
import { formatFullDate, formatNumber } from '../../core/stats/format';
import {
  METRIC_LABEL,
  beforeRecording,
  isStatMetric,
  metricAmount,
  metricSeries,
  type StatMetric,
} from '../../core/stats/overview';
import { bucketsOf, periodOf, totalIn, type PeriodKind } from '../../core/stats/period';
import { noteSituation, statsNote } from '../../core/stats/voice';
import { EDITOR } from '../../core/studio/cast';
import { useAppRoute } from '../../state/navigation';
import { Card, ListItem, Section, Segmented, Text } from '../../ui';
import { CastAvatar } from '../studio/parts/CastAvatar';
import { StudioPage } from '../studio/StudioPage';
import { BarChart, barShortName, chartBars, peakBar } from './BarChart';
import { PeriodNavigator } from './parts';
import { useStatsData } from './useStatsData';

const CHART_HEIGHT = 176;

type DetailKind = Exclude<PeriodKind, 'all'>;

const KIND_OPTIONS: readonly { value: DetailKind; label: string }[] = [
  { value: 'week', label: msg('Week') },
  { value: 'month', label: msg('Month') },
  { value: 'year', label: msg('Year') },
];

const ROWS_TITLE: Record<DetailKind, string> = {
  week: msg('Each day'),
  month: msg('Each day'),
  year: msg('Each month'),
};

/** One metric up close: a larger chart, the period navigator, the number for each day and a word from Mori. */
export function StatsMetricScreen() {
  const route = useAppRoute<'StatsMetric'>();
  const metric: StatMetric = isStatMetric(route.params?.metric) ? route.params.metric : 'strokes';
  const initial = route.params?.period;
  const [kind, setKind] = useState<DetailKind>(initial === 'month' || initial === 'year' ? initial : 'week');
  const [offset, setOffset] = useState(0);
  const { source, today, weekStart, firstDay } = useStatsData();

  const series = useMemo(() => metricSeries(source, metric), [source, metric]);
  const period = useMemo(() => periodOf(kind, today, offset, weekStart), [kind, today, offset, weekStart]);
  const previous = useMemo(() => periodOf(kind, today, offset - 1, weekStart), [kind, today, offset, weekStart]);
  const bars = useMemo(() => chartBars(period, bucketsOf(period, series), today), [period, series, today]);
  const total = totalIn(series, period);
  const before = totalIn(series, previous);
  const collecting = beforeRecording(source, metric, period);
  const label = t(METRIC_LABEL[metric]);
  const amount = metricAmount(metric, total);
  const peak = peakBar(bars);
  const note = statsNote(noteSituation(total, before, collecting), amount, metricAmount(metric, before), metric, today);
  const summary = peak
    ? t('{metric}: {amount}. Most on {day}: {best}.', { metric: label, amount, day: peak.name, best: metricAmount(metric, peak.value) })
    : t('{metric}: {amount}.', { metric: label, amount });
  const rows = bars.filter(bar => !bar.future);

  return (
    <StudioPage title={label}>
      <Segmented
        options={KIND_OPTIONS.map(option => ({ value: option.value, label: t(option.label) }))}
        value={kind}
        onChange={next => {
          setKind(next);
          setOffset(0);
        }}
      />
      <PeriodNavigator period={period} offset={offset} firstDay={firstDay} onChange={setOffset} />

      <Card className="gap-3 p-4">
        <View className="flex-row items-end justify-between gap-3">
          <Text variant="display" className="flex-1" style={{ fontVariant: ['tabular-nums'] }}>
            {formatNumber(total)}
          </Text>
          <View className="items-end">
            <Text variant="caption" tone="muted">
              {t('Previous period: {amount}', { amount: formatNumber(before) })}
            </Text>
            {!!peak && (
              <Text variant="caption" tone="muted">
                {t('Most on {day}', { day: barShortName(period, peak) })}
              </Text>
            )}
          </View>
        </View>
        <BarChart bars={bars} summary={summary} height={CHART_HEIGHT} />
        {collecting && !!source.progress.since && (
          <Text variant="caption" tone="muted">
            {t('Counted from {date}, when statistics started. Earlier days show as zero.', {
              date: formatFullDate(source.progress.since),
            })}
          </Text>
        )}
      </Card>

      <Card className="gap-3 p-3">
        <View className="flex-row items-center gap-3">
          <CastAvatar id="mori" size={40} />
          <View className="flex-1">
            <Text variant="caption" tone="muted">
              {t(EDITOR.role)}
            </Text>
            <Text variant="heading">{EDITOR.name}</Text>
          </View>
        </View>
        <View className="rounded-md bg-paper px-3 py-2">
          <Text tone="onPaper">{note}</Text>
        </View>
      </Card>

      <Section title={t(ROWS_TITLE[kind])}>
        {rows.length === 0 ? (
          <ListItem title={t('Not yet')} />
        ) : (
          [...rows].reverse().map(bar => (
            <ListItem
              key={bar.key}
              title={bar.name}
              selected={bar.current}
              right={
                <Text tone={bar.value > 0 ? 'text' : 'muted'} style={{ fontVariant: ['tabular-nums'] }}>
                  {formatNumber(bar.value)}
                </Text>
              }
            />
          ))
        )}
      </Section>
    </StudioPage>
  );
}
