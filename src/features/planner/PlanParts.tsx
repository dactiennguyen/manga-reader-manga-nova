import { View } from 'react-native';

import { t } from '../../core/i18n';
import type { StoryData } from '../../core/model/types';
import type { PlanItem } from '../../core/planner/data';
import type { PlanStatus } from '../../core/planner/plan';
import { STATUS_LABEL, STATUS_TONE, daysLeftText, deadlineText, todayText } from '../../core/planner/words';
import { EDITOR } from '../../core/studio/cast';
import { useAppNavigation } from '../../state/navigation';
import { Badge, Card, ICON, Icon, ProgressBar, Text } from '../../ui';
import { CaretRightIcon } from '../../ui/icons';
import { CastAvatar } from '../studio/parts/CastAvatar';
import { chapterTitles } from './usePlannerData';

export function StatusBadge({ status }: { status: PlanStatus }) {
  return <Badge text={t(STATUS_LABEL[status])} tone={STATUS_TONE[status]} />;
}

/** One chapter plan: where it stands, today's pages and the deadline. Opens the chapter plan. */
export function PlanCard({ item, state }: { item: PlanItem; state: StoryData }) {
  const navigation = useAppNavigation();
  const { chapter, story } = chapterTitles(state, item.plan.chapterId);
  const today = todayText(item);
  const due = `${t('Due {date}', { date: deadlineText(item.plan.deadline) })} · ${daysLeftText(item)}`;
  return (
    <Card
      accessibilityLabel={`${chapter}, ${story}. ${t(STATUS_LABEL[item.status])}. ${today}. ${due}`}
      onPress={() => navigation.navigate('ChapterPlan', { chapterId: item.plan.chapterId })}
      className="gap-2 p-3"
    >
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <Text variant="heading" numberOfLines={1}>
            {chapter}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {story || t('Untitled')}
          </Text>
        </View>
        <StatusBadge status={item.status} />
        <Icon icon={CaretRightIcon} size={ICON.md} color="text-muted" />
      </View>
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <ProgressBar value={item.plan.target ? Math.min(1, item.done / item.plan.target) : 0} tone={item.status === 'done' ? 'success' : 'accent'} />
        </View>
        <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
          {t('{done}/{total} pages', { done: Math.min(item.done, item.plan.target), total: item.plan.target })}
        </Text>
      </View>
      <Text variant="label" tone={item.status === 'overdue' ? 'danger' : item.todayLeft === 0 && item.todayPlanned > 0 ? 'success' : 'text'} numberOfLines={2}>
        {today}
      </Text>
      <Text variant="caption" tone={item.status === 'overdue' ? 'danger' : 'secondary'} numberOfLines={2}>
        {due}
      </Text>
    </Card>
  );
}

/** A line from Mori, the editor, on a slip of paper. */
export function MoriNote({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <CastAvatar id="mori" size={40} />
      <View className="flex-1 rounded-md bg-paper px-3 py-2">
        <Text variant="caption" tone="onPaper">
          {EDITOR.name}
        </Text>
        <Text tone="onPaper">{text}</Text>
      </View>
    </View>
  );
}
