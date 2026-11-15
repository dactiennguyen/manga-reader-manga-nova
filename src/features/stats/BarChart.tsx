import { View } from 'react-native';

import {
  formatDayMonth,
  formatMonthShort,
  formatMonthShortYear,
  formatMonthYear,
  formatNumber,
  formatWeekdayDate,
} from '../../core/stats/format';
import type { Bucket, Period } from '../../core/stats/period';
import { dayKeyToDate, weekdayName } from '../../core/util/time';
import { Text } from '../../ui';

export type ChartBar = {
  key: string;
  value: number;
  /** The bar's day or month in full, for rows and screen readers. */
  name: string;
  /** Under the bar. Charts with more than a dozen bars only label the ends. */
  axis: string;
  /** Today, or the month holding today. */
  current: boolean;
  /** Not reached yet: drawn empty and left out of the rows. */
  future: boolean;
};

/** Bars for a period: days for a week or a month, months for a year or everything. */
export function chartBars(period: Period, buckets: Bucket[], today: string): ChartBar[] {
  const byDay = period.kind === 'week' || period.kind === 'month';
  return buckets.map(bucket => {
    const date = dayKeyToDate(bucket.start);
    let axis: string;
    if (period.kind === 'week') {
      axis = weekdayName(date.getDay());
    } else if (period.kind === 'month') {
      axis = String(date.getDate());
    } else if (period.kind === 'year') {
      axis = String(date.getMonth() + 1);
    } else {
      axis = formatMonthShortYear(bucket.start);
    }
    return {
      key: bucket.start,
      value: bucket.value,
      name: byDay ? formatWeekdayDate(bucket.start) : formatMonthYear(bucket.start),
      axis,
      current: today >= bucket.start && today <= bucket.end,
      future: bucket.start > today,
    };
  });
}

/** The best bar's name and value, for a summary line. */
export function peakBar(bars: ChartBar[]): ChartBar | null {
  return bars.reduce<ChartBar | null>((best, bar) => (bar.value > 0 && (!best || bar.value > best.value) ? bar : best), null);
}

/** Short label of a bar's day or month, for the chart caption. */
export function barShortName(period: Period, bar: ChartBar): string {
  return period.kind === 'week' || period.kind === 'month' ? formatDayMonth(bar.key) : formatMonthShort(bar.key);
}

/**
 * A bar chart drawn with plain views, so it follows the theme through tokens. The bars start at zero and
 * share one colour; today's bar is solid and the rest are lighter. The whole chart reads as one image with
 * `summary` as its text, since the numbers per bar are listed beside it.
 */
export function BarChart({ bars, summary, height }: { bars: ChartBar[]; summary: string; height: number }) {
  const tallest = Math.max(0, ...bars.map(bar => bar.value));
  const few = bars.length <= 12;
  const edges = few ? [] : [bars[0], bars[Math.floor((bars.length - 1) / 2)], bars[bars.length - 1]].filter(Boolean);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} className="gap-1">
      {/* The top of the chart is the tallest bar, so its value is the scale. */}
      <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
        {formatNumber(tallest)}
      </Text>
      <View className={`flex-row items-end border-b border-divider ${few ? 'gap-2' : 'gap-0.5'}`} style={{ height }}>
        {bars.map(bar => (
          <View key={bar.key} className={`h-full flex-1 justify-end ${few ? 'rounded-t-sm bg-overlay' : ''}`}>
            {bar.value > 0 && (
              <View
                className={`w-full rounded-t-sm ${bar.current ? 'bg-accent' : 'bg-accent/60'}`}
                style={{ height: Math.max(2, Math.round((bar.value / Math.max(1, tallest)) * height)) }}
              />
            )}
          </View>
        ))}
      </View>
      {few ? (
        <View className="flex-row gap-2">
          {bars.map(bar => (
            <Text key={bar.key} variant="caption" tone={bar.current ? 'text' : 'muted'} numberOfLines={1} className="flex-1 text-center">
              {bar.axis}
            </Text>
          ))}
        </View>
      ) : (
        <View className="flex-row justify-between">
          {edges.map(bar => (
            <Text key={bar.key} variant="caption" tone="muted" numberOfLines={1}>
              {bar.axis}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
