import { useMemo } from 'react';
import { View } from 'react-native';

import { t } from '../../core/i18n';
import { COURSES, LESSONS, finalDrawing } from '../../core/lessons/catalog';
import { courseProgress, lessonsDone, suggestLesson } from '../../core/lessons/progress';
import { dayKey } from '../../core/util/time';
import { useAppNavigation } from '../../state/navigation';
import { useLessons } from '../../state/useLessons';
import { Badge, Button, Card, ListItem, ProgressBar, SectionHeader, Text } from '../../ui';
import { PlayIcon } from '../../ui/icons';
import { StudioPage } from '../studio/StudioPage';
import { LessonArt } from './LessonArt';
import { CourseBadge, StarRow } from './parts';

const PREVIEW = 96;

/**
 * Every course and lesson, in the order a beginner takes them. Nothing is locked: the next lesson is only
 * highlighted, so anyone can jump to the topic they want.
 */
export function CoursesScreen() {
  const navigation = useAppNavigation();
  const progress = useLessons(s => s.progress);
  const today = dayKey();
  const suggestion = useMemo(() => suggestLesson(progress, today), [progress, today]);
  const done = lessonsDone(progress);
  const next = suggestion.lesson;
  const nextCourse = COURSES.find(course => course.id === next.courseId);
  const open = (lessonId: string) => navigation.navigate('Lesson', { lessonId });

  return (
    <StudioPage title={t('Drawing lessons')}>
      <Card className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-1">
            <Badge text={suggestion.review ? t('Practice again') : t('Up next')} />
            <Text variant="heading" numberOfLines={2}>
              {t(next.title)}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {nextCourse ? t(nextCourse.title) : ''}
            </Text>
          </View>
          <LessonArt strokes={finalDrawing(next)} width={PREVIEW} height={PREVIEW} label={t(next.title)} />
        </View>
        <Button title={t('Start lesson')} icon={PlayIcon} onPress={() => open(next.id)} />
        <View className="gap-1">
          <ProgressBar value={done / LESSONS.length} tone={done === LESSONS.length ? 'success' : 'accent'} />
          <Text variant="caption" tone="muted">
            {t('{done} of {total} lessons done', { done, total: LESSONS.length })}
          </Text>
        </View>
      </Card>

      {COURSES.map(course => {
        const counts = courseProgress(course, progress);
        return (
          <View key={course.id} className="gap-2">
            <SectionHeader
              right={
                <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
                  {`${counts.done}/${counts.total}`}
                </Text>
              }
            >
              {t(course.title)}
            </SectionHeader>
            <View className="overflow-hidden rounded-lg bg-surface">
              {course.lessons.map(lesson => {
                const record = progress.lessons[lesson.id];
                const isNext = lesson.id === next.id;
                return (
                  <ListItem
                    key={lesson.id}
                    left={<CourseBadge courseId={course.id} done={(record?.stars ?? 0) > 0} />}
                    title={t(lesson.title)}
                    titleLines={2}
                    subtitle={isNext ? t('Up next') : record ? t('Best score {score}', { score: record.best }) : undefined}
                    right={record ? <StarRow stars={record.stars} /> : undefined}
                    selected={isNext}
                    chevron
                    onPress={() => open(lesson.id)}
                  />
                );
              })}
            </View>
          </View>
        );
      })}
    </StudioPage>
  );
}
