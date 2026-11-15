import { useEffect, useMemo, useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScopedTheme } from 'uniwind';

import { t } from '../../core/i18n';
import { contextOf, lessonById, PAGE_H, PAGE_W, type Lesson } from '../../core/lessons/catalog';
import { lessonScore, scoreTrace } from '../../core/lessons/score';
import type { Stroke } from '../../core/model/types';
import { useAppNavigation, type ScreenProps } from '../../state/navigation';
import { noteStrokes } from '../../state/useActivity';
import { useLessons } from '../../state/useLessons';
import { AppBar, Button, IconButton, Screen, Text, confirm } from '../../ui';
import { CheckIcon, DeleteIcon, ForwardIcon, PreviewIcon, UndoIcon } from '../../ui/icons';
import { MissingLesson } from './parts';
import { PracticePad } from './PracticePad';

/** Space kept around the page inside its area. */
const PAGE_MARGIN = 12;

function Practice({ lesson }: { lesson: Lesson }) {
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(0);
  const [ink, setInk] = useState<Stroke[][]>(() => lesson.steps.map(() => []));
  const [showGuide, setShowGuide] = useState(true);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const finishing = useRef(false);
  const step = lesson.steps[stepIndex];
  const strokes = ink[stepIndex];
  const last = stepIndex === lesson.steps.length - 1;
  const context = useMemo(() => contextOf(lesson, stepIndex), [lesson, stepIndex]);
  const anyInk = ink.some(list => list.length > 0);

  // Leaving drops the strokes, so ask first once there are some. Finishing goes on to the result.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (finishing.current || !anyInk) {
          return;
        }
        event.preventDefault();
        confirm(t('Leave this lesson?'), t('Your practice strokes are not kept.'), { confirmText: t('Leave lesson'), destructive: true }).then(ok => {
          if (ok) {
            finishing.current = true;
            navigation.dispatch(event.data.action);
          }
        });
      }),
    [navigation, anyInk],
  );

  const setStepInk = (update: (list: Stroke[]) => Stroke[]) =>
    setInk(all => all.map((list, index) => (index === stepIndex ? update(list) : list)));

  const onStroke = (stroke: Stroke) => {
    setStepInk(list => [...list, stroke]);
    // Practice counts toward today's strokes and the streak, as drawing on a page does.
    noteStrokes(1);
  };

  const clear = async () => {
    if (await confirm(t('Clear this step?'), undefined, { confirmText: t('Clear'), destructive: true })) {
      setStepInk(() => []);
    }
  };

  const next = () => {
    if (!last) {
      setStepIndex(stepIndex + 1);
      setShowGuide(true);
      return;
    }
    const stepScores = lesson.steps.map((item, index) => scoreTrace(item.guide, ink[index]).score);
    useLessons.getState().finish({ lessonId: lesson.id, stepScores, score: lessonScore(stepScores, lesson.steps.length), ink });
    finishing.current = true;
    navigation.replace('LessonResult', { lessonId: lesson.id });
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea({ w: width, h: height });
  };
  const pageWidth = area ? Math.max(0, Math.min(area.w - PAGE_MARGIN * 2, ((area.h - PAGE_MARGIN * 2) * PAGE_W) / PAGE_H)) : 0;

  return (
    <Screen padded={false} bottom={false}>
      <AppBar
        title={t('Step {n}/{total}', { n: stepIndex + 1, total: lesson.steps.length })}
        subtitle={t(lesson.title)}
        onBack={navigation.goBack}
        right={
          <View className="flex-row">
            <IconButton
              icon={PreviewIcon}
              active={showGuide}
              onPress={() => setShowGuide(value => !value)}
              accessibilityLabel={showGuide ? t('Hide guide') : t('Show guide')}
            />
            <IconButton icon={UndoIcon} disabled={!strokes.length} onPress={() => setStepInk(list => list.slice(0, -1))} accessibilityLabel={t('Undo')} />
            <IconButton icon={DeleteIcon} disabled={!strokes.length} onPress={clear} accessibilityLabel={t('Clear')} />
          </View>
        }
      />
      <Text className="px-4 pb-1" accessibilityLiveRegion="polite">
        {t(step.text)}
      </Text>
      <View testID="practice-area" className="flex-1 items-center justify-center" onLayout={onLayout}>
        {pageWidth > 0 && (
          <PracticePad
            width={pageWidth}
            guide={step.guide}
            context={context}
            showGuide={showGuide}
            ink={strokes}
            onStroke={onStroke}
            label={t('Practice page. Trace the dashed lines.')}
          />
        )}
      </View>
      <View className="flex-row items-center gap-3 px-4 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
        <View className="flex-1 flex-row gap-1.5" accessible accessibilityLabel={t('Step {n}/{total}', { n: stepIndex + 1, total: lesson.steps.length })}>
          {lesson.steps.map((item, index) => (
            <View key={item.id} className={`h-2 flex-1 rounded-full ${index <= stepIndex ? 'bg-accent' : 'bg-overlay'}`} />
          ))}
        </View>
        <Button title={last ? t('Done') : t('Next step')} icon={last ? CheckIcon : ForwardIcon} onPress={next} />
      </View>
    </Screen>
  );
}

/**
 * Practice: trace each step's guide on a page with the pen, then see the score. The page leads: the tools
 * sit in the bar above it, never on it. Dark like the canvas, so the paper is the brightest thing on screen.
 */
export function PracticeScreen({ route }: ScreenProps<'LessonPractice'>) {
  const lesson = lessonById(route.params.lessonId);
  return <ScopedTheme theme="dark">{lesson ? <Practice lesson={lesson} /> : <MissingLesson />}</ScopedTheme>;
}
