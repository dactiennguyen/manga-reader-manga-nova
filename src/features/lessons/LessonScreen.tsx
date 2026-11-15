import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t, tn } from '../../core/i18n';
import { contextOf, courseById, lessonById, type Lesson } from '../../core/lessons/catalog';
import { useAppNavigation, type ScreenProps } from '../../state/navigation';
import { useLessons } from '../../state/useLessons';
import { AppBar, Button, Card, Screen, Text } from '../../ui';
import { PlayIcon } from '../../ui/icons';
import { LessonArt } from './LessonArt';
import { MissingLesson, StarRow } from './parts';

/** Long text and the drawings stop growing here, so a tablet keeps a readable column. */
const COLUMN_MAX = 680;
/** Screen gutter and card padding on each side. */
const SIDE = 16 + 12;
const ART_RATIO = 0.6;

function LessonSteps({ lesson }: { lesson: Lesson }) {
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const record = useLessons(s => s.progress.lessons[lesson.id]);
  const course = courseById(lesson.courseId);
  const artWidth = Math.min(width, COLUMN_MAX) - SIDE * 2;
  const artHeight = Math.round(artWidth * ART_RATIO);

  return (
    <Screen padded={false} bottom={false}>
      <AppBar title={t(lesson.title)} subtitle={course ? t(course.title) : undefined} onBack={navigation.goBack} />
      <ScrollView className="flex-1" contentContainerClassName="w-full max-w-[680px] gap-4 self-center px-4 pb-6 pt-1">
        <View className="gap-1">
          <Text variant="bodySmall" tone="secondary">
            {tn(lesson.steps.length, '{count} step. Trace each one with your pen.', '{count} steps. Trace each one with your pen.')}
          </Text>
          {!!record && (
            <View className="flex-row items-center gap-2">
              <StarRow stars={record.stars} />
              <Text variant="caption" tone="muted">
                {t('Best score {score}', { score: record.best })}
              </Text>
            </View>
          )}
        </View>
        {lesson.steps.map((step, index) => (
          <Card key={step.id} className="gap-3 p-3">
            <View className="flex-row items-start gap-3">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-accent/15">
                <Text variant="label" tone="accent">
                  {String(index + 1)}
                </Text>
              </View>
              <Text className="flex-1">{t(step.text)}</Text>
            </View>
            <LessonArt
              strokes={step.guide}
              context={contextOf(lesson, index)}
              width={artWidth}
              height={artHeight}
              startDots
              label={t(step.text)}
            />
          </Card>
        ))}
        <Text variant="caption" tone="muted">
          {t('The colored dot shows where each stroke starts.')}
        </Text>
      </ScrollView>
      <View className="w-full max-w-[680px] self-center px-4 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button title={t('Start practice')} icon={PlayIcon} onPress={() => navigation.navigate('LessonPractice', { lessonId: lesson.id })} />
      </View>
    </Screen>
  );
}

/** One lesson: what each step asks, with a drawn example, and the way into practice. */
export function LessonScreen({ route }: ScreenProps<'Lesson'>) {
  const lesson = lessonById(route.params.lessonId);
  return lesson ? <LessonSteps lesson={lesson} /> : <MissingLesson />;
}
