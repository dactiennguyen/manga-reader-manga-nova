/** The planner's words: status names, Mori's advice on a plan, the weekly line and the reminder text. */
import { msg, t, tn } from '../i18n';
import type { ID } from '../model/types';
import { pagesText, seedOf } from '../studio/castUtil';
import { pick } from '../studio/seed';
import { dayKeyToDate, formatDate } from '../util/time';
import type { DayEntry, WeekSummary } from './calendar';
import type { PlanItem } from './data';
import { daysBetween, type Month } from './days';
import { pagesOn, type PlanStatus, type PlanView } from './plan';

export const STATUS_LABEL: Record<PlanStatus, string> = {
  done: msg('Done'),
  overdue: msg('Overdue'),
  behind: msg('Behind'),
  onTrack: msg('On track'),
  ahead: msg('Ahead'),
};

export const STATUS_TONE: Record<PlanStatus, 'success' | 'danger' | 'warning' | 'accent'> = {
  done: 'success',
  overdue: 'danger',
  behind: 'warning',
  onTrack: 'accent',
  ahead: 'success',
};

const MONTHS = [
  msg('January'),
  msg('February'),
  msg('March'),
  msg('April'),
  msg('May'),
  msg('June'),
  msg('July'),
  msg('August'),
  msg('September'),
  msg('October'),
  msg('November'),
  msg('December'),
];

/** "November 2026", in the order each language writes it. */
export function monthTitle({ year, month }: Month): string {
  return t('{month} {year}', { month: t(MONTHS[month] ?? ''), year });
}

/** A date with its weekday: "Sun, 15/11/2026". */
export function deadlineText(day: string): string {
  return formatDate(dayKeyToDate(day).getTime(), true);
}

/** A short, kind suggestion for where the plan stands. */
export function planAdvice(view: PlanView): string {
  switch (view.status) {
    case 'done':
      return t('Every planned page is done. Well drawn!');
    case 'overdue':
      return t('The deadline has passed with {pages} left. Pick a new date and the plan starts again.', {
        pages: pagesText(view.remaining),
      });
    case 'behind':
      return view.usesRestDays
        ? t('No work days are left before the deadline, so the plan uses your days off too.')
        : t('{gap} behind. {pages} a day still finishes on time.', { gap: pagesText(view.gap), pages: pagesText(view.perDay) });
    case 'ahead':
      return t('{gap} ahead of the plan. Rest a little, or keep the lead.', { gap: pagesText(view.gap) });
    default:
      return view.usesRestDays
        ? t('No work days are left before the deadline, so the plan uses your days off too.')
        : t('{pages} a day to finish on time.', { pages: pagesText(view.perDay) });
  }
}

/** Today's part of a plan in a few words. */
export function todayText(view: PlanView): string {
  if (view.status === 'done') {
    return t('Chapter done');
  }
  if (view.status === 'overdue') {
    return t('Past the deadline');
  }
  if (view.todayPlanned === 0) {
    return t('Day off from this chapter');
  }
  if (view.todayLeft === 0) {
    return t('Done for today');
  }
  return view.doneToday > 0
    ? t('{left} left of {planned} today', { left: view.todayLeft, planned: pagesText(view.todayPlanned) })
    : t('{pages} today', { pages: pagesText(view.todayPlanned) });
}

export function daysLeftText(view: PlanView): string {
  if (view.daysLeft < 0) {
    return tn(-view.daysLeft, '{count} day late', '{count} days late');
  }
  if (view.daysLeft === 0) {
    return t('Due today');
  }
  return tn(view.daysLeft, '{count} day left', '{count} days left');
}

/** Planned and finished pages of one chapter on one day. */
export function dayEntryText(entry: DayEntry, day: string, today: string): string {
  if (day > today) {
    return entry.planned ? t('{pages} planned', { pages: pagesText(entry.planned) }) : '';
  }
  if (entry.planned === null || entry.planned === 0) {
    return entry.done ? t('{pages} done', { pages: pagesText(entry.done) }) : '';
  }
  return t('{done} of {planned} done', { done: entry.done, planned: pagesText(entry.planned) });
}

type WeekSituation = 'beatPlan' | 'shortOfPlan' | 'drewOnly' | 'quiet';

/** What Mori says about a week. Placeholders: {done} {planned} {days}. */
const WEEK_LINES: Record<WeekSituation, string[]> = {
  beatPlan: [
    msg('Every planned page is done: {done}. That is how deadlines get met.'),
    msg('You kept every promise to your calendar this week. I am impressed, truly.'),
    msg('{done} done against {planned} planned. Keep this rhythm and the chapter finishes itself.'),
  ],
  shortOfPlan: [
    msg('{done} of {planned} planned so far. No red pen from me. A small step each day closes the gap.'),
    msg('The plan asked for {planned} and you made {done}. Plans bend. We adjust and keep going.'),
    msg('Some weeks are like that. {done} still beats zero, and the deadline is not here yet.'),
  ],
  drewOnly: [
    msg('You drew on {days} this week. Give a chapter a deadline and I will split it into small daily pieces.'),
    msg('No plan this week, but you still showed up at the desk {days}. That counts.'),
  ],
  quiet: [
    msg('A quiet week. That is allowed. One page tomorrow is a perfectly good restart.'),
    msg('Your desk missed you this week. Shall we plan something small and kind for the next one?'),
  ],
};

function weekSituation(summary: WeekSummary): WeekSituation {
  if (summary.pagesPlanned > 0) {
    return summary.pagesDone >= summary.pagesPlanned ? 'beatPlan' : 'shortOfPlan';
  }
  return summary.daysDrawn > 0 || summary.pagesDone > 0 ? 'drewOnly' : 'quiet';
}

/** Mori's line for the week, the same all week long. */
export function weekLine(summary: WeekSummary): string {
  const situation = weekSituation(summary);
  return t(pick(WEEK_LINES[situation], seedOf('planner-week', summary.start, situation)), {
    done: pagesText(summary.pagesDone),
    planned: pagesText(summary.pagesPlanned),
    days: tn(summary.daysDrawn, '{count} day', '{count} days'),
  });
}

/**
 * The reminder line for the day it fires, or null to keep the usual text. A deadline on that day or the
 * next comes first; else the pages planned that day. Dates are written out, so a notice shown again on a
 * later day without the app being opened is still true.
 */
export function planReminderText(
  items: readonly PlanItem[],
  nameOf: (chapterId: ID) => string,
  fireDay: string,
  today: string,
): string | null {
  const open = items.filter(item => item.status !== 'done' && item.status !== 'overdue');
  const due = open.find(item => {
    const left = daysBetween(fireDay, item.plan.deadline);
    return left >= 0 && left <= 1;
  });
  if (due) {
    return t('{chapter} is due {date}. {pages} to go.', {
      chapter: nameOf(due.plan.chapterId),
      date: formatDate(dayKeyToDate(due.plan.deadline).getTime()),
      pages: pagesText(due.remaining),
    });
  }
  const work = open
    .map(item => ({ item, pages: fireDay === today ? item.todayLeft : pagesOn(item, fireDay) }))
    .filter(entry => entry.pages > 0);
  if (!work.length) {
    return null;
  }
  if (work.length === 1) {
    return t('Today: {pages} of {chapter}.', { pages: pagesText(work[0].pages), chapter: nameOf(work[0].item.plan.chapterId) });
  }
  const total = work.reduce((sum, entry) => sum + entry.pages, 0);
  return t('Today: {pages} across {count} chapters.', { pages: pagesText(total), count: work.length });
}
