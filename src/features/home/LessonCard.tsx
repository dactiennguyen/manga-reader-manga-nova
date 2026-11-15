import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import { LESSONS, courseById } from '../../core/lessons/catalog';
import { lessonsDone, suggestLesson } from '../../core/lessons/progress';
import { useAppNavigation } from '../../state/navigation';
import { useLessons } from '../../state/useLessons';
import { Button, Card, ICON, Icon, Text } from '../../ui';
import { MarkDoneIcon, PlayIcon } from '../../ui/icons';
import { CourseBadge } from '../lessons/parts';
import type { HomeData } from './useHomeData';

/**
 * Today's drawing lesson: a few minutes of tracing, a reason to draw every day. A newcomer sees the first
 * lesson here right after onboarding, below the ways to start, without being sent to it.
 */
export const LessonCard = memo(function LessonCardView({ data }: { data: HomeData }) {
  const navigation = useAppNavigation();
  const progress = useLessons(s => s.progress);
  const { today } = data;
  const suggestion = useMemo(() => suggestLesson(progress, today), [progress, today]);
  const { lesson, doneToday, review } = suggestion;
  const course = courseById(lesson.courseId);
  const done = lessonsDone(progress);
  const heading = review ? t('Practice again') : t("Today's lesson");
  const countText = t('{done} of {total} lessons done', { done, total: LESSONS.length });
  const open = () => navigation.navigate('Lesson', { lessonId: lesson.id });

  return (
    <Card accessibilityLabel={`${heading}: ${t(lesson.title)}. ${countText}`} onPress={open} className="gap-3 p-3">
      <View className="flex-row items-center gap-3">
        <CourseBadge courseId={lesson.courseId} />
        <View className="flex-1 gap-0.5">
          <Text variant="caption" tone="muted">
            {heading}
          </Text>
          <Text variant="heading" numberOfLines={2}>
            {t(lesson.title)}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {course ? `${t(course.title)} · ${countText}` : countText}
          </Text>
        </View>
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        {doneToday ? (
          <View className="min-h-9 flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
            <Icon icon={MarkDoneIcon} size={ICON.md} color="success" weight="fill" />
            <Text variant="label" tone="success">
              {t('Done for today')}
            </Text>
          </View>
        ) : (
          <Button title={t('Start lesson')} icon={PlayIcon} variant="secondary" small onPress={open} />
        )}
        <Button title={t('All lessons')} variant="ghost" small onPress={() => navigation.navigate('Courses')} />
      </View>
    </Card>
  );
});
