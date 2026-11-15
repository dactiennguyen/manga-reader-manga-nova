/**
 * Mori's short line under a metric chart, in the editor's voice (see ../studio/editor.ts): warm, plain,
 * never a scold. The situation comes from this period against the one before, and the line is picked by
 * day, so it stays the same all day.
 */
import { msg, t } from '../i18n';
import { pick } from '../studio/seed';
import { seedOf } from '../studio/castUtil';

export type NoteSituation = 'quiet' | 'start' | 'up' | 'down' | 'steady' | 'collecting';

/** Placeholders: {amount} this period, {before} the period before, both with their noun. */
export const STATS_LINES: Record<NoteSituation, string[]> = {
  quiet: [
    msg('Nothing here yet this time. One small page is all it takes to start the chart.'),
    msg('A quiet stretch. Rest is part of the work too. The desk will be here when you are ready.'),
  ],
  start: [
    msg('{amount} where there was nothing before. That is how every series begins.'),
    msg('{amount} this time. A fresh start looks good on you.'),
  ],
  up: [
    msg('{amount}, up from {before}. I can see the practice paying off.'),
    msg('{amount} this time against {before} before. Keep this rhythm and the pages add up.'),
  ],
  down: [
    msg('{amount} this time, after {before}. Slower stretches happen. Steady beats fast.'),
    msg('A little under last time: {amount} against {before}. One good session evens it out.'),
  ],
  steady: [
    msg('{amount} again. A steady hand is how stories get finished.'),
    msg('Same as last time: {amount}. Reliable is a superpower in this job.'),
  ],
  collecting: [
    msg('I only started keeping this count recently. Give it a few days and the chart will fill in.'),
  ],
};

export function noteSituation(current: number, previous: number, collecting = false): NoteSituation {
  if (current <= 0) {
    return collecting ? 'collecting' : 'quiet';
  }
  if (previous <= 0) {
    return 'start';
  }
  if (current > previous) {
    return 'up';
  }
  return current < previous ? 'down' : 'steady';
}

/** The line, translated and filled in. `amount` and `before` already carry their noun. */
export function statsNote(situation: NoteSituation, amount: string, before: string, metric: string, today: string): string {
  return t(pick(STATS_LINES[situation], seedOf('stats-note', metric, situation, today)), { amount, before });
}
