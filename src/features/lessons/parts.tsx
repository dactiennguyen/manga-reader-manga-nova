import { View } from 'react-native';

import { t } from '../../core/i18n';
import type { CourseId } from '../../core/lessons/catalog';
import type { Stars } from '../../core/lessons/score';
import { useAppNavigation } from '../../state/navigation';
import { EmptyState, ICON, Icon, Screen, type IconGlyph } from '../../ui';
import { EffectIcon, EyesIcon, FaceIcon, HandsIcon, LessonsIcon, PenControlIcon, PerspectiveIcon, StarIcon } from '../../ui/icons';

export const COURSE_ICON: Record<CourseId, IconGlyph> = {
  lines: PenControlIcon,
  eyes: EyesIcon,
  faces: FaceIcon,
  hands: HandsIcon,
  perspective: PerspectiveIcon,
  effects: EffectIcon,
};

/** Three stars, the earned ones filled, so the count never rests on colour alone. */
export function StarRow({ stars, size = ICON.sm }: { stars: Stars; size?: number }) {
  return (
    <View accessible accessibilityLabel={t('{stars} of {total} stars', { stars, total: 3 })} className="flex-row gap-0.5">
      {[1, 2, 3].map(index => (
        <Icon
          key={index}
          icon={StarIcon}
          size={size}
          color={index <= stars ? 'warning' : 'text-muted'}
          weight={index <= stars ? 'fill' : 'regular'}
        />
      ))}
    </View>
  );
}

/** A course's icon in a soft accent circle. */
export function CourseBadge({ courseId, done = false }: { courseId: CourseId; done?: boolean }) {
  return (
    <View className={`h-12 w-12 items-center justify-center rounded-full ${done ? 'bg-success/15' : 'bg-accent/15'}`}>
      <Icon icon={COURSE_ICON[courseId]} size={ICON.lg} color={done ? 'success' : 'accent'} weight={done ? 'fill' : 'regular'} />
    </View>
  );
}

/** For a link to a lesson that no longer exists. */
export function MissingLesson() {
  const navigation = useAppNavigation();
  return (
    <Screen>
      <EmptyState
        icon={LessonsIcon}
        title={t('Lesson not found')}
        message={t('It may have been replaced in an update. Pick another one.')}
        action={{ label: t('All lessons'), onPress: () => navigation.replace('Courses') }}
      />
    </Screen>
  );
}
