import { StackActions } from '@react-navigation/native';
import { View, useWindowDimensions } from 'react-native';

import { msg, t, tn } from '../../core/i18n';
import { PAGE_H, PAGE_W, contextOf, lessonAfter, lessonById, type Lesson } from '../../core/lessons/catalog';
import { starsFor, type Stars } from '../../core/lessons/score';
import { currentStreak } from '../../core/story/activity';
import { POINT_WEIGHTS } from '../../core/studio/points';
import { dayKey } from '../../core/util/time';
import { useAppNavigation, type ScreenProps } from '../../state/navigation';
import { useActivity } from '../../state/useActivity';
import { useLessons } from '../../state/useLessons';
import { useSettings } from '../../state/useSettings';
import { Button, Card, ICON, Icon, ProgressBar, Text } from '../../ui';
import { ForwardIcon, RepeatIcon, StarIcon, StreakIcon } from '../../ui/icons';
import { StudioPage } from '../studio/StudioPage';
import { FULL_PAGE, LessonArt } from './LessonArt';
import { MissingLesson, StarRow } from './parts';

/** A kind word for each number of stars. Nothing here scolds: a low score only says how to do better. */
const PRAISE: Record<Stars, string> = {
  0: msg('Try again slowly, right on the dashed lines.'),
  1: msg('Good start. Slower strokes follow the guide better.'),
  2: msg('Nice work. A little more care and it is perfect.'),
  3: msg('Clean lines! That was a great trace.'),
};

const COLUMN_MAX = 680;
/** The drawing is shown at most this wide, with the screen and card padding taken off. */
const ART_MAX = 360;
const SIDE = 16 + 16;

function Result({ lesson }: { lesson: Lesson }) {
  const navigation = useAppNavigation();
  const { width } = useWindowDimensions();
  const run = useLessons(s => (s.lastRun?.lessonId === lesson.id ? s.lastRun : null));
  const record = useLessons(s => s.progress.lessons[lesson.id]);
  const activity = useActivity();
  const goal = useSettings(s => s.dailyGoal);
  const today = dayKey();
  const score = run?.score ?? record?.best ?? 0;
  const stars = starsFor(score);
  const next = lessonAfter(lesson.id);
  const lastIndex = lesson.steps.length - 1;
  const artWidth = Math.min(ART_MAX, Math.min(width, COLUMN_MAX) - SIDE * 2);
  const streak = currentStreak(activity, today);
  const drawn = activity.days[today] ?? 0;
  const todayText = goal > 0 ? t('{drawn}/{goal} today', { drawn, goal }) : tn(drawn, '{count} stroke today', '{count} strokes today');

  const allLessons = () => {
    const inStack = navigation.getState().routes.some(route => route.name === 'Courses');
    if (inStack) {
      navigation.dispatch(StackActions.popTo('Courses'));
    } else {
      navigation.replace('Courses');
    }
  };

  return (
    <StudioPage title={t(lesson.title)} subtitle={t('Lesson result')}>
      <Card className="items-center gap-2 p-4">
        <StarRow stars={stars} size={ICON.xl} />
        <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
          {t('{score}/100', { score })}
        </Text>
        <Text variant="heading" className="text-center" accessibilityLiveRegion="polite">
          {t(PRAISE[stars])}
        </Text>
        {!!record && run && !run.improved && record.best > score && (
          <Text variant="caption" tone="muted">
            {t('Best score {score}', { score: record.best })}
          </Text>
        )}
        {!!run?.improved && <Text variant="caption" tone="success">{t('New best score!')}</Text>}
      </Card>

      {!!run && (
        <Card className="items-center gap-2 p-4">
          <LessonArt
            strokes={lesson.steps[lastIndex].guide}
            context={contextOf(lesson, lastIndex)}
            ink={run.ink[lastIndex]}
            box={FULL_PAGE}
            width={artWidth}
            height={(artWidth * PAGE_H) / PAGE_W}
            label={t('Your drawing')}
          />
          <View className="w-full gap-2">
            {lesson.steps.map((step, index) => (
              <View key={step.id} className="flex-row items-center gap-3">
                <Text variant="caption" tone="secondary" className="w-16">
                  {t('Step {n}/{total}', { n: index + 1, total: lesson.steps.length })}
                </Text>
                <View className="flex-1">
                  <ProgressBar value={(run.stepScores[index] ?? 0) / 100} tone={(run.stepScores[index] ?? 0) >= 85 ? 'success' : 'accent'} />
                </View>
                <Text variant="mono" className="w-10 text-right">
                  {String(run.stepScores[index] ?? 0)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card className="gap-2 p-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={StreakIcon} size={ICON.md} color={drawn > 0 ? 'accent' : 'text-muted'} weight={drawn > 0 ? 'fill' : 'regular'} />
          <Text variant="label" className="flex-1">
            {`${t('Drawing streak')}: ${tn(streak, '{count} day', '{count} days')}`}
          </Text>
          <Text variant="caption" tone="secondary">
            {todayText}
          </Text>
        </View>
        {!!run?.firstFinish && (
          <View className="flex-row items-center gap-2">
            <Icon icon={StarIcon} size={ICON.md} color="warning" weight="fill" />
            <Text variant="label" className="flex-1">
              {t('+{points} Studio points', { points: POINT_WEIGHTS.lessonsDone ?? 0 })}
            </Text>
          </View>
        )}
      </Card>

      <View className="gap-2">
        {next ? (
          <Button title={t('Next lesson')} icon={ForwardIcon} onPress={() => navigation.replace('Lesson', { lessonId: next.id })} />
        ) : (
          <Button title={t('All lessons')} onPress={allLessons} />
        )}
        <Button
          title={t('Try again')}
          icon={RepeatIcon}
          variant="secondary"
          onPress={() => navigation.replace('LessonPractice', { lessonId: lesson.id })}
        />
        {!!next && <Button title={t('All lessons')} variant="ghost" onPress={allLessons} />}
      </View>
    </StudioPage>
  );
}

/** The score of the run just finished, the stars, how it counted toward today, and where to go next. */
export function ResultScreen({ route }: ScreenProps<'LessonResult'>) {
  const lesson = lessonById(route.params.lessonId);
  return lesson ? <Result lesson={lesson} /> : <MissingLesson />;
}
