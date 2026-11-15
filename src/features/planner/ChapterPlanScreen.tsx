import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { msg, t, tn } from '../../core/i18n';
import { chapterProgress } from '../../core/model/selectors';
import type { ID } from '../../core/model/types';
import { doneOnDay } from '../../core/planner/data';
import { addDays, weekdayOrder } from '../../core/planner/days';
import {
  ALL_WEEKDAYS,
  DEFAULT_PLAN_DAYS,
  DEFAULT_TARGET,
  MAX_PLAN_DAYS,
  MAX_TARGET,
  WORKWEEK,
  clampTarget,
  makePlan,
  normalizeWorkdays,
  viewPlan,
  type ChapterPlan,
} from '../../core/planner/plan';
import { daysLeftText, deadlineText, planAdvice, todayText } from '../../core/planner/words';
import { pagesText } from '../../core/studio/castUtil';
import { dayKey, weekdayName } from '../../core/util/time';
import { useAppNavigation, useAppRoute } from '../../state/navigation';
import { useStoryData } from '../../state/hooks';
import { usePlanner } from '../../state/usePlanner';
import { Button, Card, Chip, ChipGroup, EmptyState, ICON, Icon, Pressable, ProgressBar, Stepper, Text, confirm, toast } from '../../ui';
import { CalendarIcon, CaretRightIcon, ChapterIcon, DeleteIcon } from '../../ui/icons';
import { StudioPage } from '../studio/StudioPage';
import { DatePickerSheet } from './DatePickerSheet';
import { MoriNote, StatusBadge } from './PlanParts';
import { chapterTitles, useNoteToday } from './usePlannerData';

const QUICK_TARGETS = [8, 16, 24, 32];

const QUICK_DEADLINES = [
  { days: 7, label: msg('In 1 week') },
  { days: 14, label: msg('In 2 weeks') },
  { days: 30, label: msg('In 1 month') },
];

const UPCOMING_COUNT = 7;

type Draft = { target: number; deadline: string; workdays: number[] };

function draftOf(plan: ChapterPlan | undefined, total: number, today: string): Draft {
  if (!plan) {
    return { target: total || DEFAULT_TARGET, deadline: addDays(today, DEFAULT_PLAN_DAYS), workdays: [...ALL_WEEKDAYS] };
  }
  // A deadline that has passed is moved a week ahead, ready to be saved as the new date.
  return { target: plan.target, deadline: plan.deadline < today ? addDays(today, 7) : plan.deadline, workdays: plan.workdays };
}

function sameDraft(draft: Draft, plan: ChapterPlan | undefined): boolean {
  return (
    !!plan &&
    clampTarget(draft.target) === plan.target &&
    draft.deadline === plan.deadline &&
    normalizeWorkdays(draft.workdays).join() === plan.workdays.join()
  );
}

function FieldLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <View>
      <Text variant="label">{title}</Text>
      {!!hint && (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      )}
    </View>
  );
}

/** One chapter's plan: where it stands, the days ahead, and the form that sets pages, date and work days. */
export function ChapterPlanScreen() {
  const navigation = useAppNavigation();
  const chapterId: ID = useAppRoute<'ChapterPlan'>().params.chapterId;
  const state = useStoryData();
  const plan = usePlanner(s => s.plans[chapterId]);
  const doneLog = usePlanner(s => s.doneLog);
  const today = dayKey();
  useNoteToday(today);
  const chapter = state.chapters[chapterId];
  const { done, total } = chapterProgress(state, chapterId);
  const doneToday = doneOnDay(doneLog, state, chapterId, today);
  const [draft, setDraft] = useState<Draft>(() => draftOf(plan, total, today));
  const [picking, setPicking] = useState(false);

  const view = useMemo(() => (plan ? viewPlan(plan, done, doneToday, today) : null), [plan, done, doneToday, today]);
  const preview = useMemo(
    () => viewPlan(makePlan({ chapterId, ...draft }, done - doneToday, today), done, doneToday, today),
    [chapterId, draft, done, doneToday, today],
  );

  if (!chapter) {
    return (
      <StudioPage title={t('Chapter plan')}>
        <EmptyState icon={ChapterIcon} title={t('This chapter was deleted.')} action={{ label: t('Go back'), onPress: navigation.goBack }} />
      </StudioPage>
    );
  }

  const { chapter: chapterTitle, story } = chapterTitles(state, chapterId);
  const dirty = !sameDraft(draft, plan);
  const set = (patch: Partial<Draft>) => setDraft(current => ({ ...current, ...patch }));
  const toggleDay = (weekday: number) => {
    const has = draft.workdays.includes(weekday);
    if (has && draft.workdays.length === 1) {
      toast(t('Keep at least one work day.'));
      return;
    }
    set({ workdays: has ? draft.workdays.filter(day => day !== weekday) : [...draft.workdays, weekday] });
  };
  const save = () => {
    usePlanner.getState().setPlan(makePlan({ chapterId, ...draft }, done - doneToday, today));
    toast(plan ? t('Plan updated') : t('Plan saved'));
  };
  const remove = async () => {
    const ok = await confirm(t('Remove this plan?'), t('The chapter and its pages stay as they are.'), {
      confirmText: t('Remove plan'),
      destructive: true,
    });
    if (ok) {
      usePlanner.getState().clearPlan(chapterId);
      setDraft(draftOf(undefined, total, today));
      toast(t('Plan removed'));
    }
  };
  const targets = [...new Set([...(total > 0 ? [total] : []), ...QUICK_TARGETS])];
  const everyDay = draft.workdays.length === 7;
  const weekdaysOnly = normalizeWorkdays(draft.workdays).join() === WORKWEEK.join();
  const previewText =
    preview.remaining === 0
      ? t('These pages are already done.')
      : preview.usesRestDays
        ? t('No work days are left before the deadline, so the plan uses your days off too.')
        : t('{pages} a day over {days}.', {
            pages: pagesText(preview.perDay),
            days: tn(preview.workDaysLeft, '{count} work day', '{count} work days'),
          });

  return (
    <StudioPage title={t('Chapter plan')} subtitle={story ? `${chapterTitle} · ${story}` : chapterTitle}>
      {view && (
        <Card className="gap-3 p-4">
          <View className="flex-row items-center gap-2">
            <StatusBadge status={view.status} />
            <Text variant="caption" tone={view.status === 'overdue' ? 'danger' : 'secondary'} className="flex-1 text-right">
              {daysLeftText(view)}
            </Text>
          </View>
          <View className="gap-1">
            <ProgressBar value={Math.min(1, view.done / view.plan.target)} tone={view.status === 'done' ? 'success' : 'accent'} />
            <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
              {t('{done}/{total} pages', { done: Math.min(view.done, view.plan.target), total: view.plan.target })}
            </Text>
          </View>
          <Text variant="heading">{todayText(view)}</Text>
          <MoriNote text={planAdvice(view)} />
          {view.schedule.length > 0 && (
            <View className="gap-1">
              <Text variant="label" tone="secondary">
                {t('Coming up')}
              </Text>
              {view.schedule.slice(0, UPCOMING_COUNT).map(item => (
                <View key={item.day} className="min-h-8 flex-row items-center justify-between gap-2">
                  <Text variant="bodySmall" tone={item.day === today ? 'accent' : 'text'}>
                    {item.day === today ? `${t('Today')} · ${deadlineText(item.day)}` : deadlineText(item.day)}
                  </Text>
                  <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>
                    {pagesText(item.pages)}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Button
            title={chapter.pageIds.length ? t('Storyboard') : t('Script')}
            variant="secondary"
            onPress={() =>
              chapter.pageIds.length ? navigation.navigate('Storyboard', { chapterId }) : navigation.navigate('Script', { chapterId })
            }
          />
        </Card>
      )}

      <Card className="gap-4 p-4">
        <Text variant="heading" accessibilityRole="header">
          {plan ? t('Change the plan') : t('Set a deadline')}
        </Text>

        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <FieldLabel
                title={t('Pages to finish')}
                hint={total ? t('{done}/{total} pages', { done, total }) : t('No pages yet')}
              />
            </View>
            <Stepper
              value={draft.target}
              min={1}
              max={MAX_TARGET}
              label={t('Pages to finish')}
              onChange={value => set({ target: value })}
            />
          </View>
          <ChipGroup>
            {targets.map(value => (
              <Chip
                key={value}
                label={value === total ? tn(total, "The chapter's {count} page", "The chapter's {count} pages") : pagesText(value)}
                selected={draft.target === value}
                onPress={() => set({ target: value })}
              />
            ))}
          </ChipGroup>
        </View>

        <View className="gap-2">
          <FieldLabel title={t('Deadline')} hint={daysLeftText(preview)} />
          <Pressable
            accessibilityLabel={`${t('Deadline')}: ${deadlineText(draft.deadline)}`}
            onPress={() => setPicking(true)}
            className="min-h-12 flex-row items-center gap-3 rounded-md bg-overlay px-3"
          >
            <Icon icon={CalendarIcon} color="text-secondary" />
            <Text className="flex-1">{deadlineText(draft.deadline)}</Text>
            <Icon icon={CaretRightIcon} size={ICON.md} color="text-muted" />
          </Pressable>
          <ChipGroup>
            {QUICK_DEADLINES.map(option => {
              const day = addDays(today, option.days);
              return <Chip key={option.days} label={t(option.label)} selected={draft.deadline === day} onPress={() => set({ deadline: day })} />;
            })}
          </ChipGroup>
        </View>

        <View className="gap-2">
          <FieldLabel title={t('Work days')} hint={t('Pages are planned only on these days.')} />
          <ChipGroup>
            {weekdayOrder().map(weekday => (
              <Chip key={weekday} label={weekdayName(weekday)} selected={draft.workdays.includes(weekday)} onPress={() => toggleDay(weekday)} />
            ))}
          </ChipGroup>
          <View className="flex-row flex-wrap gap-2">
            <Button title={t('Every day')} variant="ghost" small disabled={everyDay} onPress={() => set({ workdays: [...ALL_WEEKDAYS] })} />
            <Button title={t('Skip weekends')} variant="ghost" small disabled={weekdaysOnly} onPress={() => set({ workdays: [...WORKWEEK] })} />
          </View>
        </View>

        <View className="rounded-md bg-accent/15 px-3 py-2">
          <Text variant="bodySmall" tone="accent" accessibilityLiveRegion="polite">
            {previewText}
          </Text>
        </View>

        <Button title={plan ? t('Save changes') : t('Start the plan')} disabled={!dirty} onPress={save} />
        {!!plan && <Button title={t('Remove plan')} icon={DeleteIcon} variant="danger" onPress={remove} />}
      </Card>

      <DatePickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        title={t('Deadline')}
        value={draft.deadline}
        today={today}
        min={today}
        max={addDays(today, MAX_PLAN_DAYS)}
        onPick={day => set({ deadline: day })}
      />
    </StudioPage>
  );
}
