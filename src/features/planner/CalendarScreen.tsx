import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { msg, t, tn } from '../../core/i18n';
import { activeProjects, chapterIdsOf } from '../../core/model/selectors';
import type { StoryData } from '../../core/model/types';
import { agenda, dayInfo, type DayInfo, type PlannerContext } from '../../core/planner/calendar';
import { addMonths, compareMonths, monthOf, type Month } from '../../core/planner/days';
import { MAX_PLAN_DAYS } from '../../core/planner/plan';
import { dayEntryText, deadlineText } from '../../core/planner/words';
import { useAppNavigation } from '../../state/navigation';
import { Banner, Button, Card, EmptyState, ICON, Icon, IconButton, Pressable, Section, SectionHeader, Segmented, Text, toast } from '../../ui';
import { CalendarIcon, CaretRightIcon, DeadlineIcon, PlusIcon, StatsIcon, StreakIcon } from '../../ui/icons';
import { StudioPage } from '../studio/StudioPage';
import { ChapterPickerSheet } from './ChapterPickerSheet';
import { MonthGrid, MonthHeader, MonthLegend, type DayMarks } from './MonthGrid';
import { PlanCard } from './PlanParts';
import { chapterTitles, usePlannerContext } from './usePlannerData';

type CalendarMode = 'month' | 'agenda';

const VIEWS: { value: CalendarMode; label: string }[] = [
  { value: 'month', label: msg('Month') },
  { value: 'agenda', label: msg('Agenda') },
];

const AGENDA_DAYS = 30;

/** How far back the month view goes: the planned pages kept on the device. */
const MONTHS_BACK = 4;

/** One day's chapters with what was planned and done, the deadlines, and the strokes drawn. */
function DayCard({ info, today, state }: { info: DayInfo; today: string; state: StoryData }) {
  const navigation = useAppNavigation();
  const lived = info.day <= today;
  return (
    <Card className="gap-1 py-2">
      <View className="flex-row items-center gap-2 px-4 py-1">
        <Text variant="heading" className="flex-1" accessibilityRole="header">
          {deadlineText(info.day)}
        </Text>
        {info.day === today && (
          <Text variant="label" tone="accent">
            {t('Today')}
          </Text>
        )}
      </View>
      {info.entries.map(entry => {
        const { chapter, story } = chapterTitles(state, entry.chapterId);
        const text = dayEntryText(entry, info.day, today);
        const exists = !!state.chapters[entry.chapterId];
        return (
          <Pressable
            key={entry.chapterId}
            accessibilityLabel={[chapter, story, text, entry.overdue ? t('Overdue') : entry.deadline ? t('Deadline') : ''].filter(Boolean).join(', ')}
            disabled={!exists}
            onPress={() => navigation.navigate('ChapterPlan', { chapterId: entry.chapterId })}
            className="min-h-14 flex-row items-center gap-3 px-4 py-2"
          >
            <Icon
              icon={entry.deadline ? DeadlineIcon : CalendarIcon}
              color={entry.overdue ? 'danger' : entry.deadline ? 'accent' : 'text-secondary'}
              weight={entry.deadline ? 'fill' : 'regular'}
            />
            <View className="flex-1">
              <Text numberOfLines={1}>{chapter || t('Deleted chapter')}</Text>
              <Text variant="bodySmall" tone="muted" numberOfLines={2}>
                {[story, text, entry.overdue ? t('Overdue') : entry.deadline ? t('Deadline') : ''].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {exists && <Icon icon={CaretRightIcon} size={ICON.md} color="text-muted" />}
          </Pressable>
        );
      })}
      {!info.entries.length && (
        <Text tone="muted" className="px-4 py-2">
          {t('Nothing planned for this day.')}
        </Text>
      )}
      {lived && (
        <View className="flex-row items-center gap-2 px-4 py-2">
          <Icon icon={StreakIcon} size={ICON.sm} color={info.strokes ? 'accent' : 'text-muted'} weight={info.strokes ? 'fill' : 'regular'} />
          <Text variant="caption" tone={info.strokes ? 'secondary' : 'muted'}>
            {info.strokes ? tn(info.strokes, '{count} stroke drawn', '{count} strokes drawn') : t('No drawing this day')}
          </Text>
        </View>
      )}
    </Card>
  );
}

function MonthView({ context, state }: { context: PlannerContext; state: StoryData }) {
  const { today } = context;
  const [month, setMonth] = useState<Month>(() => monthOf(today));
  const [selected, setSelected] = useState(today);
  const marks = useCallback(
    (day: string): DayMarks | null => {
      const info = dayInfo(context, day);
      return {
        planned: info.planned > 0,
        drawn: info.strokes > 0,
        deadline: info.hasDeadline,
        overdue: info.overdue,
      };
    },
    [context],
  );
  const selectedInfo = useMemo(() => dayInfo(context, selected), [context, selected]);
  const now = monthOf(today);
  return (
    <>
      <View className="-mx-2 gap-2">
        <MonthHeader
          month={month}
          onChange={setMonth}
          canBack={compareMonths(month, addMonths(now, -MONTHS_BACK)) > 0}
          canForward={compareMonths(month, addMonths(now, Math.ceil(MAX_PLAN_DAYS / 30))) < 0}
        />
        <MonthGrid month={month} today={today} selected={selected} onSelect={setSelected} marks={marks} />
      </View>
      <MonthLegend />
      <DayCard info={selectedInfo} today={today} state={state} />
    </>
  );
}

function AgendaView({ context, state }: { context: PlannerContext; state: StoryData }) {
  const days = useMemo(() => agenda(context, AGENDA_DAYS), [context]);
  if (!days.length) {
    return <Text tone="muted">{t('Nothing planned in the next 30 days.')}</Text>;
  }
  return (
    <>
      {days.map(info => (
        <DayCard key={info.day} info={info} today={context.today} state={state} />
      ))}
    </>
  );
}

/** Deadlines, today's pages and the days drawn, as a month or as a list of the days ahead. */
export function CalendarScreen() {
  const navigation = useAppNavigation();
  const { context, state, data } = usePlannerContext();
  const [view, setView] = useState<CalendarMode>('month');
  const [picking, setPicking] = useState(false);
  const overdue = context.items.filter(item => item.status === 'overdue');
  const openPicker = () => {
    if (activeProjects(state).some(project => chapterIdsOf(project).length > 0)) {
      setPicking(true);
    } else {
      toast(t('Add a chapter to a story first.'));
    }
  };

  return (
    <StudioPage
      title={t('Creation calendar')}
      right={<IconButton icon={StatsIcon} accessibilityLabel={t('Weekly summary')} onPress={() => navigation.navigate('WeekSummary')} />}
    >
      {overdue.map(item => (
        <Banner
          key={item.plan.chapterId}
          tone="danger"
          icon={DeadlineIcon}
          text={t('{chapter} is past its deadline.', { chapter: chapterTitles(state, item.plan.chapterId).chapter })}
          action={{ label: t('Change plan'), onPress: () => navigation.navigate('ChapterPlan', { chapterId: item.plan.chapterId }) }}
        />
      ))}
      <Segmented options={VIEWS.map(option => ({ value: option.value, label: t(option.label) }))} value={view} onChange={setView} />
      {view === 'month' ? <MonthView context={context} state={state} /> : <AgendaView context={context} state={state} />}

      <View className="gap-2">
        <SectionHeader right={<Button title={t('Plan a chapter')} icon={PlusIcon} variant="ghost" small onPress={openPicker} />}>
          {t('Chapter plans')}
        </SectionHeader>
        {context.items.length ? (
          context.items.map(item => <PlanCard key={item.plan.chapterId} item={item} state={state} />)
        ) : (
          <Section>
            <EmptyState
              icon={CalendarIcon}
              title={t('No deadlines yet')}
              message={t("Give a chapter a page goal and a date. I'll split it into a few pages a day.")}
              action={{ label: t('Plan a chapter'), onPress: openPicker }}
            />
          </Section>
        )}
      </View>
      <Button title={t('Weekly summary')} icon={StatsIcon} variant="secondary" onPress={() => navigation.navigate('WeekSummary')} />
      <ChapterPickerSheet visible={picking} onClose={() => setPicking(false)} state={state} data={data} />
    </StudioPage>
  );
}
